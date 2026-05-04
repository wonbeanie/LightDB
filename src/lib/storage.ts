import { Snapshot } from "../dto/snapshot.js";
import type { Database, DatabaseData, DatabaseRecord } from "../types/database.js";
import type { ParseStorageMeta, StorageEngine } from "../types/storage.js";
import { ErrorType } from "../types/utils.js";
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
   * 외부 조회를 위해 캐싱한 데이터베이스 레코드 객체
   */
  private databaseRecord : DatabaseRecord = {};

  /**
   * 저장소 버전 관리를 위한 Timestamp(ms)
   */
  private updateTimestamp : number = 0;

  /**
   * LightDB 저장소 그룹의 기준 키이자 메타 정보를 저장하는 키 (커스텀 가능)
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
   * 현재 메모리에 로드된 전체 데이터베이스 레코드 캐시를 반환합니다.
   * @returns 전체 데이터베이스 레코드 객체
   */
  public getDatabaseRecord(){
    return this.databaseRecord;
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
      throw errorHandler(ErrorType.STORAGE, 'Synchronization Failed:', error);
    }
  }

  public getSnapshot(){
    return new Snapshot(this.database, this.updateTimestamp);
  }

  public clear(){
    this.removeTableStorageItems();
    this.database.clear();
    this.databaseRecord = {};
    this.storage.removeItem(this.storageKey)
    this.updateTimestamp = 0;
  }

  /**
   * 메모리 할당 해제를 위한 메서드입니다.
   */
  public destroy(){
    this.removeTableStorageItems();
    this.database.clear();
    this.databaseRecord = {};
    this.storage.removeItem(this.storageKey);
    this.updateTimestamp = 0;
  }

  public set(table : string, data : DatabaseData){
    this.database.set(table, data);
    this.databaseRecord = {
      ...this.databaseRecord,
      [table] : data
    };
    this.updateTimestamp = Date.now();
    this.setTableStorage(table, data);
    this.setStorageMeta();
  }

  public remove(table : string){
    this.database.delete(table);
    const nextRecord = {...this.databaseRecord};
    delete nextRecord[table];
    this.databaseRecord = nextRecord;
    this.updateTimestamp = Date.now();
    this.storage.removeItem(this.getTableStorageKey(table));
    this.setStorageMeta();
  }

  public get(table : string){
    return this.database.get(table);
  }

  public setDatabase(snapshot: Snapshot){
    const prevTables = [...this.database.keys()];
    this.database = snapshot.database;
    this.databaseRecord = Object.fromEntries(snapshot.database) as DatabaseRecord;
    this.updateTimestamp = snapshot.updateTimestamp;
    this.setStorage(snapshot, prevTables);
  }

  /**
   * 저장소 데이터를 불러와 반환합니다.
   * @returns 저장소 데이터가 담긴 {@link Snapshot} 객체
   * @throws 저장소 데이터가 올바른 저장소 메타 또는 스냅샷 형태가 아닐때 발생합니다.
   */
  public getStorage(){
    const initData = {
      database : new Map<string, DatabaseData>(),
      updateTimestamp : 0
    };

    try {
      const data = this.storage.getItem(this.storageKey);
      if (!data) return new Snapshot(initData.database, initData.updateTimestamp);

      const meta = this.parseStorageMeta(data);
      if(!meta){
        return Snapshot.parse(data);
      }

      const database = new Map<string, DatabaseData>();
      for(const table of meta.tables){
        const tableData = this.storage.getItem(this.getTableStorageKey(table));
        if(!tableData) continue;
        database.set(table, JSON.parse(tableData) as DatabaseData);
      }

      return new Snapshot(database, meta.updateTimestamp);
    }
    catch(error){
      console.error(errorHandler(ErrorType.STORAGE, 'Failed to load:', error).message);
      return new Snapshot(new Map());
    }

  }
  
  /**
   * 저장소에 데이터를 테이블 단위로 저장합니다.
   * @param [snapshot] 저장소에 저장할 {@link Snapshot} 객체
   * @throws 저장소의 용량이 부족할때(QuotaExceededError) 발생합니다.
   */
  public setStorage(snapshot: Snapshot = new Snapshot(this.database), removeTables : string[] = [...this.database.keys()]){
    try{
      for(const table of removeTables){
        if(!snapshot.database.has(table)){
          this.storage.removeItem(this.getTableStorageKey(table));
        }
      }

      for(const [table, data] of snapshot.database){
        this.setTableStorage(table, data);
      }

      this.updateTimestamp = snapshot.updateTimestamp;
      this.setStorageMeta(snapshot);
    }
    catch(error){
      if(error instanceof DOMException && error.name === "QuotaExceededError"){
        throw errorHandler(ErrorType.STORAGE,"Quota exceeded! Data might not be saved.", error);
      }
      else {
        throw errorHandler(ErrorType.STORAGE, `Save Failed:`, error);
      }
    }
  }

  private loadStorage(){
    const {database, updateTimestamp} = this.getStorage();
    this.database = database
    this.databaseRecord = Object.fromEntries(database) as DatabaseRecord;
    this.updateTimestamp = updateTimestamp;
  }

  /**
   * 테이블 데이터를 저장할 저장소 키를 생성합니다.
   * @param table - 저장소 키를 생성할 테이블 키
   * @returns 인코딩된 테이블 저장소 키
   */
  private getTableStorageKey(table : string){
    return `${this.storageKey}:table:${encodeURIComponent(table)}`;
  }

  /**
   * 저장소 메타 문자열을 해석합니다.
   * @param data - 저장소 메타 또는 기존 스냅샷 문자열
   * @returns 테이블 단위 저장소 메타이며, 기존 스냅샷 형식이면 `null`을 반환합니다.
   * @throws 저장소 메타 구조가 올바르지 않을 때 발생합니다.
   */
  private parseStorageMeta(data : string) : ParseStorageMeta | null{
    const parsed = JSON.parse(data);
    if(parsed?.version !== 2){
      return null;
    }

    if(!Array.isArray(parsed.tables) || typeof parsed.updateTimestamp !== "number"){
      throw new Error("Invalid storage meta structure");
    }

    return parsed as ParseStorageMeta;
  }

  /**
   * 특정 테이블 데이터를 테이블 전용 저장소 키에 저장합니다.
   * @param table - 저장할 테이블 키
   * @param data - 저장할 테이블 데이터
   */
  private setTableStorage(table : string, data : DatabaseData){
    this.storage.setItem(this.getTableStorageKey(table), JSON.stringify(data));
  }

  /**
   * 현재 데이터베이스의 테이블 목록과 업데이트 시간을 저장소 메타에 저장합니다.
   * @param [snapshot] - 메타 정보를 구성할 {@link Snapshot} 객체
   */
  private setStorageMeta(snapshot : Snapshot = new Snapshot(this.database, this.updateTimestamp)){
    const meta : ParseStorageMeta = {
      version : 2,
      tables : [...snapshot.database.keys()],
      updateTimestamp : snapshot.updateTimestamp
    };

    this.storage.setItem(this.storageKey, JSON.stringify(meta));
  }

  /**
   * 현재 메모리에 로드된 모든 테이블 저장소 키를 삭제합니다.
   */
  private removeTableStorageItems(){
    for(const table of this.database.keys()){
      this.storage.removeItem(this.getTableStorageKey(table));
    }
  }
}
