import liveDatabase, { type DatabaseData } from "./database.js";
import errorDispatcher from "./error-dispatcher.js";
import webRTC, { HandlerType, type CloseHandler, type ConnectionHandler, type ErrorHandler, type MessageHandler, type SendHandler } from "./web-rtc.js";

class LightDB {
  async createRoom(){
    const peerId = await webRTC.init();
    liveDatabase.setRoomChief();
    return peerId;
  }

  async joinRoom(targetId: string){
    try{
      await webRTC.init();
      liveDatabase.connect(targetId);
    }
    catch(err){
      throw err;
    }
  }

  addListener(table : string, handler : Function){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    liveDatabase.setDBListener(table, handler);
  }

  async update(table : string = "/", data : DatabaseData){
    if(liveDatabase === null){
      throw new Error("database does not exist.");
    }
    return liveDatabase.updateDB(table, data);
  }

  getDatabase(){
    return liveDatabase.database;
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
    webRTC.customHandlers[HandlerType.CONNECTION] = handler;
  }

  set onClose(handler : CloseHandler){
    webRTC.customHandlers[HandlerType.CLOSE] = handler;
  }

  set onMessage(handler : MessageHandler){
    webRTC.customHandlers[HandlerType.MESSAGE] = handler;
  }

  set onError(handler : ErrorHandler){
    webRTC.customHandlers[HandlerType.ERROR] = handler;
    errorDispatcher.onError = handler;
  }

  set onSend(handler : SendHandler){
    webRTC.customHandlers[HandlerType.SEND] = handler;
  }
}

const lightDB = new LightDB();
export default lightDB;