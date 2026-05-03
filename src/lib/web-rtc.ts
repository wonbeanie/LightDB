import type { DataConnection, Peer as PeerType } from "peerjs";
import { errorHandler } from "./utils.js";
import { Snapshot } from "../dto/snapshot.js";
import type { SnapshotPayload } from "../types/database.js";
import { createPeerData } from "../dto/peer-data.js";
import { DisconnectType, HandlerType, PeerDataType, SignalReconnectType, type Connections, type InitPromise, type PeerEventMap, type PeerID, type ResponseData, type WebRtcConfig, type WebRtcDispatchPayload } from "../types/web-rtc.js";
import { peerLoader } from "./peerLoader.js"
import { ErrorType } from "../types/utils.js";

/**
 * PeerJS를 이용한 WebRtc 통신을 하는 클래스
 * @remarks 방장은 모든 사용자들과 연결되고, 사용자들은 방장만 연결되는 구조입니다.
 */
export class WebRTC {
  
  /**
   * 사용자와의 연결을 관리하기 위한 객체
   */
  private connections : Connections = {};

  private peerId : PeerID | null = null;

  /**
   * PeerJS의 {@link PeerType} 객체
   */
  private peer: PeerType | null = null;

  /**
   * Peer 인스턴스의 초기화 상태를 나타내는 Promise
   */
  private initPromise : InitPromise | null = null;

  /**
   * 재연결 횟수를 관리하는 Map 객체
   */
  private reconnectCount = new Map<PeerID, number>();

  /**
   * 최대 재연결 횟수를 설정하는 변수
   * @remarks 외부에서 설정을 통해 변경될수 있습니다.
   */
  private maxReconnectCount = 5;

  /**
   * 재연결 시도 간격을 설정하는 변수
   * @remarks 외부에서 설정을 통해 변경될수 있습니다.
   */
  private reconnectTimeout = 5000;

  private signalReconnectCount = 0;

  private signalReconnectTimeoutId : number | null = null;

  /**
   * PeerJS의 주요 이벤트 발생 시 실행될 외부 커스텀 핸들러 모음
   */
  private customHandlers : PeerEventMap = {
    connection : () => {},
    close : () => {},
    message : () => {},
    send : () => {},
    error : () => {},
    disconnect : () => {},
    signalReconnect : () => {},
  };

  /**
   * 시그널링 서버 재연결시 Open 이벤트 중복 실행되지 않기 위한 플래그 변수
   */
  private signalReconnected = false;

  /**
   * 데이터베이스에 업데이트를 요청하는 메서드
   * @remarks 명시적 콜백을 위한 메서드
   */
  public onUpdateDatabase : (data : WebRtcDispatchPayload) => void = () => {};

  /**
   * 최신 스냅샷을 가져오기 위한 메서드
   * @remarks 명시적 콜백을 위한 메서드
   * @returns 저장소에서 가져온 최신 스냅샷
   */
  public onGetSnapshot : () => Snapshot = () => (new Snapshot(new Map()));

  /**
   * 데이터베이스 동기화 요청 메서드
   * @remarks 명시적 콜백을 위한 메서드
   */
  public onSyncDatabase : (snapshot : Snapshot) => void = () => {};

  /**
   * 방장 상태를 확인하기 위한 메서드
   * @remarks 명시적 콜백을 위한 메서드
   * @returns 방장 상태인 경우 True
   */
  public onGetIsRoomChief : () => boolean = () => false;

  /**
   * 저장소를 초기화하기 위한 메서드
   * @remarks 명시적 콜백을 위한 메서드
   */
  public onStorageClear : () => void = () => {};

  /**
   * 새로운 WebRtc 인스턴스를 생성
   * @param [config] - 외부 커스텀 {@link WebRtcConfig} 객체 (선택 사항)
   */
  constructor(config : WebRtcConfig = {}){
    this.maxReconnectCount = config?.maxReconnectCount ?? this.maxReconnectCount;
    this.reconnectTimeout = config?.reconnectTimeout ?? this.reconnectTimeout;
  }

  /**
   * peer 객체의 초기 세팅을 위한 메서드
   * @remarks PeerJS의 인스턴스 생성 및 주요 핵심 이벤트를 연결합니다.
   * @param resetStorage 기존에 저장된 저장소를 초기화하여 시작할지 여부 (기본값 : false)
   * @returns 초기화 상태 확인을 위한 {@link initPromise}
   * @throws SSR/Node.js 환경과 {@link RTCPeerConnection}이 없을때 발생합니다.
   */
  public async init(resetStorage = false){
    if(typeof window === 'undefined' && !globalThis.RTCPeerConnection){
      throw new Error(
        "[WebRTC] SSR/Node.js environment detected. " +
        "WebRTC requires a browser or a polyfill (like 'wrtc' or 'node-datachannel')."
      )
    }

    if(this.initPromise) return this.initPromise.promise;
    if(this.peer) return Promise.resolve(this.peerId);
    
    if(resetStorage){
      this.onStorageClear();
    }

    const { promise, resolve, reject } = Promise.withResolvers<PeerID>();

    this.initPromise = {
      promise,
      resolve,
      reject
    };

    this.startPeerSetup(resolve, reject);

    return promise;
  }

