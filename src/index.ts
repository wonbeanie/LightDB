import { ConnectDatabase } from "./database.js";
import webRTC, { HandlerType } from "./web-rtc.js";

class LightDB {
  private database : ConnectDatabase;

  constructor(){
    this.database = new ConnectDatabase();
  }

  createRoom(){
    this.database.setRoomChief();
    return this.database.peerId;
  }

  joinRoom(peerId: string){
    try{
      this.database.connect(peerId);
    }
    catch(err){
      throw err;
    }
  }

  addListener(table : string, handler : Function){
    if(this.database === null){
      throw new Error("database does not exist.");
    }
    this.database.setDBListener(table, handler);
  }

  update(table : string = "/", data : Record<string, unknown>){
    if(this.database === null){
      throw new Error("database does not exist.");
    }
    this.database.updateDB(table, data);
  }

  clear(){
    if(this.database === null){
      throw new Error("database does not exist.");
    }
    this.database.clear();
  }

  set onOpen(handler : Function){
    webRTC.setCustomPeerHandlers(HandlerType.OPEN, handler);
  }

  set onClose(handler : Function){
    webRTC.setCustomPeerHandlers(HandlerType.CLOSE, handler);
  }

  set onMessage(handler : Function){
    webRTC.setCustomPeerHandlers(HandlerType.MESSAGE, handler);
  }

  set onError(handler : Function){
    webRTC.setCustomPeerHandlers(HandlerType.ERROR, handler);
  }

  set onSend(handler : Function){
    webRTC.setCustomPeerHandlers(HandlerType.SEND, handler);
  }
}

const lightDB = new LightDB();
export default lightDB;