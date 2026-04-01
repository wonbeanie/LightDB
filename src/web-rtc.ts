import { DataConnection, Peer } from "peerjs";
import type { DatabaseData, TableKey } from "./database.js";

export class WebRTC {
  private connections : Connections = {};
  private peer_id : PeerID = "";
  private peer: Peer | null = null;
  private request_count = 0;
  private MAX_REQUEST_NUM = 100;
  private customHandlers : CustomPeerHandlers = {
    onOpen : () => {},
    onClose : () => {},
    onMessage : () => {},
    onError : () => {},
    onSend : () => {}
  };

  constructor(){
    const peer = new Peer();
    
    peer.on('open', (id) => {
      this.peer_id = id;
    });
  
    peer.on('connection', (conn) => {
      this.handleConnection(conn);
    });
  
    this.peer = peer;
  }

  private handleConnection = (conn : DataConnection) => {
    conn.on('open', () => {
      if (this.connections[conn.peer]) return;
      this.connections[conn.peer] = conn;
      conn.on('data', (data) => {
        this.customHandlers.onMessage(data);
      });

      conn.on('close', () => {
        delete this.connections[conn.peer];
        this.customHandlers.onClose(conn.peer);
      });

      this.customHandlers.onOpen(conn.peer);
    });
  }

  send(data : Data){
    try{
      if(this.request_count >= this.MAX_REQUEST_NUM){
        throw new Error("최대 요청 수를 초과하였습니다.");
      }

      this.request_count += 1;

      const sendData : PeerData = {
        data,
        timestamp: Date.now()
      };

      const promises = [];

      for(const conn of Object.values(this.connections)){
        if(conn.open) {
          promises.push(conn.send(sendData));
        }
      }

      Promise.all(promises).finally(() => {
        this.request_count -= 1;
      });

      this.customHandlers.onSend();
    }
    catch(err){
      throw err;
    }
  }

  private close() {
    if(!this.peer){
      return;
    }
    for(const conn of Object.values(this.connections)){
      conn.close();
    }
    this.peer.disconnect();
    this.peer.destroy();
    this.peer = null;
    this.connections = {};
    this.peer_id = "";
    this.request_count = 0;
  }

  connect(targetId : PeerID){
    if(!this.peer){
      throw new Error("peer does not exist.");
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

  setCustomPeerHandlers(type : HandlerType, handler : Function){
    this.customHandlers[type] = handler;
  }
}

const webRTC = new WebRTC();
export default webRTC;
export interface CustomPeerHandlers {
  [HandlerType.OPEN] : Function;
  [HandlerType.CLOSE] : Function;
  [HandlerType.MESSAGE] : Function;
  [HandlerType.ERROR] : Function;
  [HandlerType.SEND] : Function;
}

export const enum HandlerType {
  OPEN = "onOpen",
  CLOSE = "onClose",
  MESSAGE = "onMessage",
  ERROR = "onError",
  SEND = "onSend"
}

type Connections = Record<string, DataConnection>;
type PeerID = string;
type Data = {
  table : TableKey,
  data : DatabaseData,
  clear ?: boolean
}
type PeerData = {
  data : unknown,
  timestamp : number
};