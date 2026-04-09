import { LiveDatabase } from "./database.js";
import { EventBus } from "./lib/event-bus.js";
import { EVENT_LIST, type EventMap } from "./lib/event-list.js";
import type { DatabaseData } from "./lib/type/database.js";
import type { Config } from "./lib/type/light-db.js";
import { HandlerType , type PeerEventMap } from "./lib/type/web-rtc.js";
import { formatNow } from "./lib/utils.js";
import { WebRTC } from "./web-rtc.js";

const internals = new WeakMap<LightDB, {
  eventBus: EventBus<EventMap>;
  liveDatabase: LiveDatabase;
  webRTC: WebRTC;
}>();

export class LightDB {
  roomId : string | null = null;
  database = {};
  updateTimestamp : string = "";
  roomChief = false;

  constructor(config ?: Config){
    const eventBus = new EventBus<EventMap>();
    const liveDatabase = new LiveDatabase(eventBus);
    const webRTC = new WebRTC(eventBus);
    eventBus.on(EVENT_LIST.UPDATE_COMPLETE_DATABASE, () => this.setDatabase());
    eventBus.emit(EVENT_LIST.SET_DATABASE_CONFIG, config?.database);
    eventBus.emit(EVENT_LIST.SET_WEBRTC_CONFIG, config?.webRtc);    

    internals.set(this, {
      eventBus,
      liveDatabase,
      webRTC
    });

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

  on(table : string, handler : Function){
    const {liveDatabase} = internals.get(this)!;
    liveDatabase.addDBListener(table, handler);
  }

  off(table : string){
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

  onPeer<K extends HandlerType>(event : K, handler: PeerEventMap[K]){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.ON_LISTENER, {
      event,
      handler
    });
  }

  offPeer<K extends HandlerType>(event : K){
    const {eventBus} = internals.get(this)!;
    eventBus.emit(EVENT_LIST.OFF_LISTENER, event);
  }

  destroy(){
    const internal = internals.get(this);
    if(!internal) return;

    const {webRTC, liveDatabase, eventBus} = internal;

    webRTC.destroy();
    liveDatabase.destroy();
    eventBus.destroy();
    internals.delete(this);
    this.roomId = null;
    this.database = {};
    this.roomChief = false;
  }
}

const lightDB = new LightDB();
export default lightDB;