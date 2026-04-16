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
    
    lightStorage.set('users', newUser);
    lightStorage.destroy();
    expect(lightStorage.get('users')).toBeUndefined();
    expect(mockStorage.getItem('LIGHT_DB')).toBeNull();
  });

  test("커스텀키를 통해 데이터가 저장소에 저장되어야 한다.", () => {
    const newUser = {id: 1, name : "test", age : 22};

    const TEST_KEY = "TEST-KEY";
    lightStorage.onSetStorageKey(TEST_KEY);
    lightStorage.set('users', newUser);

    const savedData = JSON.parse(mockStorage.getItem(TEST_KEY)!);
    expect(savedData.database.users).toEqual(newUser);
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

    const savedData1 = JSON.parse(mockStorage.getItem(TEST_KEY1)!);
    expect(savedData1.database.users).toEqual(newUser);

    lightStorage.onSetStorageKey(TEST_KEY2);
    lightStorage.set('monster', newMonster);

    const savedData2 = JSON.parse(mockStorage.getItem(TEST_KEY2)!);
    expect(savedData2.database.monster).toEqual(newMonster);
  });

  test("커스텀 키가 중간에 변경된다면 데이터도 변경되어야 한다.", () => {
    const TEST_KEY1 = "TEST-KEY1";
    const TEST_KEY2 = "TEST-KEY2";
    const newUser = {id: 1, name : "test", age : 22};
    const newMonster = {id: 2, name : "mons", age : 550};
    lightStorage.onSetStorageKey(TEST_KEY1);
    lightStorage.set('users', newUser);

    const savedData1 = JSON.parse(mockStorage.getItem(TEST_KEY1)!);
    expect(savedData1.database.users).toEqual(newUser);
    expect(lightStorage.get('users')).toEqual(newUser);

    lightStorage.onSetStorageKey(TEST_KEY2);
    lightStorage.set('monster', newMonster);

    const savedData2 = JSON.parse(mockStorage.getItem(TEST_KEY2)!);
    expect(savedData2.database.monster).toEqual(newMonster);
    expect(savedData2.database.users).toBeUndefined();
    expect(lightStorage.get('monster')).toEqual(newMonster);
    expect(lightStorage.get('user')).toBeUndefined();
  });

  test("저장소에 잘못된 데이터가 있어도 안전하게 초기화되어야 한다.", () => {
    mockStorage.setItem("LIGHT_DB", "invalid-json");
    lightStorage = new LightStorage(mockStorage);

    expect(lightStorage.getDatabase()).toEqual(new Map());
    expect(lightStorage.getStorage()).toEqual(new Snapshot(new Map()));
  });
});