import { DataConnection, Peer } from "peerjs";
import type { DatabaseData, TableKey } from "./database.js";
import errorDispatcher from "./error-dispatcher.js";
import liveDatabase from "./database.js";

export class WebRTC {
  private connections : Connections = {};
  private peer_id : PeerID = "";
  private peer: Peer | null = null;
  private initPromise : Promise<PeerID> | null = null;
  customHandlers : CustomPeerHandlers = {
    onConnection : () => {},
    onClose : () => {},
    onMessage : () => {},
    onSend : () => {}
  };

  init(){
    if(this.initPromise) return this.initPromise;
    if(this.peer) return Promise.resolve(this.peer_id);
    this.initPromise = new Promise((resolve, reject)=>{
      const peer = new Peer();
      this.peer = peer;

      peer.on('open', (id) => {
        this.peer_id = id;
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
        errorDispatcher.dispatch(err);
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
          liveDatabase.onValue(data);
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

  send(data : Data){
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
      throw errorDispatcher.dispatch("peer does not exist.");
    }
    for(const conn of Object.values(this.connections)){
      conn.close();
    }
    this.peer.disconnect();
    this.peer.destroy();
    this.peer = null;
    this.connections = {};
    this.peer_id = "";
  }

  connect(targetId : PeerID){
    if(!this.peer){
      throw errorDispatcher.dispatch("peer does not exist.");
    }

    try{
      const conn = this.peer.connect(targetId);
      this.handleConnection(conn);
    }
    catch(err){
      throw err;
    }
  }

  get peerId(){
    return this.peer_id;
  }

  get connectionsLength(){
    return Object.keys(this.connections).length;
  }
}

const webRTC = new WebRTC();
export default webRTC;
export interface CustomPeerHandlers {
  [HandlerType.CONNECTION] : ConnectionHandler;
  [HandlerType.CLOSE] : CloseHandler;
  [HandlerType.MESSAGE] : MessageHandler;
  [HandlerType.ERROR] ?: ErrorHandler;
  [HandlerType.SEND] : SendHandler;
}

export const enum HandlerType {
  CONNECTION = "onConnection",
  CLOSE = "onClose",
  MESSAGE = "onMessage",
  ERROR = "onError",
  SEND = "onSend"
}

type Connections = Record<string, DataConnection>;
type PeerID = string;
type PeerData = {
  data : Data,
  timestamp : number
};

type Data = {
  table : TableKey,
  data : DatabaseData,
  clear ?: boolean
}

export type ConnectionHandler = (targetId ?: PeerID) => void;
export type CloseHandler = (targetId ?: PeerID) => void;
export type MessageHandler = (data ?: unknown) => void;
export type ErrorHandler = (err ?: Error | unknown) => void;
export type SendHandler = () => void;