import type { Mock } from "vitest";
import { WebRTC } from "../src/lib/web-rtc.js";
import { HandlerType, PeerDataType } from "../src/types/web-rtc.js";
import { getCommunicationData, getInitWebRtc, setupMockConnectionOnSpy, setupMockPeerOnSpy } from "./lib/web-rtc-helper.js";
import { MockConnection, MockPeer } from "./mock/mock-peerjs.js";
import type { Snapshot } from "../src/dto/snapshot.js";

describe("WebRTC 테스트", () => {
  beforeEach(async ()=>{
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("WebRTC가 초기화 전 테스트", () => {
    let notInitWebRtc : WebRTC;

    beforeEach(() => {
      notInitWebRtc = new WebRTC();
    });

    test("초기화 호출시 SSR, Node.js 환경에서는 에러를 던져야 한다.", async () => {
      vi.stubGlobal('window', undefined);
      await expect(notInitWebRtc.init()).rejects.toThrow("[WebRTC] SSR/Node.js environment detected.");
  
      vi.unstubAllGlobals();
    });
  
    test("초기화를 여러번 호출하여도 인스턴스를 생성하지 않고 동일한 Promise를 반환해야 한다.", async () => {
      const firstPromise = notInitWebRtc.init();
      const secondPromise = notInitWebRtc.init();
  
      expect(firstPromise).toStrictEqual(secondPromise);
  
      await Promise.all([firstPromise, secondPromise]);
    });
  });
  
  test("외부에서 주요 이벤트에 커스텀 핸들러를 설정 및 호출되어야 한다.", async () => {
    setupMockPeerOnSpy();
    
    const mockHandler = vi.fn();
    await getInitWebRtc({
      setup : webRtc => {
        webRtc.setHandler(HandlerType.CONNECTION, mockHandler);
        return webRtc;
      }
    });

    expect(mockHandler).toHaveBeenCalled();
  });

  describe("다른 피어와 연결시", () => {

    test("연결된 Peer 객체는 Connection 객체에 주요 이벤트가 등록되어야 한다.", async () => {
      const handler : Record<string, Function> = {};

      const { mockConnection } = setupMockPeerOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }
        handler[event] = cb;
      });

      await getInitWebRtc({
        afterInit : (webRtc) => {
          if(handler['connection']){
            handler['connection'](mockConnection);
          }
          return webRtc;
        }
      });

      expect(mockConnection.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test("연결을 요청한 Peer 객체는 Connection 객체에 주요 이벤트가 등록되어야 한다.", async () => {
      const { mockConnection } = setupMockPeerOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }
      });
      const connectSpy = vi.spyOn(MockPeer.prototype, 'connect').mockReturnValue(mockConnection);

      const webRtc = await getInitWebRtc({
        afterInit : (webRtc) => {
          webRtc.connect("test-peer");
          return webRtc;
        }
      });
  
      expect(connectSpy).toHaveBeenCalledWith("test-peer");
      expect(mockConnection.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));

      expect(webRtc.connectionsLength).toBe(1);
    });

    test("방장은 스냅샷을 연결된 피어에게 보내야 한다.", async () => {
      const { mockConnection } = setupMockPeerOnSpy();
      mockConnection.send = vi.fn();

      let onGetSnapshotSpy : Mock<() => Snapshot> = vi.fn();
      await getInitWebRtc({
        setup: (webRtc) => {
          onGetSnapshotSpy = vi.spyOn(webRtc, "onGetSnapshot");
          webRtc.onGetIsRoomChief = () => true;
          return webRtc;
        },
        afterInit : (webRtc) => {
          webRtc.connect("test-peer");
          return webRtc;
        }
      });
  
      expect(onGetSnapshotSpy).toHaveBeenCalled();
      expect(mockConnection.send).toHaveBeenCalled();
    });

    test.each([
      {
        type : PeerDataType.SYNC,
        handlerName : "onSyncDatabase",
        event : "sync",
        
      },
      {
        type : PeerDataType.UPDATE,
        handlerName : "onUpdateDatabase",
        event : "update"
      }
    ])("연결된 피어로부터 $event 데이터를 받으면 $handlerName가 호출되어야 한다.", async ({
      type,
      handlerName
    }) => {
      const { mockConnection } = setupMockConnectionOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }

        if(event === "data"){
          cb(getCommunicationData(type));
          return;
        }
      });

      vi.spyOn(MockPeer.prototype, 'connect').mockReturnValue(mockConnection);

      let spy = vi.fn();
      await getInitWebRtc({
        afterInit : (webRtc) => {
          spy = vi.spyOn(webRtc, handlerName as "onUpdateDatabase" | "onSyncDatabase");
          webRtc.connect("test-peer");
          return webRtc;
        }
      });

      expect(spy).toHaveBeenCalled();
    });
  });

  test("다른 피어에게 데이터를 전송할 수 있어야 한다.", async () => {
    const { mockConnection } = setupMockPeerOnSpy();
    mockConnection.send = vi.fn();

    await getInitWebRtc({
      afterInit : (webRtc) => {
        webRtc.send({
          id : "test",
          table : "/users",
          data : {
            id : 1,
            name : "wonbeanie",
            age : 22
          }
        });
        return webRtc;
      }
    });

    expect(mockConnection.send).toHaveBeenCalled();
  });

  test("destory 호출 시 모든 connection, Peer, Promise, 리스너를 정리해야 한다.", async () => {
    setupMockPeerOnSpy();

    const mockPeer = await getInitWebRtc();

    const mockDestroySpy = vi.spyOn(MockPeer.prototype, 'destroy');
    const mockCloseSpy = vi.spyOn(MockConnection.prototype, 'close');

    mockPeer.destroy();

    expect(mockDestroySpy).toHaveBeenCalled();
    expect(mockCloseSpy).toHaveBeenCalled();
  });

});