  private async startPeerSetup(resolve : (peerId : PeerID) => void, reject : (err: Error) => void){
    let PeerModule;

    try {
      PeerModule = await peerLoader.load()
    }
    catch(error){
      this.resetPeerState();
      return reject(errorHandler(ErrorType.WEBRTC, `Peerjs Import Failed:`, error));
    }

    try{
      const Peer = PeerModule.Peer || PeerModule.default;

      const peer = new Peer();
      this.peer = peer;

      peer.on('open', (id) => {
        if(this.signalReconnected){
          this.peerId = id;
          this.signalReconnected = false;
          this.signalReconnectCount = 0;
          this.customHandlers.signalReconnect(SignalReconnectType.SUCCESS);
          return;
        }
        this.peerId = id;
        this.initPromise = null;
        resolve(id);
      });
    
      peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });
  
      peer.on('error', (err) => {
        const handledError = errorHandler(ErrorType.WEBRTC, "Peer connection error:", err);
        if(this.initPromise){
          reject(handledError);
          this.resetPeerState();
          return;
        }

        this.customHandlers.error(handledError);
      });

      peer.on("disconnected", () => {
        if(peer.destroyed){
          this.customHandlers.disconnect(DisconnectType.SUCCESS);
          return;
        }
        
        this.customHandlers.signalReconnect(SignalReconnectType.RETRY);
        this.scheduleSignalReconnect();
      });

    }
    catch(error){
      this.resetPeerState();
      reject(errorHandler(ErrorType.WEBRTC, `WebRtc Initialization Failed:`, error));
    }
  }

  private scheduleSignalReconnect(){
    if(!this.peer || this.peer.destroyed){
      this.customHandlers.signalReconnect(SignalReconnectType.FAIL);
      return;
    }

    if(this.signalReconnectTimeoutId !== null){
      return;
    }

    if(this.signalReconnectCount >= this.maxReconnectCount){
      this.signalReconnected = false;
      this.signalReconnectCount = 0;
      this.customHandlers.signalReconnect(SignalReconnectType.FAIL);
      return;
    }

    this.signalReconnected = true;
    this.signalReconnectTimeoutId = setTimeout(() => {
      this.signalReconnectTimeoutId = null;
      if(!this.peer || this.peer.destroyed){
        this.customHandlers.signalReconnect(SignalReconnectType.FAIL);
        return;
      }

      try{
        this.signalReconnectCount += 1;
        this.peer.reconnect();
      }
      catch(error){
        this.customHandlers.error(errorHandler(ErrorType.WEBRTC, "Signal Reconnect Failed:", error));
        this.scheduleSignalReconnect();
      }
    }, this.reconnectTimeout);
  }

  /**
   * 다른 Peer와 연결되었을때 호출되어 주요 이벤트를 연결하는 메서드
   * @param conn - 연결된 Peer {@link DataConnection} 객체
   */
  private handleConnection = async (conn : DataConnection) => {
    if (this.connections[conn.peer]) return Promise.resolve(true);

    let timeout : number | null = null;

    const promise = new Promise((resolve, reject) => {
      conn.on('open', () => {
        this.connections[conn.peer] = conn;
        this.reconnectCount.set(conn.peer, 0);
  
        this.customHandlers.connection(conn.peer);
        if(this.onGetIsRoomChief()){
          this.syncDatabase(conn.peer);
          resolve(true);
        }
      });

      if(conn.listenerCount('data') === 0){
        conn.on('data', (response) => {
          const peerData = response as ResponseData;
          if(peerData.type === PeerDataType.SYNC){
            this.onSyncDatabase(Snapshot.deserialize(peerData.data));
            resolve(true);
          }
          else {
            this.onUpdateDatabase(peerData.data);
          }
          this.customHandlers.message(peerData);
        });
      }
  
      if(conn.listenerCount('close') === 0){
        conn.on('close', () => {
          this.handleDisconnect(conn.peer, () => {
            this.customHandlers.close(conn.peer);
          });
        });
      }
  
      if(conn.listenerCount('error') === 0){
        conn.on('error', (err) => {
          this.handleDisconnect(conn.peer, ()=>{
            this.customHandlers.error(err);
          });
        });
      }

      timeout = setTimeout(() => {
        reject(errorHandler(ErrorType.WEBRTC, "Connection Timeout"));
      }, 5000);
    });

    const complete = await promise;

    if(complete && timeout){
      clearTimeout(timeout);
    }

    return complete;
  }

  /**
   * 방장인 경우 연결된 Peer에 스냅샷 전송하는 메서드
   * @param peerId 전송할 Peer 아이디
   */
  private syncDatabase(peerId : PeerID){
    const snapshot = this.onGetSnapshot();
    const conn = this.connections[peerId];
    if(conn){
      const sendData = createPeerData<SnapshotPayload>(Snapshot.serialize(snapshot), this.peerId!, PeerDataType.SYNC);
      conn.send(sendData);
    }
  }

  /**
   * 외부에서 설정하기 위한 핸들러 설정 메서드
   * @param event - 설정할 핵심 이벤트 {@link HandlerType}
   * @param handler - 할당할 핸들러 {@link PeerEventMap}
   */
  public setHandler<K extends HandlerType>(event: K, handler : PeerEventMap[K]){
    this.customHandlers[event] = handler;
  }

  /**
   * 연결 정보를 정리하고 재연결을 시도하는 메서드
   * @param peerId - 연결이 끊긴 Peer 아이디
   * @param endDisconnect - 재연결 실패, 재연결 완료등 마무리 되었을때 호출되는 메서드
   */
  private handleDisconnect(peerId : PeerID, endDisconnect : () => void = () => {}) {
    const {[peerId] : disconnectPeer, ...rest} = this.connections;
    this.connections = rest;

    if(!this.peer || this.peer.destroyed){
      this.customHandlers.disconnect(DisconnectType.SUCCESS);
      endDisconnect();
      return;
    }

    const reconnectCount = this.reconnectCount.get(peerId) || 0;
    if(reconnectCount === this.maxReconnectCount){
      this.reconnectCount.delete(peerId);
      this.customHandlers.disconnect(DisconnectType.RECONNECT_FAIL);
      endDisconnect();
      return;
    }
    
    this.customHandlers.disconnect(DisconnectType.RECONNECT_RETRY);
    setTimeout(() => {
      this.reconnectCount.set(peerId, reconnectCount + 1);
      this.connect(peerId);
    }, this.reconnectTimeout);
  }

  /**
   * 연결된 모든 피어들에게 데이터를 전송하는 메서드
   * @param data - 피어들에게 보낼 {@link WebRtcDispatchPayload} 객체
   */
  public send(data : WebRtcDispatchPayload){
    try{
      const sendData = createPeerData<WebRtcDispatchPayload>(data, this.peerId!, PeerDataType.UPDATE);

      for(const conn of Object.values(this.connections)){
        if(conn.open) {
          conn.send(sendData)
        }
      }

      this.customHandlers.send(sendData);
    }
    catch(error){
      throw errorHandler(ErrorType.WEBRTC, `Send Failed:`, error);
    }
  }

  /**
   * 다른 피어와 연결을 요청하는 메서드
   * @param targetId 연결할 Peer 아이디
   * @throws 현재 피어가 존재(초기화)하지 않을때 발생합니다.
   */
  public connect(targetId : PeerID){
    try{
      if(!this.peer){
        throw new Error("peer does not exist.");
      }
      const conn = this.peer.connect(targetId);
      return this.handleConnection(conn);
    }
    catch(error){
      throw errorHandler(ErrorType.WEBRTC, `Connect Failed:`, error);
    }
  }

  /**
   * 메모리 할당 해제를 위한 메서드
   * @remark 연결된 모든 피어들을 Close 처리됩니다.
   */
  public destroy(){
    if(this.signalReconnectTimeoutId !== null){
      clearTimeout(this.signalReconnectTimeoutId);
      this.signalReconnectTimeoutId = null;
    }

    Object.values(this.connections).forEach(conn => conn.close());
    this.connections = {};

    if(this.peer){
      this.peer.destroy();
    }

    if(this.initPromise){
      this.initPromise.reject(errorHandler(ErrorType.WEBRTC,'Destroyed'));
    }

    this.customHandlers = {
      connection: () => {},
      close: () => {},
      message: () => {},
      send: () => {},
      error: () => {},
      disconnect: () => {},
      signalReconnect: () => {},
    };
    
    this.resetPeerState();
  }

  private resetPeerState() {
    this.initPromise = null;
    this.peer = null;
    this.peerId = null;
    this.signalReconnected = false;
    this.signalReconnectCount = 0;
    if(this.signalReconnectTimeoutId !== null){
      clearTimeout(this.signalReconnectTimeoutId);
      this.signalReconnectTimeoutId = null;
    }
  }

  get connectionsLength(){
    return Object.keys(this.connections).length;
  }
}
