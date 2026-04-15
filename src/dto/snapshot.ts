import { errorHandler } from "../lib/utils.js";
import type { Database, SnapshotPayload } from "../types/database.js";
import type { ParseDatabase, ParseUpdateTimestamp } from "../types/storage.js";

/**
 * 저장소에서 사용하는 데이터 객체 클래스 입니다.
 */
export class Snapshot{
  database : Database;
  updateTimestamp : number;

  /**
   * 새로운 데이터 객체 인스턴스를 생성합니다.
   * @param database 저장소 전체의 데이터
   * @param [updateTimestamp] 저장소 버전 관리를 위한 Timestamp(ms) 
   */
  constructor(database : Database, updateTimestamp : number = Date.now()){
    this.database = database;
    this.updateTimestamp = updateTimestamp;
  }

  /**
   * WebRtc 통신을 위한 데이터 직렬화 메서드입니다.
   * @remarks 이 메서드는 정적 메서드입니다.
   * @returns 통신을 위한 {@link SnapshotPayload} 객체
   */
  public static serialize(instance : Snapshot) : SnapshotPayload{
    return {
      database : instance.database.size > 0 ? [...instance.database] : [],
      updateTimestamp : instance.updateTimestamp
    }
  }

  /**
   * WebRtc 통신을 위한 데이터 역직렬화 메서드입니다.
   * @throws payload의 구조가 올바른 형식이 아닐때 발생합니다.
   */
  public static deserialize(payload : SnapshotPayload) {
    if(!payload || !Array.isArray(payload.database)){
      throw errorHandler("[Snapshot] Received invalid snapshot payload format.");
    }
    return new Snapshot(new Map(payload.database), payload.updateTimestamp);
  }

  /**
   * 저장소에 저장하기 위한 문자열화 메서드입니다.
   */
  public static stringify(instance : Snapshot){
    return JSON.stringify({
      database : Object.fromEntries(instance.database),
      updateTimestamp : instance.updateTimestamp
    });
  }

  /**
   *  저장된 문자열 데이터를 해석하여 {@link Snapshot} 객체로 변환하는 객채화 메서드입니다.
   */
  public static parse(text : string){
    const parsed = JSON.parse(text);
    if(!parsed.database || typeof parsed.updateTimestamp !== "number"){
      throw new Error("Invalid storage structure");
    }

    const database = new Map(Object.entries(parsed.database as ParseDatabase));
    return new Snapshot(database, parsed.updateTimestamp as ParseUpdateTimestamp);
  }
}