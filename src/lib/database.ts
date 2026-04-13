import type { Snapshot } from "../dto/snapshot.js";
import { LightStorage } from "./storage.js";
import { errorHandler } from "./utils.js";
import type { DatabaseConfig, DatabaseData, Listener, ListenerHandler, ListenerKey, ResolveQueueId, TableKey, UpdateResolveQueue } from "../types/database.js";
import type { PeerID, WebRtcDispatchPayload } from "../types/web-rtc.js";

export class LiveDatabase {
  private storage : LightStorage;
  private listener : Listener = new Map();
  private updateResolveQueue : UpdateResolveQueue = new Map();
  private roomChief = false;
  private updateTimeout : number = 5000;
  private lastResolveQueueId = 1;

  public onSendUpdate : (data : WebRtcDispatchPayload) => void = () => {};
  public onConnect : (peerId : PeerID) => void = () => {};
  public onUpdateComplete : () => void = () => {};
  public onSetStorageKey : (key : string) => void = () => {};

  constructor(config : DatabaseConfig = {}, storage : LightStorage){
    this.updateTimeout = config?.updateTimeout ?? this.updateTimeout;
    this.storage = storage;
    this.storage.onSetStorageKey = (key : string) => this.onSetStorageKey(key);
  }

  syncDatabase(snapshot : Snapshot){
    this.storage.syncStorage(snapshot);
    this.onUpdateComplete();
  }

  addDBListener(listenerKey : ListenerKey, dbHandler : ListenerHandler){
    this.listener.set(listenerKey, (data : DatabaseData | null) => {
      if(data === null){
        return;
      }
      dbHandler(data);
    });
  }

  removeDBListener(listenerKey : ListenerKey){
    this.listener.delete(listenerKey);
  }

  async updateDB(table : TableKey = "/", data : DatabaseData, options = {clear : false}){
    try {
      const ResolveQueueId : ResolveQueueId = `${Date.now()}-${this.lastResolveQueueId}`;
      this.lastResolveQueueId += 1;

      if(this.roomChief){
        this.onValue({
          id : ResolveQueueId,
          data,
          table,
          clear : options.clear,
        }, false);
      }

      if(Object.keys(data).length > 0 || options.clear){
        this.onSendUpdate({
          id : ResolveQueueId,
          table,
          data,
          clear : options.clear,
        });
      }

      return await this.checkUpdate(ResolveQueueId);
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      throw errorHandler(`[Database] Database Update Failed: ${message}`);
    }
  }

  async checkUpdate(id : ResolveQueueId){
    return new Promise((resolve, reject)=>{
      if(this.roomChief){
        resolve(this.database);
        return;
      }
      
      const timeoutId = setTimeout(()=>{
        reject(new Error("Database Update Timeout"));
        this.updateResolveQueue.delete(id);
      }, this.updateTimeout);

      this.updateResolveQueue.set(id, {
        resolve : resolve,
        reject: reject,
        timeoutId
      });
    });
  }

  onValue({id, table, data, clear = false} : WebRtcDispatchPayload, send = true){
    if(clear){
      this.storage.clear();
      this.emitAllCallback();
    }
    else {
      let prevDatabase = this.storage.get(table) || {};
      const newDatabase = {
        ...prevDatabase,
        ...data
      };
      this.storage.set(table, newDatabase);
      this.emitCallback(table, newDatabase);
    }

    if(this.updateResolveQueue.size > 0){
      const resolveData = this.updateResolveQueue.get(id);
      if(resolveData){
        const {resolve, timeoutId} = resolveData;
        clearTimeout(timeoutId);
        resolve(this.database);
        this.updateResolveQueue.delete(id);
      }
    }

    this.onUpdateComplete();

    if(this.roomChief && send){
      this.onSendUpdate({
        id,
        table,
        data,
        clear,
      });
    }
  }

  private emitCallback(table : TableKey, data : DatabaseData){
    if(!this.listener.has(table)){
      return;
    }
    const handler = this.listener.get(table) || function(){};
    handler(data);
  }

  private emitAllCallback(){
    for(const handler of this.listener.values()){
      handler({});
    }
  }
  
  getData(table : TableKey){
    return this.storage.get(table);
  }

  connect(targetId : string){
    this.onConnect(targetId);
  }

  async onClear(){
    this.onValue({
      id: `${Date.now()}-${this.lastResolveQueueId}`,
      table : "/",
      data : {},
      clear : true
    }, false);

    this.lastResolveQueueId += 1;
  }

  setRoomChief(){
    this.roomChief = true;
  }

  destroy(){
    this.listener.clear();
    this.storage.destroy();

    if(this.updateResolveQueue.size > 0){
      this.updateResolveQueue.forEach(resolveData => {
        resolveData.reject(true);
      });
      this.updateResolveQueue.clear();
    }
  }

  getSnapshot(){
    return this.storage.getSnapshot();
  }

  get database(){
    return Object.fromEntries(this.storage.getDatabase());
  }
}