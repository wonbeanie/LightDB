import type { DatabaseData } from "./database.js";

/**
 * LightDB에서 사용하는 저장소 엔진 인터페이스입니다.
 * @remarks
 * 브라우저의 Web Storage와 호환되도록 설계하였습니다.
 */
export interface StorageEngine {
  /**
   * 지정된 키에 저장된 값을 가져옵니다.
   * @param key - 가져올 데이터의 고유 키
   * @return 저장된 문자열 값을 반환하며, 데이터가 없으면 'null'을 반환합니다.
   */
  getItem(key: string): string | null;

  /**
   * 지정된 키와 값을 저장소에 저장합니다.
   * @param key - 데이터를 저장할 고유 키
   * @param value - 저장할 문자열 데이터
   */
  setItem(key: string, value: string): void;

  /**
   * 지정된 키와 그에 해당하는 데이터를 저장소에서 삭제합니다.
   * @param key - 삭제할 데이터의 고유 키
   */
  removeItem(key: string): void;
}

export type ParseDatabase = Record<string, DatabaseData>;
export type ParseUpdateTimestamp = number;
export interface ParseStorageData {
  database : ParseDatabase,
  updateTimestamp : ParseUpdateTimestamp
}
