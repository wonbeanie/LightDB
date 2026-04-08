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
          this.customHandlers.message(response);
        });
      }

      if(conn.listenerCount('close') === 0){
        conn.on('close', () => {
          delete this.connections[conn.peer];
          this.customHandlers.close(conn.peer);
        });
      }

      this.customHandlers.connection(conn.peer);
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

      this.customHandlers.send();
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