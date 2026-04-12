import { Snapshot } from "./dto/snapshot.js";
import type { Database, DatabaseData } from "./type/database.js";
import { errorHandler } from "./utils.js";

export class LightStorage {
  private database : Database;
  private updateTimestamp : number;
  private storageKey = "LIGHT_DB";

  public onSetStorageKey = (key : string) => {
    this.storageKey = key;
  }

  constructor(){
    const {database, updateTimestamp} = this.getStorage();
    this.database = database
    this.updateTimestamp = updateTimestamp;
  }
  
  setDatabase(newDatabase : Database){
    this.database = newDatabase;
    this.setStorage();
  }

  getStorage(){
    const initData = {
      database : new Map(),
      updateTimestamp : 0
    };

    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return initData;

      const parsed = JSON.parse(data);

      if(!parsed.database || typeof parsed.updateTimestamp !== "number"){
        throw new Error("Invalid storage structure");
      }

      return {
        database: new Map(Object.entries(parsed.database)) as Database,
        updateTimestamp: parsed.updateTimestamp
      }
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      errorHandler(`[Storage] Failed to load: ${message}`);
      return initData;
    }

  }
  
  setStorage(){
    try{
      const storageData = {
        database : Object.fromEntries(this.database),
        updateTimestamp : Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(storageData));
    }
    catch(error){
      if(error instanceof DOMException && error.name === "QuotaExceededError"){
        errorHandler("[Storage] Quota exceeded! Data might not be saved.");
      }
      else {
        const message = error instanceof Error ? error.message : error;
        errorHandler(`[Storage] Save Failed: ${message}`);
      }
    }
  }

  getDatabase(){
    return this.database;
  }

  syncStorage(snapshot : Snapshot){
    try{
      if(!snapshot || typeof snapshot.updateTimestamp !== "number"){
        throw new Error("Received invalid snapshot for sync");
      }

      if(snapshot.updateTimestamp <= this.updateTimestamp){
        return;
      }
      this.setDatabase(snapshot.database);
      this.updateTimestamp = snapshot.updateTimestamp;
    }
    catch(error){
      const message = error instanceof Error ? error.message : error;
      throw errorHandler(`[Storage] Synchronization Failed: ${message}`);
    }
  }

  getSnapshot(){
    return new Snapshot(this.database, this.updateTimestamp);
  }

  clear(){
    this.database.clear();
    localStorage.removeItem(this.storageKey)
  }

  destroy(){
    this.database.clear();
    localStorage.removeItem(this.storageKey)
  }

  set(table : string, data : DatabaseData){
    this.database.set(table, data);
    this.setStorage();
  }

  get(table : string){
    return this.database.get(table);
  }
}