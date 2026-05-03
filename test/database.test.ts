import type { Mock } from "vitest";
import { LiveDatabase } from "../src/lib/database.js";
import { MemoryStorage } from "../src/lib/memory-storage.js";
import { LightStorage } from "../src/lib/storage.js";
import type { WebRtcDispatchPayload } from "../src/types/web-rtc.js";
import { DB_PATH, type DatabaseData, type TableKey } from "../src/types/database.js";

describe("LiveDatabase 테스트", () => {
  let db : LiveDatabase;
  let mockStorage : LightStorage;
  let onUpdateCompleteSpy : Mock<() => void>;

  beforeEach(()=>{
    mockStorage = vi.mockObject(new LightStorage(new MemoryStorage()));
    mockStorage.getDatabase = vi.fn().mockReturnValue(new Map());
    
    db = new LiveDatabase(mockStorage);
    onUpdateCompleteSpy = vi.spyOn(db, "onUpdateComplete");
  });

  afterEach(() => {
    db.roomChief = false;
    vi.restoreAllMocks();
  });

  test("동기화를 위해 저장소에 요청해야 한다.", () => {
      db.syncDatabase({
        database : new Map(),
        updateTimestamp : 0
      });

      expect(mockStorage.syncStorage).toHaveBeenCalled();
      expect(onUpdateCompleteSpy).toHaveBeenCalled();
  });

  test("데이터가 변경시 구독된 리스너에게만 전달해야 한다.", async () => {
    const mockHandler = vi.fn();
    const mockData = {
      id : 1,
      name : "wonbeanie",
      age : 22
    }
    db.addDBListener("/users", mockHandler);
    db.onValue({
      id : "test",
      table : "/users",
      data : mockData
    });
    
    await vi.waitFor(() => {
      expect(mockHandler).toHaveBeenCalledWith(mockData);
    });

    db.removeDBListener("/users");
    db.onValue({
      id : "test",
      table : "/users",
      data : mockData
    });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  test("데이터 삭제시 리스너와 저장소에서 삭제되어야 한다", async () => {
    const mockHandler = vi.fn();
    const mockData = {
      id : 1,
      name : "wonbeanie",
      age : 22
    };

    db.addDBListener("/users", mockHandler);
    db.onValue({
      id : "test",
      table : "/users",
      data : mockData
    });

    await vi.waitFor(() => {
      expect(mockHandler).toHaveBeenCalledWith(mockData);
    });

    vi.spyOn(db, "updateDB").mockImplementation((table : TableKey = DB_PATH.ROOT, data : DatabaseData, clear = false)=>{
      return new Promise((resolve, reject) => {
        db.onValue({
          id : "test",
          table,
          data : {},
          clear : true
        });

        resolve({});
      })
    });

    db.removeTable("/users");
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockStorage.remove).toHaveBeenCalledWith("/users");
    expect(mockStorage.get("/users")).toBeUndefined();
  });

  test("루트 테이블을 지정하면 전부 초기화 되어야 한다.", () => {
    db.onValue({
      id : "test",
      table : DB_PATH.ROOT,
      data : {},
      clear : true
    });
    expect(mockStorage.clear).toHaveBeenCalled();
    expect(mockStorage.get(DB_PATH.ROOT)).toBeUndefined();
  })

  test("destry 호출 시 모든 리스너와 저장소를 정리해야 한다.", () => {
    db.destroy();
    expect(mockStorage.destroy).toHaveBeenCalled();
  });

  test("스냅샷을 요청할때 저장소에서 가져와야 한다.", () => {
    db.getSnapshot();
    expect(mockStorage.getSnapshot).toHaveBeenCalled();
  });

  test("데이터를 가져올때 저장소에서 가져와야 한다.", () => {
    db.database;
    expect(mockStorage.getDatabase).toHaveBeenCalled();
  });

  test("방장시 데이터를 업데이트하면 다른 사용자에게 변경사항을 전달해야 한다.", async () => {
    db.roomChief = true;
    const onSendSpy = vi.spyOn(db, "onSend");

    const mockData = {
      wonbeanie : {
        id : 1,
        name : "wonbeanie",
        age : 22
      },
      mons : {
        id : 2,
        name : "mons",
        age : 550
      }
    };

    await db.updateDB("/users", mockData);
    
    expect(mockStorage.set).toHaveBeenCalledWith("/users", mockData);
    expect(onSendSpy).toHaveBeenCalledOnce();
    expect(onSendSpy).toHaveBeenCalledWith({
      id : expect.any(String),
      table : "/users",
      data : mockData,
      clear : false
    });
    expect(onUpdateCompleteSpy).toHaveBeenCalled();
  });

  test("사용자시 데이터를 업데이트하면 방장에게 요청을 보내고 응답을 받을 때까지 대기해야 한다.", async () => {
    db.roomChief = false;
    const onSendSpy = vi.spyOn(db, "onSend").mockImplementation((data : WebRtcDispatchPayload) => {
      db.onValue(data);
    });

    const mockData = {
      wonbeanie : {
        id : 123,
        name : "wonbeanie",
        age : 22
      },
      mons : {
        id : 345,
        name : "mons",
        age : 550
      }
    }
    
    await db.updateDB("/users", mockData);
    expect(onSendSpy).toHaveBeenCalledOnce();
    expect(mockStorage.set).toHaveBeenCalledWith("/users", mockData);
  });

  test("데이터 업데이트시 시간이 초과되었을때 에러를 던져야 한다.", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    const promise = db.updateDB("/users", {
      wonbeanie : {
        id : 123,
        name : "wonbeanie",
        age : 22
      }
    });
    vi.advanceTimersByTime(5000);
    await expect(() => promise).rejects.toThrow("[Database] Database Update Failed:");
    vi.useRealTimers();
  });

  test("timeout 이후 늦게 도착한 update 응답은 저장소에 반영하지 않아야 한다.", async () => {
    vi.useFakeTimers();
    const timeoutDB = new LiveDatabase(mockStorage, {
      updateTimeout : 100
    });
    let sentPayload : WebRtcDispatchPayload | null = null;
    vi.spyOn(timeoutDB, "onSend").mockImplementation((data : WebRtcDispatchPayload) => {
      sentPayload = data;
    });

    const promise = timeoutDB.updateDB("/users", {
      id : 1,
      name : "wonbeanie"
    });

    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow("[Database] Database Update Failed:");

    if(sentPayload){
      timeoutDB.onValue(sentPayload);
    }

    expect(mockStorage.set).not.toHaveBeenCalled();
    timeoutDB.destroy();
    vi.useRealTimers();
  });

  test("외부에서 커스텀키를 수정하면 저장소에 전달하여야 한다.", () => {
    db.onSetStorageKey("TEST-KEY");
    expect(mockStorage.onSetStorageKey).toHaveBeenCalled();
  });

  test("구독된 리스너 실행 도중 에러가 발생하면 에러를 던져야 한다.", async () => {
    const errorDB = new LiveDatabase(mockStorage);

    const errorFn = vi.fn();
    errorDB.onError = errorFn;
    
    errorDB.addDBListener("/users", () => {
      throw new Error("/users Test Error");
    });
    
    errorDB.onValue({
      id : "test",
      table : "/users",
      data : {}
    })

    await vi.waitFor(() => {
      expect(errorFn).toHaveBeenCalled();
    });
  });

  test("update할 데이터에 null이 있다면 그 속성은 삭제되어야 한다.", async () => {

    const storageSetSpy = vi.spyOn(mockStorage, "set");

    const mockData = {
      id : 1,
      name : "wonbeanie",
      age : 22
    };

    db.onValue({
      id : "test",
      table : "/users",
      data : {
        ...mockData,
        age : null
      }
    });

    expect(storageSetSpy).toHaveBeenCalledWith("/users", {
      id : 1,
      name : "wonbeanie"
    });
  });

  test("업데이트 도중 업데이트가 발생했을 때 순서가 역전되지 않아야 한다.", async () => {
    const onSendSpy = vi.spyOn(db, "onSend");

    db.roomChief = true;
    let flag = false;
    db.addDBListener("/users", async () => {
      if(!flag){
        db.onValue({
          id : "test",
          table : "/users",
          data : {
            id : 1,
            name : "wonbeanie",
            age : 22
          }
        });
      }

      flag = true;
    });

    db.onValue({
      id : "test",
      table : "/users",
      data : {
        id : 2,
        name : "mons",
        age : 550
      }
    });

    await vi.waitFor(() => {
      expect(onSendSpy).toHaveBeenCalledTimes(2);
      expect(onSendSpy).toHaveBeenNthCalledWith(1, {
        id : "test",
        table : "/users",
        data : {
          id : 2,
          name : "mons",
          age : 550
        },
        clear : false
      });
      expect(onSendSpy).toHaveBeenNthCalledWith(2, {
        id : "test",
        table : "/users",
        data : {
          id : 1,
          name : "wonbeanie",
          age : 22
        },
        clear : false
      });
    });
  })
})
