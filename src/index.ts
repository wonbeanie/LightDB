import { LightDBEngine } from "./lib/engine.js";
import type { DatabaseData } from "./types/database.js";
import type { Config } from "./types/light-db.js";
import type { StorageEngine } from "./types/storage.js";
import type { HandlerType, PeerEventMap } from "./types/web-rtc.js";

const internals = new WeakMap<LightDB, {
  engine : LightDBEngine
}>();

export class LightDB {
  public database = {};
  public roomChief = false;
  public roomId : string | null = null;
  public updateTimestamp : string = "";

  constructor(config ?: Config, storage ?: StorageEngine){
    const engine = new LightDBEngine(config, storage);

    engine.onUpdateComplete = () => {
      this.database = engine.database;
      this.roomChief = engine.roomChief;
      this.roomId = engine.roomId;
      this.updateTimestamp = engine.updateTimestamp;
    }

    internals.set(this, {
      engine
    });
  }

  async createRoom(storageKey ?: string){
    const {engine} = internals.get(this)!;
    if(storageKey){
      engine.onSetStorageKey(storageKey);
    }
    return engine.createRoom();
  }

  async joinRoom(targetId: string){
    const {engine} = internals.get(this)!;
    engine.joinRoom(targetId);
  }

  on(table : string, handler : Function){
    const {engine} = internals.get(this)!;
    engine.on(table, handler);
  }

  off(table : string){
    const {engine} = internals.get(this)!;
    engine.off(table);
  }

  async update(table : string = "/", data : DatabaseData){
    const {engine} = internals.get(this)!;
    return engine.update(table, data);
  }

  async clear(){
    const {engine} = internals.get(this)!;
    return engine.clear();
  }

  onPeer<K extends HandlerType>(event : K, handler: PeerEventMap[K]){
    const {engine} = internals.get(this)!;
    engine.onPeer(event, handler);
  }

  offPeer<K extends HandlerType>(event : K){
    const {engine} = internals.get(this)!;
    engine.offPeer(event);
  }

  destroy(){
    const {engine} = internals.get(this)!;
    engine.destroy();
    internals.delete(this);
  }
}

const lightDB = new LightDB();
export default lightDB;