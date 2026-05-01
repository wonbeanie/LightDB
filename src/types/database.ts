export type TableKey = string;
export type DatabaseData = Record<string, unknown>;

export type ListenerKey = string;
export type ListenerHandler = Function;

export type Database = Map<TableKey, DatabaseData>;

export type Listener = Map<ListenerKey, ListenerHandler>;

export interface DatabaseConfig {
  updateTimeout ?: number;
}

export type DatabaseEntries = [TableKey, DatabaseData][];
export type DatabaseRecord = Record<TableKey, DatabaseData>;

export type ResolveQueueId = string;
export interface ResolveQueue {
  resolve: (value : DatabaseRecord) => void,
  reject: (err : Error) => void,
  timeoutId : number
}
export type UpdateResolveQueue = Map<ResolveQueueId, ResolveQueue>;

export interface SnapshotPayload {
  database : DatabaseEntries,
  updateTimestamp : number
}

export const enum DB_PATH {
  ROOT = "/"
}

export interface PendingEvents {
  table : TableKey,
  data : DatabaseData
}