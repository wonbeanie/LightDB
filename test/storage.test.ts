import { Snapshot } from "../src/dto/snapshot.js";
import { MemoryStorage } from "../src/lib/memory-storage.js";
import { LightStorage } from "../src/lib/storage.js";

describe("LightStorage 테스트", () => {
  let mockStorage: MemoryStorage;
  let lightStorage : LightStorage;

  const getTableKey = (storageKey : string, table : string) => {
    return `${storageKey}:table:${encodeURIComponent(table)}`;
  };

  beforeEach(() => {
    vi.useFakeTimers({
      now : 1000
    })
    mockStorage = new MemoryStorage();
    lightStorage = new LightStorage(mockStorage);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("데이터를 설정하면 저장소에 저장되어야 한다.", () => {
    lightStorage.set('users', {id: 1, name : "test", age : 22});

    const savedMeta = JSON.parse(mockStorage.getItem("LIGHT_DB")!);
    const savedTable = JSON.parse(mockStorage.getItem(getTableKey("LIGHT_DB", "users"))!);
    expect(savedMeta).toEqual({
      version : 2,
      tables : ["users"],
      updateTimestamp : 1000
    });
    expect(savedTable).toEqual({id: 1, name : "test", age : 22});
  });

  test("동기화 시 타임스탬프가 더 최신일 때만 업데이트해야 한다.", () => {
    const oldSnapshot = new Snapshot(new Map(), 0);
    lightStorage.syncStorage(oldSnapshot);

    const newSnapshot = new Snapshot(new Map(), 2000);
    lightStorage.syncStorage(newSnapshot);

    expect(lightStorage.getStorage()).toStrictEqual(newSnapshot);
  });

  test("특정 테이블의 데이터를 가져올 수 있어야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};
    const newMonster = {id: 2, name : "mons", age : 550};
    lightStorage.set('monster', newMonster);
    lightStorage.set('users', newUser);
    expect(lightStorage.get('users')).toEqual(newUser);
    expect(lightStorage.get('monster')).toEqual(newMonster);
    expect(lightStorage.get('god')).toBeUndefined();
  });

  test("전체 데이터베이스가 한 번에 교체되어야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};
    const newMonster = {id: 2, name : "mons", age : 550};
    lightStorage.set('users', newUser);

    let newData = new Map();
    newData.set('monster', newMonster);
    const newSnapshot = new Snapshot(newData, 2000);
    lightStorage.setDatabase(newSnapshot);

    expect(lightStorage.get('users')).toBeUndefined();
    expect(lightStorage.get('monster')).toEqual(newMonster);
  });

  test("메모리와 저장소에서 데이터가 없어져야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};
    lightStorage.set('users', newUser);

    lightStorage.clear();
    expect(lightStorage.get('users')).toBeUndefined();
    expect(mockStorage.getItem('LIGHT_DB')).toBeNull();
    expect(mockStorage.getItem(getTableKey("LIGHT_DB", "users"))).toBeNull();
    
    lightStorage.set('users', newUser);
    lightStorage.destroy();
    expect(lightStorage.get('users')).toBeUndefined();
    expect(mockStorage.getItem('LIGHT_DB')).toBeNull();
    expect(mockStorage.getItem(getTableKey("LIGHT_DB", "users"))).toBeNull();
  });

  test("커스텀키를 통해 데이터가 저장소에 저장되어야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};

    const TEST_KEY = "TEST-KEY";
    lightStorage.onSetStorageKey(TEST_KEY);
    lightStorage.set('users', newUser);

    const savedMeta = JSON.parse(mockStorage.getItem(TEST_KEY)!);
    const savedTable = JSON.parse(mockStorage.getItem(getTableKey(TEST_KEY, "users"))!);
    expect(savedMeta.tables).toEqual(["users"]);
    expect(savedTable).toEqual(newUser);
  });

  test("인스턴스 재생성 시 데이터가 유지되어야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};

    lightStorage.set('users', newUser);

    const newLightStorage = new LightStorage(mockStorage);
    expect(newLightStorage.get('users')).toEqual(newUser);
  });

  test("인스턴스마다 커스텀 키가 다르다면 키마다 저장소에 저장되어야 한다.", () => {
    const TEST_KEY1 = "TEST-KEY1";
    const TEST_KEY2 = "TEST-KEY2";
    const newUser = {id: 1, name : "test", age : 22};
    const newMonster = {id: 2, name : "mons", age : 550};
    lightStorage.onSetStorageKey(TEST_KEY1);
    lightStorage.set('users', newUser);

    const savedData1 = JSON.parse(mockStorage.getItem(getTableKey(TEST_KEY1, "users"))!);
    expect(savedData1).toEqual(newUser);

    lightStorage.onSetStorageKey(TEST_KEY2);
    lightStorage.set('monster', newMonster);

    const savedData2 = JSON.parse(mockStorage.getItem(getTableKey(TEST_KEY2, "monster"))!);
    expect(savedData2).toEqual(newMonster);
  });

  test("커스텀 키가 중간에 변경된다면 데이터도 변경되어야 한다.", () => {
    const TEST_KEY1 = "TEST-KEY1";
    const TEST_KEY2 = "TEST-KEY2";
    const newUser = {id: 1, name : "test", age : 22};
    const newMonster = {id: 2, name : "mons", age : 550};
    lightStorage.onSetStorageKey(TEST_KEY1);
    lightStorage.set('users', newUser);

    const savedData1 = JSON.parse(mockStorage.getItem(getTableKey(TEST_KEY1, "users"))!);
    expect(savedData1).toEqual(newUser);
    expect(lightStorage.get('users')).toEqual(newUser);

    lightStorage.onSetStorageKey(TEST_KEY2);
    lightStorage.set('monster', newMonster);

    const savedMeta2 = JSON.parse(mockStorage.getItem(TEST_KEY2)!);
    const savedData2 = JSON.parse(mockStorage.getItem(getTableKey(TEST_KEY2, "monster"))!);
    expect(savedMeta2.tables).toEqual(["monster"]);
    expect(savedData2).toEqual(newMonster);
    expect(mockStorage.getItem(getTableKey(TEST_KEY2, "users"))).toBeNull();
    expect(lightStorage.get('monster')).toEqual(newMonster);
    expect(lightStorage.get('user')).toBeUndefined();
  });

  test("기존 단일 스냅샷 형식의 저장소 데이터를 불러올 수 있어야 한다.", () => {
    const legacySnapshot = new Snapshot(new Map([["users", {id: 1, name : "test"}]]), 3000);
    mockStorage.setItem("LIGHT_DB", Snapshot.stringify(legacySnapshot));

    const newLightStorage = new LightStorage(mockStorage);

    expect(newLightStorage.get("users")).toEqual({id: 1, name : "test"});
    expect(newLightStorage.getSnapshot()).toStrictEqual(legacySnapshot);
  });

  describe("잘못된 데이터 로드 시", () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockStorage.setItem("LIGHT_DB", "invalid-json");
      lightStorage = new LightStorage(mockStorage);
    })

    afterEach(() => {
      vi.restoreAllMocks();
    })

    test("데이터베이스는 빈 Map으로 초기화된다", () => {
      expect(lightStorage.getDatabase()).toEqual(new Map());
    });

    test("스토리지 스냅샷은 빈 상태여야 한다", () => {
      expect(lightStorage.getStorage()).toStrictEqual(new Snapshot(new Map()));
    });
  })

  test("데이터를 제거하면 저장소에서 제거되어야 한다", () => {
    lightStorage.set('users', {id: 1, name : "test", age : 22});
    
    const savedMeta = JSON.parse(mockStorage.getItem("LIGHT_DB")!);
    const savedTable = JSON.parse(mockStorage.getItem(getTableKey("LIGHT_DB", "users"))!);
    expect(savedMeta.updateTimestamp).toBe(1000);
    expect(savedTable).toEqual({id: 1, name : "test", age : 22});

    vi.advanceTimersByTime(1000);
    lightStorage.remove('users');
    const removeMeta = JSON.parse(mockStorage.getItem("LIGHT_DB")!);
    expect(removeMeta.tables).toEqual([]);
    expect(removeMeta.updateTimestamp).toBe(2000);
    expect(mockStorage.getItem(getTableKey("LIGHT_DB", "users"))).toBeNull();
  });

  test("동기화 시 올바르지않는 Snapshot이 전달되면 에러를 던져야 한다.", () => {
    const oldSnapshot = {
      database : new Map()
    } as any;
    
    expect(() => lightStorage.syncStorage(oldSnapshot)).toThrow("[Storage] Synchronization Failed:");
  });

  test("Snapshot을 요청시 모든 데이터를 새로운 Snapshot 객체로 반환해야된다.", () => {
    const testKey = "users";
    const testData = {id: 1, name : "test", age : 22};

    lightStorage.set(testKey, testData);
    const snapshot = lightStorage.getSnapshot();

    expect(snapshot).toStrictEqual(new Snapshot(new Map([[testKey, testData]]), 1000));
  });

  test("저장소에 데이터를 저장도중 에러가 발생하면 에러를 던져야 한다.", () => {
    vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
      throw new Error("Test Error");
    });

    expect(() => lightStorage.setStorage(new Snapshot(new Map(), 100))).toThrow("[Storage] Save Failed:");

    vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
      let qotaExceededError = new DOMException("QuotaExceededError", "QuotaExceededError");
      throw qotaExceededError;
    });

    expect(() => lightStorage.setStorage(new Snapshot(new Map(), 100))).toThrow("Quota exceeded");
  });

  test("저장소를 지정하지 않았을때 환경에따라 저장소가 지정되어야 한다.", () => {
    vi.stubGlobal('window', undefined);

    const storageSpy = vi.spyOn(MemoryStorage.prototype, "getItem");
    new LightStorage()

    expect(storageSpy).toHaveBeenCalled();

    const localStorageSpy = {
      getItem : vi.fn()
    };

    vi.stubGlobal('window', {
      localStorage : localStorageSpy
    });

    new LightStorage()

    expect(localStorageSpy.getItem).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
