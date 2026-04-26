import type { Mock } from "vitest";
import { WebRTC } from "../src/lib/web-rtc.js";
import { DisconnectType, HandlerType, PeerDataType } from "../src/types/web-rtc.js";
import { getCommunicationData, getInitWebRtc, setupMockConnectionOnSpy, setupMockPeerOnSpy } from "./lib/web-rtc-helper.js";
import { MockConnection, MockPeer } from "./mock/mock-peerjs.js";
import type { Snapshot } from "../src/dto/snapshot.js";
import { peerLoader } from "../src/lib/peerLoader.js";

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

    test("초기화 도중 피어 객체에 Error 이벤트가 발생했을때 에러를 던져야 한다.", async () => {
      setupMockPeerOnSpy((event, cb)=>{
        if(event === "error"){
          cb(new Error("Error Test"));
          return;
        }
      });

      await expect(notInitWebRtc.init()).rejects.toThrow("Error Test");
    });

    test("초기화가 실패했을때 에러를 던져야 한다.", async () => {
      const MockPeerModule = await import("peerjs");
      
      vi.spyOn(MockPeerModule, "Peer").mockImplementation(function(){
        throw new Error("Constructor Error");
      });

      await expect(notInitWebRtc.init()).rejects.toThrow("Constructor Error");
    });

    test("다른 피어와 연결시 에러를 던져야 한다.", async () => {
      const { mockConnection } = setupMockPeerOnSpy();
      mockConnection.send = vi.fn();

      expect(() => notInitWebRtc.connect("test-peer")).toThrow("peer does not exist.");
    });

    test("초기화전 Destory가 호출되었을때 초기화 Promise는 reject되어야 한다.", async () => {
      const initPromise = notInitWebRtc.init();
      notInitWebRtc.destroy();

      await expect(initPromise).rejects.toThrow("[WebRtc] Destroyed");
    });

    test("peerjs 불러오기가 실패했을때 에러를 던져야 한다.", async () => {
      vi.spyOn(peerLoader, "load").mockRejectedValue(new Error("Import Error"));

      await expect(notInitWebRtc.init()).rejects.toThrow("Import Error");
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

  describe("시그널링 서버와의 연결이", () => {
    test("끊겼을때 재연결을 요청해야한다.", async () => {
      let openCB : Function = () => {};
      let disconnectCB : Function = () => {};

      setupMockPeerOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          openCB = cb;
          return;
        }

        if(event === "disconnected"){
          disconnectCB = cb;
          return;
        }
      });

      const mockPeer = await getInitWebRtc();

      const mockDisconnectHandler = vi.fn();
      mockPeer.setHandler('disconnect', mockDisconnectHandler);

      disconnectCB()

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.SIGNAL_FAIL);

      openCB();

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.SIGNAL_SUCCESS);
    });

    test("올바르게 종료되었을때 disconnect 이벤트에 종료 완료 메세지를 전달해야한다.", async () => {
      let openCB : Function = () => {};
      let disconnectCB : Function = () => {};
      let peerInstance : MockPeer | null = null;

      setupMockPeerOnSpy((event, cb, instance) => {
        peerInstance = instance;
        if(event === "open"){
          cb();
          openCB = cb;
          return;
        }

        if(event === "disconnected"){
          disconnectCB = cb;
          return;
        }
      });

      const mockPeer = await getInitWebRtc();

      const mockDisconnectHandler = vi.fn();
      mockPeer.setHandler('disconnect', mockDisconnectHandler);

      if(peerInstance){
        (peerInstance as MockPeer).destroy();
      }

      disconnectCB()

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.SUCCESS);
    });
  });

  describe("다른 피어와 연결이 끊겼을때" , () => {
    test("peer가 destoryed되어 있다면 연결해제 이벤트에 해제완료 메세지를 전달해야한다.", async () => {
      let closeCB : Function = () => {};
      let peerInstance : MockPeer | null = null;

      const {mockConnSpy} = setupMockPeerOnSpy((event, cb, instance) => {
        peerInstance = instance;
        if(event === "open"){
          cb();
          return;
        }
      })

      mockConnSpy.mockImplementation((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }

        if(event === "close"){
          closeCB = cb;
          return;
        }
      });

      const mockPeer = await getInitWebRtc({
        afterInit : (webRtc) => {
          webRtc.connect("test-peer");
          return webRtc;
        }
      });

      const mockDisconnectHandler = vi.fn();
      mockPeer.setHandler('disconnect', mockDisconnectHandler);

      if(peerInstance){
        (peerInstance as MockPeer).destroy();
      }

      closeCB();

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.SUCCESS);
    });

    test("설정한 재연결 시간이후 재연결을 해야 한다.", async () => {
      let closeCB : Function = () => {};
      setupMockConnectionOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }

        if(event === "close"){
          closeCB = cb;
          return;
        }
      });

      const reconnectTimeout = 3000;
      const mockPeer = await getInitWebRtc({
        webRtc : new WebRTC({
          reconnectTimeout
        }),
        afterInit : (webRtc) => {
          webRtc.connect("test-peer");
          return webRtc;
        }
      });
      
      const connectSpy = vi.spyOn(mockPeer, "connect");

      const mockDisconnectHandler = vi.fn();
      mockPeer.setHandler('disconnect', mockDisconnectHandler);

      const connectionsLength = mockPeer.connectionsLength;

      closeCB();

      expect(mockPeer.connectionsLength).toBe(connectionsLength - 1);

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.RECONNECT_RETRY);

      vi.advanceTimersByTime(reconnectTimeout);

      expect(connectSpy).toHaveBeenCalled();
    });

    test("설정한 재연결 시간이후 재연결을 해야 한다.", async () => {
      let closeCB : Function = () => {};
      let errorCB : Function = () => {};

      setupMockConnectionOnSpy((event, cb) => {
        if(event === "open"){
          cb();
          return;
        }

        if(event === "close"){
          closeCB = cb;
          return;
        }

        if(event === "error"){
          errorCB = cb;
          return;
        }
      });

      const reconnectTimeout = 3000;
      const mockPeer = await getInitWebRtc({
        webRtc : new WebRTC({
          reconnectTimeout,
          maxReconnectCount : 1
        }),
        afterInit : (webRtc) => {
          webRtc.connect("test-peer");
          return webRtc;
        }
      });
      
      vi.spyOn(mockPeer, "connect").mockImplementation(()=>{});

      const mockDisconnectHandler = vi.fn();
      mockPeer.setHandler('disconnect', mockDisconnectHandler);

      closeCB();

      vi.advanceTimersByTime(reconnectTimeout);

      errorCB();

      expect(mockDisconnectHandler).toHaveBeenCalledWith(DisconnectType.RECONNECT_FAIL);
    });
  });

  test("데이터 전송을 요청할때 오류 발생시 에러를 던져야 한다.", async () => {
    const { mockConnection } = setupMockPeerOnSpy();
    mockConnection.send = vi.fn();

    const webRtc = await getInitWebRtc({
      afterInit : (webRtc) => {
        webRtc.connect("test-peer");
        return webRtc;
      }
    });

    webRtc.setHandler("send", () => {
      throw new Error("Send Error");
    });

    const testSendData = {
      id : "test",
      table : "/users",
      data : {
        id : 1,
        name : "wonbeanie",
        age : 22
      }
    }

    expect(() => webRtc.send(testSendData)).toThrow("Send Error");
  });
});