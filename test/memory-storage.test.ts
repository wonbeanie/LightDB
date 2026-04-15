import { MemoryStorage } from "../src/lib/memory-storage.js";

describe("MemoryStorage 테스트", () => {
  let storage : MemoryStorage;

  beforeEach(()=>{
    storage = new MemoryStorage();
  });

  test("데이터를 저장하고 가져올 수 있어야 한다.", () => {
    storage.setItem("key", "value");
    expect(storage.getItem("key")).toBe("value");
  });

  test("존재하지 않는 키를 조회하면 null을 반환해야 한다.", () => {
    expect(storage.getItem("nonExistentKey")).toBeNull();
  });

  test("데이터를 삭제할 수 있어야 한다.", () => {
    storage.setItem("key", "value");
    storage.removeItem("key");
    expect(storage.getItem("key")).toBeNull();
  });

  test("여러 데이터를 독립적으로 관리해야 한다.", () => {
    storage.setItem("key1", "value1");
    storage.setItem("key2", "value2");

    expect(storage.getItem("key1")).toBe("value1");
    expect(storage.getItem("key2")).toBe("value2");

    storage.removeItem("key1");
    expect(storage.getItem("key1")).toBeNull();
    expect(storage.getItem("key2")).toBe("value2");
  });
})