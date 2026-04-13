import { errorHandler } from "../lib/utils.js";
import type { Database, SnapshotPayload } from "../types/database.js";

export class Snapshot{
  database : Database;
  updateTimestamp : number;

  constructor(database : Database = (new Map()), updateTimestamp : number = Date.now()){
    this.database = database;
    this.updateTimestamp = updateTimestamp;
  }

  static serialize(instance : Snapshot) : SnapshotPayload{
    return {
      database : instance.database.size > 0 ? [...instance.database] : [],
      updateTimestamp : instance.updateTimestamp
    }
  }

  static deserialize(payload : SnapshotPayload) {
    if(!payload || !Array.isArray(payload.database)){
      throw errorHandler("[Snapshot] Received invalid snapshot payload format.");
    }
    return new Snapshot(new Map(payload.database), payload.updateTimestamp);
  }
}