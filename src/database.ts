import webRTC from "./web-rtc.js";

export class ConnectDatabase {
  private database : Database = new Map();
  private listener : Listener = new Map();
  private roomChief = false;

  setDBListener(listenerKey : ListenerKey, dbHandler : ListenerHandler){
    this.listener.set(listenerKey, (data : DatabaseData | null) => {
      if(null === data){
        return;
      }
      dbHandler(data);
    });
  }

  updateDB(table : TableKey = "/", data : DatabaseData){
    if(webRTC === null){
      throw new Error("room does not exist, please use it after the connection is complete.");
    }

    if(this.roomChief){
      this.onValue({
        data,
        table
      }, false);
    }

    if(Object.keys(data).length > 0){
      webRTC.send({
        table,
        data
      });
    }
  }

  private onValue({table, data, clear = false} : {
    table : TableKey,
    data : DatabaseData,
    clear ?: boolean
  }, send = true){
    if(!this.listener.has(table)){
      return;
    }

    if(clear){
      this.database = new Map();
      this.database.set(table, data);
      this.emitCallback(table, data);
      return;
    }

    let prevDatabase = this.database.get(table) || {};
    const newDatabase = {
      ...prevDatabase,
      ...data
    };
    this.database.set(table, newDatabase);
    this.emitCallback(table, newDatabase);

    if(this.roomChief && send){
      if(webRTC === null){
        return;
      }

      webRTC.send({
        data,
        table
      });
    }
  }

  private emitCallback(table : TableKey, data : DatabaseData){
    const handler = this.listener.get(table) || function(){};
    handler(data);
  }
  
  getData(table : TableKey){
    return this.database.get(table);
  }

  connect(targetId : string){
    if(webRTC === null){
      throw new Error("webRTC does not exist.");
    }
    webRTC.connect(targetId);
  }

  clear(){
    if(webRTC === null){
      throw new Error("webRTC does not exist.");
    }

    if(!this.roomChief){
      throw new Error("Only the room chief can initialize the database.");
    }
    
    const clearData = {
      data : {},
      table : "/",
      clear : true
    };

    this.onValue(clearData, false);
    webRTC.send(clearData);
  }

  setRoomChief(){
    this.roomChief = true;
  }

  get peerId(){
    return webRTC.peerId;
  }
}

export type TableKey = string;
export type DatabaseData = Record<string, unknown>;

type ListenerKey = string;
type ListenerHandler = Function;

type Database = Map<TableKey, DatabaseData>;
type Listener = Map<ListenerKey, ListenerHandler>;