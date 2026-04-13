import type { DataConnection, Peer as PeerType } from "peerjs";
import { type Connections, type PeerEventMap, type PeerID, type WebRtcDispatchPayload, type HandlerType, PeerDataType, type PeerData, type WebRtcConfig, DisconnectType } from "./lib/type/web-rtc.js";
import { errorHandler } from "./lib/utils.js";
import type { SnapshotPayload } from "./lib/type/database.js";
import { createPeerData } from "./lib/dto/peer-data.js";
import { Snapshot } from "./lib/dto/snapshot.js";

export class WebRTC {
  private connections : Connections = {};
  private peerId : PeerID | null = null;
  private peer: PeerType | null = null;
  private initPromise : Promise<PeerID> | null = null;
  private reconnectCount = new Map<PeerID, number>();
  private maxReconnectCount = 5;
  private reconnectTimeout = 5000;
  private customHandlers : PeerEventMap = {
    connection : () => {},
    close : () => {},
    message : () => {},
    send : () => {},
    error : () => {},
    disconnect : () => {},
  };

  public onUpdateDatabase : (data : WebRtcDispatchPayload) => void = () => {};
  public onGetSnapshot : () => Snapshot = () => (new Snapshot());
  public onSyncDatabase : (snapshot : Snapshot) => void = () => {};

  constructor(config : WebRtcConfig = {}){
    this.maxReconnectCount = config?.maxReconnectCount ?? this.maxReconnectCount;
    this.reconnectTimeout = config?.reconnectTimeout ?? this.reconnectTimeout;
  }

  init(){
    try{
      if(this.initPromise) return this.initPromise;
      if(this.peer) return Promise.resolve(this.peerId);

      if(typeof window === 'undefined' && !globalThis.RTCPeerConnection){
        throw new Error(
          "[WebRTC] SSR/Node.js environment detected. " +
          "WebRTC requires a browser or a polyfill (like 'wrtc' or 'node-datachannel')."
        )
      }

      this.initPromise = new Promise(async (resolve, reject)=>{
        const PeerModule = await import("peerjs");
        const Peer = PeerModule.Peer || PeerModule.default;

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
          const message = err instanceof Error ? err.message : err;
          reject(new Error(`Peer connection error: ${message}`));
          this.peer = null;
          this.initPromise = null;
        });

        peer.on("disconnected", () => {
          this.handleDisconnect(peer.id);
        });
      })

      return this.initPromise;
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      throw errorHandler(`[WebRtc] WebRtc Initialization Failed: ${message}`);
    }
  }

  private handleConnection = (conn : DataConnection) => {
    if (this.connections[conn.peer]) return;
    conn.on('open', () => {
      this.connections[conn.peer] = conn;
      this.reconnectCount.set(conn.peer, 0);

      if(conn.listenerCount('data') === 0){
        conn.on('data', (response) => {
          const {data, type} = response as PeerData<SnapshotPayload | WebRtcDispatchPayload>;
          if(type === PeerDataType.SYNC){
            this.onSyncDatabase(Snapshot.deserialize(data as SnapshotPayload));
          }
          else {
            this.onUpdateDatabase(data as WebRtcDispatchPayload);
          }
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
      this.syncDatabase(conn.peer);
    });
  }

  private syncDatabase(peerId : PeerID){
    const snapshot = this.onGetSnapshot();
    const conn = this.connections[peerId];
    if(conn){
      const sendData = createPeerData<SnapshotPayload>(Snapshot.serialize(snapshot), this.peerId!, PeerDataType.SYNC);
      conn.send(sendData);
    }
  }

  setHandler<K extends HandlerType>(event: K, handler : PeerEventMap[K]){
    this.customHandlers[event] = handler;
  }

  handleDisconnect(peerId : PeerID, endDisconnect : () => void = () => {}) {
    const {[peerId] : disconnectPeer, ...rest} = this.connections;
    this.connections = rest;

    if(this.peer && this.peer.destroyed){
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
      if(this.peerId === peerId && this.peer){
        this.peer.reconnect()
        return;
      }

      this.connect(peerId);
    }, this.reconnectTimeout);
  }

  send(data : WebRtcDispatchPayload){
    try{
      const sendData = createPeerData<WebRtcDispatchPayload>(data, this.peerId!, PeerDataType.UPDATE);

      for(const conn of Object.values(this.connections)){
        if(conn.open) {
          conn.send(sendData)
        }
      }

      this.customHandlers.send();
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      throw errorHandler(`[WebRtc] Send Failed: ${message}`);
    }
  }

  connect(targetId : PeerID){
    try{
      if(!this.peer){
        throw new Error("peer does not exist.");
      }
      const conn = this.peer.connect(targetId);
      this.handleConnection(conn);
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      throw errorHandler(`[WebRtc] Connect Failed: ${message}`);
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
      error: () => {},
      disconnect: () => {},
    };
  }

  get connectionsLength(){
    return Object.keys(this.connections).length;
  }
}