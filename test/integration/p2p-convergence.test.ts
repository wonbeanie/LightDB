import { LightDB } from "../../src/index.js";
import { MemoryStorage } from "../../src/lib/memory-storage.js";
import { peerLoader } from "../../src/lib/peerLoader.js";
import { FakeNetwork } from "../mock/fake-network.js";

const useNetwork = (network: FakeNetwork) => {
  vi.spyOn(peerLoader, "load").mockResolvedValue(
    { Peer: network.PeerClass, default: network.PeerClass } as never
  );
};

const newDb = () => new LightDB({}, new MemoryStorage());
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("여러 피어 통합 테스트 (메모리 내 가짜 네트워크, 랜덤 지연)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("방장 1 + 참여자 3이 동시에 업데이트해도 모든 피어의 DB가 같아지고, 각 update는 자신의 반영 이후에 resolve된다", async () => {
    const network = new FakeNetwork({ seed: 42, minLatency: 0, maxLatency: 8 });
    useNetwork(network);

    const chief = newDb();
    const chiefId = (await chief.createRoom())!;
    const guests = [newDb(), newDb(), newDb()];
    await Promise.all(guests.map((g) => g.joinRoom(chiefId)));
    const peers = [chief, ...guests];
    const names = ["chief", "g1", "g2", "g3"];

    const COUNT = 100;
    const earlyResolves: string[] = [];
    const ops: Promise<void>[] = [];

    peers.forEach((peer, idx) => {
      const name = names[idx]!;
      for (let i = 0; i < COUNT; i++) {
        // 서로 다른 키: 충돌 없이 전부 보존되어야 한다
        ops.push((async () => {
          await peer.update(`own_${name}`, { [`k${i}`]: i });
          if (peer.database[`own_${name}`]?.[`k${i}`] !== i) {
            earlyResolves.push(`${name}#${i}`);
          }
        })());
        // 같은 키: 어떤 값이 이기든 모든 피어가 같은 값이어야 한다
        ops.push(peer.update("shared", { last: `${name}-${i}` }));
      }
    });

    await Promise.all(ops);
    await sleep(100); // 마지막 브로드캐스트가 전부 도착할 때까지

    for (const peer of guests) {
      expect(peer.database).toEqual(chief.database);
    }
    for (let p = 0; p < peers.length; p++) {
      for (let i = 0; i < COUNT; i++) {
        expect(chief.database[`own_${names[p]}`]?.[`k${i}`]).toBe(i);
      }
    }
    expect(String(chief.database["shared"]?.last)).toMatch(/^(chief|g1|g2|g3)-\d+$/);
    // 업데이트 4 peers × 100 × 2 = 800건
    expect(ops.length).toBe(800);
    expect(earlyResolves).toEqual([]);

    peers.forEach((p) => p.destroy());
  });

  test("방장이 확정한 업데이트 순서를 모든 참여자가 똑같이 관찰한다", async () => {
    const network = new FakeNetwork({ seed: 7, minLatency: 0, maxLatency: 10 });
    useNetwork(network);

    const chief = newDb();
    const chiefId = (await chief.createRoom())!;
    const guests = [newDb(), newDb(), newDb()];
    await Promise.all(guests.map((g) => g.joinRoom(chiefId)));

    const observed = new Map<LightDB, unknown[]>();
    [chief, ...guests].forEach((peer) => {
      const seen: unknown[] = [];
      observed.set(peer, seen);
      peer.on("seq", (data: { n?: unknown }) => seen.push(data.n));
    });

    const ops: Promise<void>[] = [];
    guests.forEach((g, gi) => {
      for (let i = 0; i < 60; i++) ops.push(g.update("seq", { n: `g${gi}-${i}` }));
    });
    await Promise.all(ops);
    await sleep(100);

    const chiefOrder = observed.get(chief)!;
    expect(chiefOrder.length).toBe(180);
    for (const g of guests) {
      expect(observed.get(g)).toEqual(chiefOrder);
    }
    // 같은 참여자가 보낸 업데이트는 보낸 순서를 유지한다
    for (let gi = 0; gi < guests.length; gi++) {
      const mine = chiefOrder.filter((v) => String(v).startsWith(`g${gi}-`)).map((v) => Number(String(v).split("-")[1]));
      expect(mine).toEqual([...mine].sort((a, b) => a - b));
    }

    [chief, ...guests].forEach((p) => p.destroy());
  });

  test("중간에 입장한 피어는 snapshot으로 현재 상태를 받고 이후 업데이트도 수렴한다", async () => {
    const network = new FakeNetwork({ seed: 3, minLatency: 0, maxLatency: 6 });
    useNetwork(network);

    const chief = newDb();
    const chiefId = (await chief.createRoom())!;
    const early = newDb();
    await early.joinRoom(chiefId);

    await Promise.all(Array.from({ length: 50 }, (_, i) => early.update("log", { [`e${i}`]: i })));
    await Promise.all(Array.from({ length: 50 }, (_, i) => chief.update("log", { [`c${i}`]: i })));
    await sleep(50);

    const late = newDb();
    await late.joinRoom(chiefId);
    expect(late.database).toEqual(chief.database);
    expect(Object.keys(late.database["log"]!).length).toBe(100);

    await Promise.all(Array.from({ length: 20 }, (_, i) => late.update("log", { [`l${i}`]: i })));
    await sleep(50);
    expect(early.database).toEqual(chief.database);
    expect(late.database).toEqual(chief.database);
    expect(Object.keys(chief.database["log"]!).length).toBe(120);

    [chief, early, late].forEach((p) => p.destroy());
  });

  test("같은 ms에 보낸 서로 다른 피어의 update id는 겹치지 않는다", async () => {
    vi.useFakeTimers(); // Date.now() 고정: 모든 피어가 같은 ms에 요청을 보내는 최악의 경우
    const network = new FakeNetwork({ seed: 1, minLatency: 1, maxLatency: 3 });
    useNetwork(network);
    const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    const chief = newDb();
    const createPromise = chief.createRoom();
    await advance(20);
    const chiefId = (await createPromise)!;
    const guests = [newDb(), newDb()];
    for (const g of guests) {
      const join = g.joinRoom(chiefId);
      await advance(100);
      await join;
    }

    const ids: string[] = [];
    [chief, ...guests].forEach((p) => p.onPeer("send", (d) => {
      // 방장이 확정 후 브로드캐스트하는 메시지는 원 요청의 id를 그대로 쓰므로 guest 요청만 모은다
      if (p !== chief) ids.push(d!.data.id);
    }));

    const ops = guests.flatMap((g, gi) => Array.from({ length: 10 }, (_, i) => g.update(`t${gi}`, { [`k${i}`]: i })));
    await advance(200);
    await Promise.all(ops);

    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(20);

    [chief, ...guests].forEach((p) => p.destroy());
  });

  test("지연이 큰 환경에서도 update()는 자신의 업데이트가 반영된 뒤에 resolve된다", async () => {
    const network = new FakeNetwork({ seed: 42, minLatency: 5, maxLatency: 20 });
    useNetwork(network);

    const chief = newDb();
    const chiefId = (await chief.createRoom())!;
    const guests = [newDb(), newDb()];
    await Promise.all(guests.map((g) => g.joinRoom(chiefId)));

    const early: string[] = [];
    const ops = guests.flatMap((g, gi) => Array.from({ length: 20 }, (_, i) => (async () => {
      await g.update(`t${gi}`, { [`k${i}`]: i });
      if (g.database[`t${gi}`]?.[`k${i}`] !== i) early.push(`g${gi}#${i}`);
    })()));
    await Promise.all(ops);

    expect(early).toEqual([]);

    [chief, ...guests].forEach((p) => p.destroy());
  });

  test("입장, 업데이트, 퇴장을 30번 반복해도 destroy 후 타이머와 리스너가 남지 않는다", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    const network = new FakeNetwork({ seed: 11, minLatency: 1, maxLatency: 5 });
    useNetwork(network);
    const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    const chief = newDb();
    const createPromise = chief.createRoom();
    await advance(20);
    const chiefId = (await createPromise)!;

    const CYCLES = 30;
    for (let i = 0; i < CYCLES; i++) {
      const guest = newDb();
      const join = guest.joinRoom(chiefId);
      await advance(100);
      await join;

      const update = guest.update("cycle", { [`n${i}`]: i });
      await advance(100);
      await update;
      expect(chief.database["cycle"]?.[`n${i}`]).toBe(i);

      guest.destroy();
      await advance(100);
    }

    expect(Object.keys(chief.database["cycle"]!).length).toBe(CYCLES);

    chief.destroy();
    await advance(100);

    expect(vi.getTimerCount()).toBe(0);
    expect(network.livePeerCount()).toBe(0);
    expect(network.liveListenerCount()).toBe(0);
    expect(unhandled).toEqual([]);

    process.off("unhandledRejection", onUnhandled);
  });

  test("참여자가 떠난 뒤 방장의 재연결 시도는 유한하게 끝나고 타이머가 남지 않는다", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    const network = new FakeNetwork({ seed: 5, minLatency: 1, maxLatency: 5 });
    useNetwork(network);
    const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    const chief = newDb();
    const createPromise = chief.createRoom();
    await advance(20);
    const chiefId = (await createPromise)!;

    for (let i = 0; i < 5; i++) {
      const guest = newDb();
      const join = guest.joinRoom(chiefId);
      await advance(100);
      await join;
      guest.destroy();
      await advance(100);
    }

    // 재연결 5회(5초 간격) + 각 연결 timeout(5초)을 모두 지나갈 만큼 진행
    await advance(120_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(unhandled).toEqual([]);

    chief.destroy();
    process.off("unhandledRejection", onUnhandled);
  });
});
