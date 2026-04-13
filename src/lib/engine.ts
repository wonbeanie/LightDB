import { LiveDatabase } from "../database.js";
import { WebRTC } from "../web-rtc.js";
import { LightStorage } from "./storage.js";
import type { DatabaseData } from "./type/database.js";
import type { Config } from "./type/light-db.js";
import type { StorageEngine } from "./type/storage.js";
import type { HandlerType, PeerEventMap } from "./type/web-rtc.js";
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
  public onSetStorageKey : (key : string) => void = () => {};

  constructor(config: Config = {database: {}, webRtc: {}}, storage ?: StorageEngine){
    this.storage = new LightStorage(storage);
    this.db = new LiveDatabase(config.database, this.storage);
    this.rtc = new WebRTC(config.webRtc);

    this.db.onSendUpdate = (data) => this.rtc.send(data);
    this.db.onUpdateComplete = () => {
      this.setDatabase();
      this.onUpdateComplete();
    };
    this.db.onConnect = (targetId) => this.rtc.connect(targetId);
    this.db.onSetStorageKey = (key) => this.onSetStorageKey(key);

    this.rtc.onGetSnapshot = () => this.db.getSnapshot();
    this.rtc.onUpdateDatabase = (data) => this.db.onValue(data);
    this.rtc.onSyncDatabase = (snapshot) => this.db.syncDatabase(snapshot);
  }

  async createRoom(){
    try{
      const peerId = await this.rtc.init();
      this.db.setRoomChief();
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
      this.db.connect(targetId);
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

  async update(table : string = "/", data : DatabaseData){
    return this.db.updateDB(table, data);
  }

  async clear(){
    return this.db.updateDB("/", {}, {
      clear: true
    });
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

}