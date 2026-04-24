import { Snapshot } from "../dto/snapshot.js";
import type { Database, DatabaseData } from "../types/database.js";
import type { ParseStorageData, StorageEngine } from "../types/storage.js";
import { MemoryStorage } from "./memory-storage.js";
import { errorHandler } from "./utils.js";

/**
 * 데이터 지속성을 위한 저장소 상태를 관리하는 클래스입니다.
 */
export class LightStorage {
  /**
   * 현재 메모리에 로드된 데이터베이스 맵 객체
   */
  private database : Database = new Map();

  /**
   * 저장소 버전 관리를 위한 Timestamp(ms)
   */
  private updateTimestamp : number = 0;

  /**
   * LightDB에서 사용하는 저장소 키 (커스텀 가능)
   */
  private storageKey = "LIGHT_DB";
  private storage : StorageEngine;

  /**
   * 새로운 저장소 인스턴스를 생성합니다.
   * @param [storage] - 외부 커스텀 스토리지 (선택 사항)
   */
  constructor(storage ?: StorageEngine){
    this.storage = storage ||
                  (
                    typeof window !== 'undefined' ?
                    window.localStorage : new MemoryStorage()
                  );

    this.loadStorage();
  }

  /**
   * 외부에서 저장소 키를 받기 위한 메서드입니다.
   */
  public onSetStorageKey = (key : string) => {
    if(this.storageKey === key) return;
    this.storageKey = key;
    this.loadStorage();
  }

  public getDatabase(){
    return this.database;
  }

  /**
   * WebRtc를 통해 방장과의 저장소 동기화를 위한 메서드입니다.
   */
  public syncStorage(snapshot : Snapshot){
    try{
      if(!snapshot || typeof snapshot.updateTimestamp !== "number"){
        throw new Error("Received invalid snapshot for sync");
      }

      if(snapshot.updateTimestamp <= this.updateTimestamp){
        return;
      }

      this.setDatabase(snapshot);
      this.updateTimestamp = snapshot.updateTimestamp;
    }
    catch(error){
      throw errorHandler(error, '[Storage] Synchronization Failed:');
    }
  }

  public getSnapshot(){
    return new Snapshot(this.database, this.updateTimestamp);
  }

  public clear(){
    this.database.clear();
    this.storage.removeItem(this.storageKey)
  }

  /**
   * 메모리 할당 해제를 위한 메서드입니다.
   */
  public destroy(){
    this.database.clear();
    this.storage.removeItem(this.storageKey)
  }

  public set(table : string, data : DatabaseData){
    this.database.set(table, data);
    this.setStorage();
  }

  public remove(table : string){
    this.database.delete(table);
    this.setStorage();
  }

  public get(table : string){
    return this.database.get(table);
  }

  public setDatabase(snapshot: Snapshot){
    this.database = snapshot.database;
    this.setStorage(snapshot);
  }

  /**
   * 저장소 데이터를 불러와 반환합니다.
   * @returns 저장소 데이터가 담긴 {@link Snapshot} 객체
   * @throws 저장소 데이터가 {@link ParseStorageData}의 형태가 아닐때 발생합니다.
   */
  public getStorage(){
    const initData = {
      database : new Map<string, DatabaseData>(),
      updateTimestamp : 0
    };

    try {
      const data = this.storage.getItem(this.storageKey);
      if (!data) return new Snapshot(initData.database, initData.updateTimestamp);

      return Snapshot.parse(data);
    }
    catch(error){
      errorHandler(error, '[Storage] Failed to load:');
      return new Snapshot(new Map());
    }

  }
  
  /**
   * 저장소에 데이터를 저장합니다.
   * @param [snapshot] 저장소에 저장할 {@link Snapshot} 객체
   * @throws 저장소의 용량이 부족할때(QuotaExceededError) 발생합니다.
   */
  public setStorage(snapshot: Snapshot = new Snapshot(this.database)){
    try{
      this.storage.setItem(this.storageKey, Snapshot.stringify(snapshot));
    }
    catch(error){
      if(error instanceof DOMException && error.name === "QuotaExceededError"){
        throw errorHandler("[Storage] Quota exceeded! Data might not be saved.");
      }
      else {
        throw errorHandler(error, `[Storage] Save Failed:`);
      }
    }
  }

  private loadStorage(){
    const {database, updateTimestamp} = this.getStorage();
    this.database = database
    this.updateTimestamp = updateTimestamp;
  }
}