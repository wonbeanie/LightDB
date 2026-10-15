/**
 * PeerJS 를 대체하는 메모리 내 가짜 네트워크.
 * - 여러 Peer / DataConnection 이 실제로 서로 메시지를 주고받는다 (기존 MockPeer 는 단일 피어용).
 * - 메시지마다 시드 기반 랜덤 지연을 준다.
 * - 같은 방향의 링크 안에서는 전달 순서를 보장한다 (WebRTC reliable ordered DataChannel 과 동일).
 */
type Listener = (...args: any[]) => void;

class Emitter {
  private map = new Map<string, Listener[]>();

  on(event: string, cb: Listener) {
    const list = this.map.get(event) ?? [];
    list.push(cb);
    this.map.set(event, list);
    return this;
  }

  off(event: string, cb: Listener) {
    this.map.set(event, (this.map.get(event) ?? []).filter((l) => l !== cb));
    return this;
  }

  removeListener(event: string, cb: Listener) {
    return this.off(event, cb);
  }

  listenerCount(event: string) {
    return this.map.get(event)?.length ?? 0;
  }

  totalListeners() {
    let n = 0;
    for (const list of this.map.values()) n += list.length;
    return n;
  }

  protected emit(event: string, ...args: unknown[]) {
    for (const cb of [...(this.map.get(event) ?? [])]) cb(...args);
  }
}

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface Link {
  queue: { due: number; fn: () => void }[];
  armed: boolean;
  lastDue: number;
}

export interface FakeNetworkOptions {
  seed?: number;
  minLatency?: number;
  maxLatency?: number;
}

export class FakeNetwork {
  private peers = new Map<string, FakePeer>();
  private links = new Map<string, Link>();
  private rand: () => number;
  private seq = 0;
  readonly minLatency: number;
  readonly maxLatency: number;
  messagesSent = 0;

  /** peerLoader.load() 가 돌려줄 Peer 클래스 (이 네트워크에 묶여 있음) */
  readonly PeerClass: new (options?: unknown) => FakePeer;

  constructor(opts: FakeNetworkOptions = {}) {
    this.rand = mulberry32(opts.seed ?? 1);
    this.minLatency = opts.minLatency ?? 0;
    this.maxLatency = opts.maxLatency ?? 5;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const network = this;
    this.PeerClass = class extends FakePeer {
      constructor(options?: unknown) {
        super(network, options);
      }
    };
  }

  nextPeerId() {
    return `fake-peer-${++this.seq}`;
  }

  register(peer: FakePeer) {
    this.peers.set(peer.id, peer);
  }

  unregister(peer: FakePeer) {
    this.peers.delete(peer.id);
  }

  getPeer(id: string) {
    return this.peers.get(id);
  }

  private delay() {
    return this.minLatency + Math.floor(this.rand() * (this.maxLatency - this.minLatency + 1));
  }

  /**
   * 같은 linkKey 안에서는 먼저 보낸 메시지가 먼저 도착한다.
   * 링크마다 큐 하나와 타이머 하나만 쓰므로 만기가 겹쳐도 순서가 뒤집히지 않는다.
   */
  schedule(linkKey: string, fn: () => void) {
    const now = Date.now();
    const link = this.links.get(linkKey) ?? { queue: [], armed: false, lastDue: 0 };
    this.links.set(linkKey, link);

    const due = Math.max(now + this.delay(), link.lastDue);
    link.lastDue = due;
    link.queue.push({ due, fn });

    if (!link.armed) {
      link.armed = true;
      setTimeout(() => this.pump(link), due - now);
    }
  }

  private pump(link: Link) {
    const now = Date.now();
    while (link.queue.length > 0 && link.queue[0]!.due <= now) {
      link.queue.shift()!.fn();
    }

    if (link.queue.length > 0) {
      setTimeout(() => this.pump(link), Math.max(0, link.queue[0]!.due - Date.now()));
    } else {
      link.armed = false;
    }
  }

  livePeerCount() {
    return this.peers.size;
  }

  /** 아직 살아있는 Peer / Connection 에 남아 있는 이벤트 리스너 총합 */
  liveListenerCount() {
    let n = 0;
    for (const peer of this.peers.values()) {
      n += peer.totalListeners();
      for (const conn of peer.conns) n += conn.totalListeners();
    }
    return n;
  }
}

export class FakePeer extends Emitter {
  destroyed = false;
  readonly id: string;
  readonly conns = new Set<FakeConn>();

  constructor(protected network: FakeNetwork, _options?: unknown) {
    super();
    this.id = network.nextPeerId();
    network.register(this);
    setTimeout(() => {
      if (!this.destroyed) this.emit('open', this.id);
    }, 0);
  }

  connect(targetId: string) {
    const local = new FakeConn(this.network, targetId, this);
    this.conns.add(local);

    const target = this.network.getPeer(targetId);
    if (!target || target.destroyed) {
      setTimeout(() => {
        if (this.destroyed) return;
        this.emit('error', Object.assign(new Error(`Could not connect to peer ${targetId}`), { type: 'peer-unavailable' }));
      }, 0);
      return local;
    }

    const remote = new FakeConn(this.network, this.id, target);
    local.pair = remote;
    remote.pair = local;
    target.conns.add(remote);

    const key = `${this.id}->${targetId}:setup`;
    this.network.schedule(key, () => {
      if (target.destroyed || local.closed) return;
      target.emit('connection', remote);
      this.network.schedule(key, () => {
        local.openNow();
        remote.openNow();
      });
    });
    return local;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const conn of [...this.conns]) conn.close();
    this.conns.clear();
    this.network.unregister(this);
    this.emit('disconnected');
    this.emit('close');
  }

  disconnect() {}
  reconnect() {}
}

export class FakeConn extends Emitter {
  open = false;
  closed = false;
  pair: FakeConn | null = null;

  constructor(private network: FakeNetwork, public peer: string, private owner: FakePeer) {
    super();
  }

  openNow() {
    if (this.closed || this.open) return;
    this.open = true;
    this.emit('open');
  }

  send(data: unknown) {
    if (!this.open || !this.pair) throw new Error('Connection is not open');
    const payload = structuredClone(data);
    const pair = this.pair;
    this.network.messagesSent++;
    this.network.schedule(`${this.owner.id}->${this.peer}:data`, () => {
      if (!pair.open) return;
      pair.emit('data', payload);
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.owner.conns.delete(this);
    const pair = this.pair;
    this.emit('close');
    if (!pair) return;
    // 이미 보낸 데이터가 먼저 도착한 뒤 상대편에 close 가 전달된다.
    this.network.schedule(`${this.owner.id}->${this.peer}:data`, () => {
      if (pair.closed) return;
      pair.closed = true;
      pair.open = false;
      pair.owner.conns.delete(pair);
      pair.emit('close');
    });
  }
}
