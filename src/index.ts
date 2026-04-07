import liveDatabase from "./database.js";
import eventBus from "./lib/event-bus.js";
import { EVENT_LIST } from "./lib/event-list.js";
import type { DatabaseData, ListenerHandler, ListenerKey } from "./lib/type/database.js";
import { type CloseHandler, type ConnectionHandler, type ErrorHandler, type MessageHandler, type PeerID, type SendHandler } from "./lib/type/web-rtc.js";
import { formatNow } from "./lib/utils.js";
import webRTC from "./web-rtc.js";

class LightDB {
  roomId : string | null = null;
  database = {};
  updateTimestamp : string = "";
  roomChief = false;

  constructor(){
    eventBus.on(EVENT_LIST.UPDATE_COMPLETE_DATABASE, () => this.setDatabase());
  }

  async createRoom(){
    const peerId = await webRTC.init();
    liveDatabase.setRoomChief();
    this.roomChief = true;
    this.roomId = peerId;
    return peerId;
  }

  async joinRoom(targetId: string){
    try{
      await webRTC.init();
      liveDatabase.connect(targetId);
      this.roomId = targetId;
    }
    catch(err){
      throw err;
    }
  }

  addListener(table : string, handler : Function){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    liveDatabase.addDBListener(table, handler);
  }

  removeListener(table : string){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    liveDatabase.removeDBListener(table);
  }

  async update(table : string = "/", data : DatabaseData){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    return liveDatabase.updateDB(table, data);
  }

  setDatabase(){
    this.database = liveDatabase.database;
    this.updateTimestamp = formatNow();
  }

  async clear(){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    return liveDatabase.updateDB("/", {}, {
      clear: true
    });
  }

  set onConnection(handler : ConnectionHandler){
    eventBus.emit(EVENT_LIST.ON_CONNECTION, handler);
  }

  set onClose(handler : CloseHandler){
    eventBus.emit(EVENT_LIST.ON_CLOSE, handler);
  }

  set onMessage(handler : MessageHandler){
    eventBus.emit(EVENT_LIST.ON_MESSAGE, handler);
  }

  set onError(handler : ErrorHandler){
    eventBus.emit(EVENT_LIST.ON_ERROR, handler);
  }

  set onSend(handler : SendHandler){
    eventBus.emit(EVENT_LIST.ON_SEND, handler);
  }
}

const lightDB = new LightDB();
export default lightDB;