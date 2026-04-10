import type { Database, DatabaseConfig, DatabaseData, DatabaseEntries, Listener, ListenerHandler, ListenerKey, ResolveQueueId, TableKey, UpdateResolveQueue } from "./lib/type/database.js";
import { EVENT_LIST, type EventMap } from "./lib/event-list.js";
import type { PeerID, WebRtcDispatchPayload } from "./lib/type/web-rtc.js";
import { errorHandler } from "./lib/utils.js";
import type { EventBus } from "./lib/event-bus.js";

export class LiveDatabase {
  private _database : Database = new Map();
  private listener : Listener = new Map();
  private updateResolveQueue : UpdateResolveQueue = new Map();
  private roomChief = false;
  private updateTimeout : number = 5000;
  private lastResolveQueueId = 1;

  constructor(private eventBus: EventBus<EventMap>){
    this.eventBus.on(EVENT_LIST.UPDATE_DATABASE, (data : WebRtcDispatchPayload) => this.onValue(data));
    this.eventBus.on(EVENT_LIST.SET_DATABASE_CONFIG, (config) => {
      this.updateTimeout = config?.updateTimeout ?? this.updateTimeout;
    });
    this.eventBus.on(EVENT_LIST.COMPLETE_JOIN_ROOM, (peerId) => this.syncDatabase(peerId));
    this.eventBus.on(EVENT_LIST.APPLY_DATABASE_SNAPSHOT, (data) => this.applyDatabase(data));
  }

  applyDatabase(database : DatabaseEntries){
    this._database = new Map(database);
    this.eventBus.emit(EVENT_LIST.UPDATE_COMPLETE_DATABASE);
  }

  syncDatabase(peerId : PeerID){
    if(!this.roomChief) return;
    this.eventBus.emit(EVENT_LIST.REQUEST_SYNC_DATABASE, {
      database : this._database,
      peerId : peerId
    });
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
      this.eventBus.emit(EVENT_LIST.REQUEST_PEER_SEND, {
        id : ResolveQueueId,
        table,
        data,
        clear : options.clear,
      });
    }

    try {
      return await this.checkUpdate(ResolveQueueId);
    }
    catch(err){
      throw errorHandler("Timeout error.");
    }
  }

  async checkUpdate(id : ResolveQueueId){
    return new Promise((resolve, reject)=>{
      if(this.roomChief){
        resolve(this.database);
        return;
      }
      
      const timeoutId = setTimeout(()=>{
        reject(true);
        this.updateResolveQueue.delete(id);
      }, this.updateTimeout);

      this.updateResolveQueue.set(id, {
        resolve : resolve,
        timeoutId
      });
    });
  }

  onValue({id, table, data, clear = false} : WebRtcDispatchPayload, send = true){
    if(clear){
      this._database = new Map();
      this.emitAllCallback();
    }
    else {
      let prevDatabase = this._database.get(table) || {};
      const newDatabase = {
        ...prevDatabase,
        ...data
      };
      this._database.set(table, newDatabase);
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

    this.eventBus.emit(EVENT_LIST.UPDATE_COMPLETE_DATABASE);

    if(this.roomChief && send){
      this.eventBus.emit(EVENT_LIST.REQUEST_PEER_SEND, {
        id,
        table,
        data,
        clear
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
    return this._database.get(table);
  }

  connect(targetId : string){
    this.eventBus.emit(EVENT_LIST.REQUEST_PEER_CONNECT, targetId);
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
    this.updateResolveQueue.clear();
    this._database.clear();
  }

  get database(){
    return Object.fromEntries(this._database);
  }
}