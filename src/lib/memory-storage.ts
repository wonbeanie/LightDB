import type { StorageEngine } from "../types/storage.js";

export class MemoryStorage implements StorageEngine {
  private data: Record<string, string> = {};

  getItem(key: string) {
    return this.data[key] || null;
  }

  setItem(key : string, value : string){
    this.data[key] = value;
  }

  removeItem(key: string) {
    const {[key] : removeItem, ...rest} = this.data;
    this.data = rest;
  }
}