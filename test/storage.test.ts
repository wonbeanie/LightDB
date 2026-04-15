import { Snapshot } from "../src/dto/snapshot.js";
import { MemoryStorage } from "../src/lib/memory-storage.js";
import { LightStorage } from "../src/lib/storage.js";


describe("LightStorage 테스트", () => {
  let mockStorage: MemoryStorage;
  let lightStorage : LightStorage;

  beforeEach(() => {
    vi.useFakeTimers({
      now : 1000
    })
    mockStorage = new MemoryStorage();
    lightStorage = new LightStorage(mockStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("데이터를 설정하면 저장소에 저장되어야 한다.", () => {
    lightStorage.set('users', {id: 1, name : "test", age : 22});

    const savedData = JSON.parse(mockStorage.getItem("LIGHT_DB")!);
    expect(savedData.database.users).toEqual({id: 1, name : "test", age : 22});

    expect(savedData.updateTimestamp).toBe(1000);
  });

  test("동기화 시 타임스탬프가 더 최신일 때만 업데이트해야 한다.", () => {
    const oldSnapshot = new Snapshot(new Map(), 0);
    lightStorage.syncStorage(oldSnapshot);

    const newSnapshot = new Snapshot(new Map(), 2000);
    lightStorage.syncStorage(newSnapshot);

    const data = mockStorage.getItem("LIGHT_DB")!;
    expect(Snapshot.parse(data)).toEqual(newSnapshot);
  });
});