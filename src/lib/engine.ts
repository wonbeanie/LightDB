import { LiveDatabase } from "./database.js";
import { DB_PATH, type DatabaseData } from "../types/database.js";
import type { Config } from "../types/light-db.js";
import type { StorageEngine } from "../types/storage.js";
import type { HandlerType, PeerEventMap } from "../types/web-rtc.js";
import { WebRTC } from "./web-rtc.js";
import { LightStorage } from "./storage.js";
import { errorHandler, formatNow } from "./utils.js";

export class LightDBEngine {
  public db : LiveDatabase;
  public rtc : WebRTC;
  public storage : LightStorage;
  public database = {};
  public updateTimestamp : string = "";
  public roomChief = false;
  public roomId : string | null = null;

  public onUpdateComplete : () => void = () => {};
  
  constructor(config: Config = {database: {}, webRtc: {}}, storage ?: StorageEngine){
    this.storage = new LightStorage(storage);
    this.db = new LiveDatabase(this.storage, config.database);
    this.rtc = new WebRTC(config.webRtc);
    
    this.db.onSend = (data) => this.rtc.send(data);
    this.db.onUpdateComplete = () => {
      this.setDatabase();
      this.onUpdateComplete();
    };
    
    this.rtc.onGetSnapshot = () => this.db.getSnapshot();
    this.rtc.onUpdateDatabase = (data) => this.db.onValue(data);
    this.rtc.onSyncDatabase = (snapshot) => this.db.syncDatabase(snapshot);
    this.rtc.onGetIsRoomChief = () => this.db.roomChief;
  }

  public onSetStorageKey = (key : string) => {
    this.db.onSetStorageKey(key)
  };
  
  async createRoom(){
    try{
      const peerId = await this.rtc.init();
      this.db.roomChief = true;
      this.roomChief = true;
      this.roomId = peerId;
      return peerId;
    }
    catch(err){
      const message = err instanceof Error ? err.message : err;
      throw errorHandler(`[LightDB] Create Room Failed: ${message}`);
    }
  }

  async joinRoom(targetId: string){
    try{
      await this.rtc.init();
      this.rtc.connect(targetId);
      this.roomId = targetId;
    }
    catch(err){
      const message = err instanceof Error ? err.message : err;
      throw errorHandler(`[LightDB] Join Room Failed: ${message}`);
    }
  }

  on(table : string, handler : Function){
    this.db.addDBListener(table, handler);
  }

  off(table : string){
    this.db.removeDBListener(table);
  }

  async update(table : string = DB_PATH.ROOT, data : DatabaseData){
    return this.db.updateDB(table, data);
  }

  async clear(){
    return this.db.updateDB(DB_PATH.ROOT, {}, true);
  }

  onPeer<K extends HandlerType>(event : K, handler: PeerEventMap[K]){
    this.rtc.setHandler(event, handler);
  }

  offPeer<K extends HandlerType>(event : K){
    this.rtc.setHandler(event, () => {});
  }

  destroy(){
    this.rtc.destroy();
    this.db.destroy();
    this.roomId = null;
    this.database = {};
    this.roomChief = false;
  }

  setDatabase(){
    this.database = this.db.database;
    this.updateTimestamp = formatNow();
  }

  async remove(table : string){
    return this.db.removeTable(table);
  }
}