import { DataConnection, Peer } from "peerjs";
import { EVENT_LIST, type EventMap } from "./lib/event-list.js";
import type { Connections, CustomPeerHandlers, PeerData, PeerID, WebRtcDispatchPayload } from "./lib/type/web-rtc.js";
import { errorHandler } from "./lib/utils.js";
import type { EventBus } from "./lib/event-bus.js";

export class WebRTC {
  private connections : Connections = {};
  private peerId : PeerID | null = null;
  private peer: Peer | null = null;
  private initPromise : Promise<PeerID> | null = null;
  customHandlers : CustomPeerHandlers = {
    onConnection : () => {},
    onClose : () => {},
    onMessage : () => {},
    onSend : () => {},
    onError : () => {}
  };

  constructor(private eventBus: EventBus<EventMap>){
    this.eventBus.on(EVENT_LIST.REQUEST_PEER_SEND, (data : WebRtcDispatchPayload) => this.send(data));
    this.eventBus.on(EVENT_LIST.REQUEST_PEER_CONNECT, (data : PeerID) => this.connect(data));
    this.eventBus.on(EVENT_LIST.ON_CONNECTION, (handler) => this.customHandlers.onConnection = handler);
    this.eventBus.on(EVENT_LIST.ON_CLOSE, (handler) => this.customHandlers.onClose = handler);
    this.eventBus.on(EVENT_LIST.ON_MESSAGE, (handler) => this.customHandlers.onMessage = handler);
    this.eventBus.on(EVENT_LIST.ON_SEND, (handler) => this.customHandlers.onSend = handler);
    this.eventBus.on(EVENT_LIST.ON_ERROR, (handler) => this.customHandlers.onError = handler);
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
    })

    return this.initPromise;
  }

  private handleConnection = (conn : DataConnection) => {
    if (this.connections[conn.peer]) return;
    conn.on('open', () => {
      this.connections[conn.peer] = conn;

      if(conn.listenerCount('data') === 0){
        conn.on('data', (response) => {
          const {data} = response as PeerData;
          this.eventBus.emit(EVENT_LIST.UPDATE_DATABASE, data);
          this.customHandlers.onMessage(response);
        });
      }

      if(conn.listenerCount('close') === 0){
        conn.on('close', () => {
          delete this.connections[conn.peer];
          this.customHandlers.onClose(conn.peer);
        });
      }

      this.customHandlers.onConnection(conn.peer);
    });
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

      this.customHandlers.onSend();
    }
    catch(err){
      throw err;
    }
  }

  private close() {
    if(!this.peer){
      throw errorHandler("peer does not exist.");
    }
    for(const conn of Object.values(this.connections)){
      conn.close();
    }
    this.peer.disconnect();
    this.peer.destroy();
    this.peer = null;
    this.connections = {};
    this.peerId = null;
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

  get connectionsLength(){
    return Object.keys(this.connections).length;
  }
}