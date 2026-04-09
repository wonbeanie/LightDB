import { DataConnection, Peer } from "peerjs";
import { EVENT_LIST, type EventMap } from "./lib/event-list.js";
import type { Connections, PeerEventMap, PeerData, PeerID, WebRtcDispatchPayload, HandlerType } from "./lib/type/web-rtc.js";
import { errorHandler } from "./lib/utils.js";
import type { EventBus } from "./lib/event-bus.js";

export class WebRTC {
  private connections : Connections = {};
  private peerId : PeerID | null = null;
  private peer: Peer | null = null;
  private initPromise : Promise<PeerID> | null = null;
  private reconnectCount = new Map<PeerID, number>();
  maxReconnectCount = 5;
  reconnectTimeout = 5000;
  customHandlers : PeerEventMap = {
    connection : () => {},
    close : () => {},
    message : () => {},
    send : () => {},
    error : () => {}
  };

  constructor(private eventBus: EventBus<EventMap>){
    this.eventBus.on(EVENT_LIST.REQUEST_PEER_SEND, (data : WebRtcDispatchPayload) => this.send(data));
    this.eventBus.on(EVENT_LIST.REQUEST_PEER_CONNECT, (data : PeerID) => this.connect(data));
    this.eventBus.on(EVENT_LIST.ON_LISTENER, ({event, handler}) => this.setHandler(event, handler));
    this.eventBus.on(EVENT_LIST.OFF_LISTENER, (event) => this.setHandler(event, () => {}));
    this.eventBus.on(EVENT_LIST.SET_WEBRTC_CONFIG, (config) => {
      this.maxReconnectCount = config?.maxReconnectCount ?? this.maxReconnectCount;
      this.reconnectTimeout = config?.reconnectTimeout ?? this.reconnectTimeout;
    });
  }

  private setHandler<K extends HandlerType>(event: K, handler : PeerEventMap[K]){
    this.customHandlers[event] = handler;
  }

  init(){
    if(this.initPromise) return this.initPromise;
    if(this.peer) return Promise.resolve(this.peerId);
    this.initPromise = new Promise((resolve, reject)=>{
      const peer = new Peer();
      this.peer = peer;

      peer.on('open', (id) => {
        this.peerId = id;
        this.initPromise = null;
        resolve(id);
      });
    
      peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });
  
      peer.on('error', (err) => {
        reject(err);
        this.peer = null;
        this.initPromise = null;
        throw errorHandler(err);
      });

      peer.on("disconnected", () => {
        this.handleDisconnect(peer.id);
      });
    })

    return this.initPromise;
  }

  private handleConnection = (conn : DataConnection) => {
    if (this.connections[conn.peer]) return;
    conn.on('open', () => {
      this.connections[conn.peer] = conn;
      this.reconnectCount.set(conn.peer, 0);

      if(conn.listenerCount('data') === 0){
        conn.on('data', (response) => {
          const {data} = response as PeerData;
          this.eventBus.emit(EVENT_LIST.UPDATE_DATABASE, data);
          this.customHandlers.message(response);
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

      this.customHandlers.connection(conn.peer);
    });
  }

  handleDisconnect(peerId : PeerID, endDisconnect : () => void = () => {}) {
    delete this.connections[peerId];

    if(this.peer && this.peer.destroyed){
      console.log("서버와 정상적으로 연결이 끊겼습니다.");
      endDisconnect();
      return;
    }

    const reconnectCount = this.reconnectCount.get(peerId) || 0;
    if(reconnectCount === this.maxReconnectCount){
      console.log("재연결이 실패하였습니다. 잠시후 재시도 해주세요.");
      this.reconnectCount.delete(peerId);
      endDisconnect();
      return;
    }
    console.log("오류로 인해 상대방과의 연결이 종료되었습니다. 5초 후 재연결을 시도합니다...");
    setTimeout(() => {
      this.reconnectCount.set(peerId, reconnectCount + 1);
      if(this.peerId === peerId && this.peer){
        this.peer.reconnect()
        return;
      }

      this.connect(peerId);
    }, this.reconnectTimeout);
  }

  send(data : WebRtcDispatchPayload){
    try{
      const sendData : PeerData = {
        data,
        timestamp: Date.now()
      };

      for(const conn of Object.values(this.connections)){
        if(conn.open) {
          conn.send(sendData)
        }
      }

      this.customHandlers.send();
    }
    catch(err){
      throw err;
    }
  }

  connect(targetId : PeerID){
    if(!this.peer){
      throw errorHandler("peer does not exist.");
    }

    try{
      const conn = this.peer.connect(targetId);
      this.handleConnection(conn);
    }
    catch(err){
      throw err;
    }
  }

  destroy(){
    Object.values(this.connections).forEach(conn => conn.close());
    this.connections = {};

    if(this.peer){
      this.peer.destroy();
      this.peer = null;
    }

    this.peerId = null;
    this.initPromise = null;
    this.customHandlers = {
      connection: () => {},
      close: () => {},
      message: () => {},
      send: () => {},
      error: () => {}
    };
  }

  get connectionsLength(){
    return Object.keys(this.connections).length;
  }
}