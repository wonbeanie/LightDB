import { LightDB } from "../src/index.js";
import { LightDBEngine } from "../src/lib/engine.js";
import { HandlerType } from "../src/types/web-rtc.js";

vi.mock("../src/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof LightDBEngine>();
  return {
    ...actual,
    LightDBEngine: vi.fn().mockImplementation(function(){
      return {
        database : {},
        roomChief : false,
        roomId : "",
        updateTimestamp : "",
        onUpdateComplete: () => {},
        createRoom : vi.fn().mockResolvedValue("test-peer-id"),
        onSetStorageKey : (key: string) => {},
      };
    }),
  };
});

describe("Entry 테스트", () => {

  afterEach(() => {
    vi.clearAllMocks();
  })

  describe("모킹된 엔진으로 테스트",() => {
    let mockEngineLightDB : LightDB;
    let mockEngine : LightDBEngine;

    beforeEach(() => {
      vi.clearAllMocks();
      mockEngineLightDB = new LightDB();
      mockEngine = vi.mocked(LightDBEngine).mock.results[0]?.value;
    });
    
    test("엔진의 상태가 변경되면 LightDB의 프로퍼티들도 업데이트되어야 한다.", async () => {
      const mockData = {
        users : {
          monster : {
            id : 1,
            name : "mons",
            age : 550
          }
        }
      };
      vi.spyOn(mockEngine, "database", "get").mockReturnValue(mockData);

      mockEngine.roomChief = true;
      mockEngine.roomId = 'test-peer-id';
      mockEngine.updateTimestamp = "2026-04-25 18:31:22";

      mockEngine.onUpdateComplete();

      expect(mockEngineLightDB.database).toEqual(mockData);
      expect(mockEngineLightDB.roomChief).toBe(true);
      expect(mockEngineLightDB.roomId).toBe('test-peer-id');
      expect(mockEngineLightDB.updateTimestamp).toBe("2026-04-25 18:31:22");
    });

    test("createRoom 호출 시 storageKey가 있으면 엔진의 onSetStorageKey 먼저 호출해야 한다.", async () => {
      const keySpy = vi.spyOn(mockEngine, "onSetStorageKey");

      await mockEngineLightDB.createRoom("test-peer-id");

      expect(keySpy).toHaveBeenCalledWith("test-peer-id");
      expect(mockEngine.createRoom).toHaveBeenCalled();

      keySpy.mockClear();

      await mockEngineLightDB.createRoom();
  
      expect(keySpy).not.toHaveBeenCalledWith("test-peer-id");
      expect(mockEngine.createRoom).toHaveBeenCalled();
    });
  });

  describe("실제 엔진 테스트", () => {
    let lightDB : LightDB;
    let OriginEngine : typeof LightDBEngine;

    beforeEach(async () => {
      const {LightDBEngine : engine} : {LightDBEngine : typeof LightDBEngine} = await vi.importActual("../src/lib/engine");

      OriginEngine = engine

      vi.mocked(LightDBEngine).mockImplementation(function(...args){
        return new OriginEngine(...args);
      });
      lightDB = new LightDB();
    });

    afterEach(() => {
      vi.clearAllMocks();
    })

    test("데이터베이스 이벤트 구독 및 해제 요청이 엔진으로 위임되어야 한다.", () => {

      const onSpy = vi.spyOn(OriginEngine.prototype, "on");
      const offSpy = vi.spyOn(OriginEngine.prototype, "off");
      const mockHandler = () => {};

      lightDB.on("/users", mockHandler);
      expect(onSpy).toHaveBeenCalledWith("/users", mockHandler);

      lightDB.off("/users");
      expect(offSpy).toHaveBeenCalledWith("/users");
    });

    test("피어 이벤트 구독 및 해제 요청이 엔진으로 위임되어야 한다.", () => {
      const onSpy = vi.spyOn(OriginEngine.prototype, "onPeer");
      const offSpy = vi.spyOn(OriginEngine.prototype, "offPeer");
      const mockHandler = () => {};

      lightDB.onPeer(HandlerType.MESSAGE, mockHandler);
      expect(onSpy).toHaveBeenCalledWith(HandlerType.MESSAGE, mockHandler);

      lightDB.offPeer(HandlerType.MESSAGE);
      expect(offSpy).toHaveBeenCalledWith(HandlerType.MESSAGE);
    });

    test("destory 호출 시 엔진의 리소스를 정리해야 한다.", () => {
      const destorySpy = vi.spyOn(OriginEngine.prototype, "destroy");

      lightDB.destroy();
      expect(destorySpy).toHaveBeenCalled();
    });

    test("데이터 업데이트 및 삭제 요청이 엔진으로 올바르게 위임되어야 한다.", async () => {
      const updateSpy = vi.spyOn(OriginEngine.prototype, "update").mockResolvedValue({});
      const clearSpy = vi.spyOn(OriginEngine.prototype, "clear").mockResolvedValue({});
      const removeSpy = vi.spyOn(OriginEngine.prototype, "remove").mockResolvedValue({});
    
      await lightDB.update("/users", { name: "mons" });
      expect(updateSpy).toHaveBeenCalledWith("/users", { name: "mons" });

      await lightDB.clear();
      expect(clearSpy).toHaveBeenCalled();
    
      await lightDB.remove("/users");
      expect(removeSpy).toHaveBeenCalledWith("/users");
    });

    test("joinRoom 요청시 엔진으로 올바르게 위임되어야 한다.", async () => {
      const joinRoomSpy = vi.spyOn(OriginEngine.prototype, "joinRoom").mockResolvedValue();
    
      await lightDB.joinRoom("test-peer-id");
      expect(joinRoomSpy).toHaveBeenCalledWith("test-peer-id");
    });
  })
});