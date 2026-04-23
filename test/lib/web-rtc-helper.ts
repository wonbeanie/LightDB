import { WebRTC } from "../../src/lib/web-rtc.js";
import type { PeerDataType } from "../../src/types/web-rtc.js";
import { MockConnection, MockPeer } from "../mock/mock-peerjs.js";

export async function getInitWebRtc(config : {
  setup ?: (webRtc : WebRTC) => WebRTC,
  afterInit ?: (webRtc : WebRTC) => WebRTC,
  webRtc ?: WebRTC
} = {}){
  const webRtc = config.webRtc ?? new WebRTC();
  const setupWebRtc = config.setup ? config.setup(webRtc) : webRtc;

  await setupWebRtc.init();

  const initWebRTc = config.afterInit ? config.afterInit(setupWebRtc) : setupWebRtc;

  vi.advanceTimersByTime(10);

  return initWebRTc;
}

export function setupMockPeerOnSpy(setup ?: (event : string, cb : Function, peerInstance : MockPeer) => void){
  const {mockConnection , spy : mockConnSpy} = setupMockConnectionOnSpy();
  const spy = vi.spyOn(MockPeer.prototype, "on").mockImplementation(function(this : MockPeer, event : string, cb : Function){
    const peerInstance = this;
    if(setup){
      setup(event, cb, peerInstance);
      return;
    }

    if(event === "open"){
      cb('mock-peer-id');
      return;
    }

    if(event === "connection"){
      cb(mockConnection);
      return;
    }
  });

  return {
    mockPeerSpy : spy,
    mockConnection,
    mockConnSpy
  }
}

export function setupMockConnectionOnSpy(setup ?: (event : string, cb : Function) => void){
  const mockConnection = new MockConnection();
  const spy = vi.spyOn(MockConnection.prototype, "on").mockImplementation(function(event : string, cb : Function){
    if(setup){
      setup(event, cb);
      return;
    }

    if(mockConnection.listener.has(event)){
      const listenerList = mockConnection.listener.get(event) ?? [];
      listenerList.push(cb);
      mockConnection.listener.set(event, listenerList);
    }
    else {
      mockConnection.listener.set(event, [cb]);
    }

    if(event === "open"){
      mockConnection.open = true;
      cb();
      return;
    }
  });

  return {
    mockConnection,
    spy
  };
}

export function getCommunicationData(type : PeerDataType){
  return {
    data : {
      database : [],
      updateTimestamp : 1000
    },
    timestamp : 1000,
    senderId : "sender-id",
    type
  }
}