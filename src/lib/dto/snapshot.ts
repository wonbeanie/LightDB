import type { Database, SnapshotPayload } from "../type/database.js";
import { errorHandler } from "../utils.js";

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
      throw errorHandler("Received invalid snapshot payload format.", false);
    }
    return new Snapshot(new Map(payload.database), payload.updateTimestamp);
  }
}