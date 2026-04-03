import errorDispatcher from "./error-dispatcher.js";
import webRTC from "./web-rtc.js";

class LiveDatabase {
  private _database : Database = new Map();
  private listener : Listener = new Map();
  private updateResolver : ((value ?: unknown) => void) | null = null;
  private roomChief = false;
  private updateTimeoutID : number | null = null;

  setDBListener(listenerKey : ListenerKey, dbHandler : ListenerHandler){
    this.listener.set(listenerKey, (data : DatabaseData | null) => {
      if(data === null){
        return;
      }
      dbHandler(data);
    });
  }

  async updateDB(table : TableKey = "/", data : DatabaseData, options = {clear : false}){
    // 임시 한번씩 업데이트 가능
    if(this.updateResolver !== null){
      throw errorDispatcher.dispatch("The previous operation was not completed.");
    }

    if(this.roomChief){
      this.onValue({
        data,
        table,
        clear : options.clear
      }, false);
    }

    if(Object.keys(data).length > 0 || options.clear){
      webRTC.send({
        table,
        data,
        clear : options.clear
      });
    }

    try {
      return this.checkUpdate();
    }
    catch(err){
      throw errorDispatcher.dispatch("Timeout error.");
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

    if(this.roomChief && send){
      webRTC.send({
        data,
        table,
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
    webRTC.connect(targetId);
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

  get peerId(){
    return webRTC.peerId;
  }

  get database(){
    return Object.fromEntries(this._database);
  }
}

const liveDatabase = new LiveDatabase();
export default liveDatabase;

export type TableKey = string;
export type DatabaseData = Record<string, unknown>;

type ListenerKey = string;
type ListenerHandler = Function;

type Database = Map<TableKey, DatabaseData>;
type Listener = Map<ListenerKey, ListenerHandler>;