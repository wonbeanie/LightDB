import { LiveDatabase } from "./database.js";
import { EventBus } from "./lib/event-bus.js";
import { EVENT_LIST } from "./lib/event-list.js";
import type { DatabaseData } from "./lib/type/database.js";
import { type CloseHandler, type ConnectionHandler, type ErrorHandler, type MessageHandler, type PeerID, type SendHandler } from "./lib/type/web-rtc.js";
import { formatNow } from "./lib/utils.js";
import { WebRTC } from "./web-rtc.js";

const internals = new WeakMap<LightDB, {
  eventBus: EventBus;
  liveDatabase: LiveDatabase;
  webRTC: WebRTC;
}>();

export class LightDB {
  roomId : string | null = null;
  database = {};
  updateTimestamp : string = "";
  roomChief = false;

  constructor(){
    const eventBus = new EventBus();
    const liveDatabase = new LiveDatabase(eventBus);
    const webRTC = new WebRTC(eventBus);
    eventBus.on(EVENT_LIST.UPDATE_COMPLETE_DATABASE, () => this.setDatabase());

    internals.set(this, {
      eventBus,
      liveDatabase,
      webRTC
    })
  }

  async createRoom(){
    const {webRTC, liveDatabase} = internals.get(this)!;
    const peerId = await webRTC.init();
    liveDatabase.setRoomChief();
    this.roomChief = true;
    this.roomId = peerId;
    return peerId;
  }

  async joinRoom(targetId: string){
    try{
      const {webRTC, liveDatabase} = internals.get(this)!;
      await webRTC.init();
      liveDatabase.connect(targetId);
      this.roomId = targetId;
    }
    catch(err){
      throw err;
    }
  }

  addListener(table : string, handler : Function){
    const {liveDatabase} = internals.get(this)!;
    liveDatabase.addDBListener(table, handler);
  }

  removeListener(table : string){
    const {liveDatabase} = internals.get(this)!;
    liveDatabase.removeDBListener(table);
  }

  async update(table : string = "/", data : DatabaseData){
    const {liveDatabase} = internals.get(this)!;
    return liveDatabase.updateDB(table, data);
  }

  setDatabase(){
    const {liveDatabase} = internals.get(this)!;
    this.database = liveDatabase.database;
    this.updateTimestamp = formatNow();
  }

  async clear(){
    const {liveDatabase} = internals.get(this)!;
    return liveDatabase.updateDB("/", {}, {
      clear: true
    });
  }

  set onConnection(handler : ConnectionHandler){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_CONNECTION, handler);
  }

  set onClose(handler : CloseHandler){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_CLOSE, handler);
  }

  set onMessage(handler : MessageHandler){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_MESSAGE, handler);
  }

  set onError(handler : ErrorHandler){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_ERROR, handler);
  }

  set onSend(handler : SendHandler){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_SEND, handler);
  }
}

const lightDB = new LightDB();
export default lightDB;