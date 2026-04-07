import type { Database, DatabaseData, Listener, ListenerHandler, ListenerKey, TableKey } from "./lib/type/database.js";
import { EVENT_LIST } from "./lib/event-list.js";
import type { Data } from "./lib/type/web-rtc.js";
import { errorHandler } from "./lib/utils.js";
import type { EventBus } from "./lib/event-bus.js";

export class LiveDatabase {
  private _database : Database = new Map();
  private listener : Listener = new Map();
  private updateResolver : ((value ?: unknown) => void) | null = null;
  private roomChief = false;
  private updateTimeoutID : number | null = null;

  constructor(private eventBus: EventBus){
    this.eventBus = eventBus;
    this.eventBus.on(EVENT_LIST.UPDATE_DATABASE, (data) => this.onValue(data as Data));
    this.eventBus.on(EVENT_LIST.ADD_DATABASE_LISTENER, (data) => {
      const {table, handler} = data as {
        table : TableKey,
        handler : ListenerHandler
      }
      this.addDBListener(table, handler);
    })
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
    // 임시 한번씩 업데이트 가능
    if(this.updateResolver !== null){
      throw errorHandler("The previous operation was not completed.");
    }

    if(this.roomChief){
      this.onValue({
        data,
        table,
        clear : options.clear
      }, false);
    }

    if(Object.keys(data).length > 0 || options.clear){
      this.eventBus.emit(EVENT_LIST.REQUEST_PEER_SEND, {
        table,
        data,
        clear : options.clear
      });
    }

    try {
      return this.checkUpdate();
    }
    catch(err){
      throw errorHandler("Timeout error.");
    }
  }

  async checkUpdate(){
    return new Promise((resolve, reject)=>{
      if(this.roomChief){
        resolve(this.database);
        return;
      }
      
      this.updateResolver = resolve;

      this.updateTimeoutID = setTimeout(()=>{
        reject(true);
        this.updateResolver = null;
        this.updateTimeoutID = null;
      }, 5000);
    });
  }

  onValue({table, data, clear = false} : {
    table : TableKey,
    data : DatabaseData,
    clear ?: boolean
  }, send = true){
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

    if(this.updateResolver !== null && this.updateTimeoutID !== null){
      const resolve = this.updateResolver;
      this.updateResolver = null;
      clearTimeout(this.updateTimeoutID);
      this.updateTimeoutID = null;
      resolve(this.database);
    }

    this.eventBus.emit(EVENT_LIST.UPDATE_COMPLETE_DATABASE);

    if(this.roomChief && send){
      this.eventBus.emit(EVENT_LIST.REQUEST_PEER_SEND, {
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
      table : "/",
      data : {},
      clear : true
    }, false);
  }

  setRoomChief(){
    this.roomChief = true;
  }

  get database(){
    return Object.fromEntries(this._database);
  }
}