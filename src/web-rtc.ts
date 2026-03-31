import { DataConnection, Peer } from "peerjs";

class WebRTC {
  private connections : Record<string, DataConnection> = {};
  private peer_id = "";
  private peer: Peer | null = null;
  private request_count = 0;
  private MAX_REQUEST_NUM = 100;
  private callbacks : Callbacks;

  constructor({
    open,
    close,
    message,
    error,
    conntion,
    send
  } : Callbacks){
    const peer = new Peer();
    
    peer.on('open', (id) => {
      this.peer_id = id;
      this.callbacks.open(id);
    });
  
    peer.on('connection', (conn) => {
      this.handleConnection(conn);
    });
  
    this.peer = peer;
    this.callbacks = {
      open,
      close,
      message,
      error,
      conntion,
      send
    }
  }

  handleConnection = (conn : DataConnection) => {
    conn.on('open', () => {
      if (this.connections[conn.peer]) return;
      this.connections[conn.peer] = conn;
      conn.on('data', (data) => {
        this.callbacks.message(data);
      });

      conn.on('close', () => {
        delete this.connections[conn.peer];
        this.callbacks.close(conn.peer);
      });

      this.callbacks.conntion(conn.peer);
    });
  }

  send(data : unknown){
    try{
      if(this.request_count >= this.MAX_REQUEST_NUM){
        throw new Error("최대 요청 수를 초과하였습니다.");
      }

      this.request_count += 1;

      const sendData = {
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

      this.callbacks.send();
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

  close() {
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
}

export default WebRTC;

interface Callbacks {
  open : Function,
  conntion : Function,
  close : Function,
  message : Function,
  error : Function,
  send : Function
}