import type { StorageEngine } from "../types/storage.js";

/**
 * 웹 환경이 아닌 환경에서 사용되는 기본 메모리 저장소 클래스입니다.
 */
export class MemoryStorage implements StorageEngine {
  private data: Record<string, string> = {};
  
  /**
   * @inheritdoc
   */
  getItem(key: string) {
    return this.data[key] || null;
  }

  /**
   * @inheritdoc
   */
  setItem(key : string, value : string){
    this.data[key] = value;
  }

  /**
   * @inheritdoc
   */
  removeItem(key: string) {
    const {[key] : removeItem, ...rest} = this.data;
    this.data = rest;
  }
}