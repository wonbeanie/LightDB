import { Snapshot } from "../src/dto/snapshot.js";
import { LightDBEngine } from "../src/lib/engine.js";
import { DB_PATH } from "../src/types/database.js";
import { HandlerType } from "../src/types/web-rtc.js";

describe("engine 테스트", () => {
  let engine : LightDBEngine;
  
  beforeEach(() => {
    engine = new LightDBEngine();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  })

  test("데이터베이스가 업데이트되면 엔진은 onUpdateComplete를 호출해야 한다.", () => {
    const updateSpy = vi.spyOn(engine, "onUpdateComplete");

    const mockData = { users: { id: 1, name: "test"} };
    vi.spyOn(engine.db, "database", "get").mockReturnValue(mockData);
    engine.db.roomChief = true;

    engine.db.onUpdateComplete();
    
    expect(engine.database).toEqual(mockData);
    expect(engine.roomChief).toBe(true);
    expect(engine.updateTimestamp).not.toBe("");
    expect(updateSpy).toHaveBeenCalled();
  });

  test("커스텀 키를 스토리지에 전달할 수 있어야 한다.", () => {
    const dbSpy = vi.spyOn(engine.db, "onSetStorageKey")

    engine.onSetStorageKey("TEST-KEY");
    expect(dbSpy).toHaveBeenCalledWith("TEST-KEY");
  });

  test("방 생성시 WebRtc를 초기화하고 방장 상태가 되어야 한다.", async () => {
    const mockPeerId = "test-peer-id";
    const initSpy = vi.spyOn(engine.rtc, "init").mockResolvedValue(mockPeerId);
    const updateSpy = vi.fn();
    engine.onUpdateComplete = updateSpy;

    await engine.createRoom();

    expect(initSpy).toHaveBeenCalled();
    expect(engine.roomChief).toBe(true);
    expect(engine.db.roomChief).toBe(true);
    expect(engine.roomId).toBe(mockPeerId);
    expect(updateSpy).toHaveBeenCalled();
  });

  test("방 입장시 WebRtc를 초기화하고 룸에 연결을 요청해야한다.", async () => {
    const mockPeerId = "test-peer-id";
    const initSpy = vi.spyOn(engine.rtc, "init");
    const connectSpy = vi.spyOn(engine.rtc, "connect").mockResolvedValue(true);
    const updateSpy = vi.fn();
    engine.onUpdateComplete = updateSpy;

    await engine.joinRoom(mockPeerId);

    expect(initSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalledWith(mockPeerId);
    expect(engine.roomId).toBe(mockPeerId);
    expect(updateSpy).toHaveBeenCalled();
  });

  test("데이터베이스의 변경사항 구독과 해제을 요청할수 있어야 한다.", () => {
    const addDBListenerSpy = vi.spyOn(engine.db, "addDBListener");
    const removeDBListenerSpy = vi.spyOn(engine.db, "removeDBListener");

    const mockTable = "/users";
    const mockHandler = vi.fn();

    engine.on(mockTable, mockHandler);

    expect(addDBListenerSpy).toHaveBeenCalledWith(mockTable, mockHandler);

    engine.off(mockTable);

    expect(removeDBListenerSpy).toHaveBeenCalledWith(mockTable);
  });

  test("데이터베이스의 Update, Remove, Clear를 요청할수 있어야 한다.", async () => {
    const updateDBSpy = vi.spyOn(engine.db, "updateDB").mockResolvedValue({});
    const removeTableSpy = vi.spyOn(engine.db, "removeTable").mockResolvedValue({});;

    const mockTable = "/users";
    const mockData = {
      id : 1,
      name : "wonbeanie",
      age : 22
    };

    await engine.update(mockTable, mockData);
    expect(updateDBSpy).toHaveBeenCalledWith(mockTable, mockData);

    await engine.remove(mockTable);
    expect(removeTableSpy).toHaveBeenCalledWith(mockTable);

    updateDBSpy.mockClear();

    await engine.clear();
    expect(updateDBSpy).toHaveBeenCalledWith(DB_PATH.ROOT, {}, true);
  });

  test("WebRtc의 변경사항 구독과 해제을 요청할수 있어야 한다.", () => {
    const setHandlerSpy = vi.spyOn(engine.rtc, "setHandler");

    const mockType = HandlerType.MESSAGE;
    const mockHandler = vi.fn();

    engine.onPeer(mockType, mockHandler);

    expect(setHandlerSpy).toHaveBeenCalledWith(mockType, mockHandler);

    setHandlerSpy.mockClear();
    engine.offPeer(mockType);

    expect(setHandlerSpy).toHaveBeenCalledWith(mockType, expect.any(Function));
  });

  test("destory 호출 시 WebRtc, Database를 정리하고 변수들을 초기화해야한다.", () => {
    const destroySpy = vi.spyOn(engine.db, "destroy");
    const rtcDestroySpy = vi.spyOn(engine.rtc, "destroy");

    engine.destroy();

    expect(destroySpy).toHaveBeenCalled();
    expect(rtcDestroySpy).toHaveBeenCalled();
    expect(engine.roomId).toBeNull();
    expect(engine.database).toEqual({});
    expect(engine.roomChief).toBe(false);
  });

  test("방 생성 도중 오류 발생시 에러를 던져야 한다.", async () => {
    vi.spyOn(engine.rtc, "init").mockRejectedValue(new Error("Error Test"));

    await expect(engine.createRoom()).rejects.toThrow("[LightDB] Create Room Failed:");
  });

  test("방 입장 도중 오류 발생시 에러를 던져야 한다.", async () => {
    const mockTestId = "test-peer-id";
    vi.spyOn(engine.rtc, "init").mockResolvedValue(mockTestId);
    vi.spyOn(engine.rtc, "connect").mockImplementation(() => {
      throw new Error("Error Test");
    });

    await expect(engine.joinRoom(mockTestId)).rejects.toThrow("[LightDB] Join Room Failed:");
  });

  test("생성자 콜백 함수들 강제 실행", () => {
    const sendSpy = vi.spyOn(engine.rtc, "send").mockImplementation(() => {})
    engine.db.onSend({id : "1", table : "/users", data : {}});
    expect(sendSpy).toHaveBeenCalled();

    const snapshotSpy = vi.spyOn(engine.db, "getSnapshot").mockImplementation(() => new Snapshot(new Map()))
    engine.rtc.onGetSnapshot();
    expect(snapshotSpy).toHaveBeenCalled();

    const onValueSpy = vi.spyOn(engine.db, "onValue").mockImplementation(() => {})
    engine.rtc.onUpdateDatabase({id : "1", table : "/users", data : {}});
    expect(onValueSpy).toHaveBeenCalled();
    
    const syncSpy = vi.spyOn(engine.db, "syncDatabase").mockImplementation(() => {})
    engine.rtc.onSyncDatabase({
      database : new Map(),
      updateTimestamp : 0
    });
    expect(syncSpy).toHaveBeenCalled();

    engine.db.roomChief = true;
    const resultTrue = engine.rtc.onGetIsRoomChief();
    expect(resultTrue).toBe(true);

    engine.db.roomChief = false;
    const resultFalse = engine.rtc.onGetIsRoomChief();
    expect(resultFalse).toBe(false);
  });
});