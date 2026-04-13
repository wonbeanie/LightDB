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

export type ResolveQueueId = string;
export interface ResolveQueue {
  resolve: (value ?: unknown) => void,
  reject: (value ?: unknown) => void,
  timeoutId : number
}
export type UpdateResolveQueue = Map<ResolveQueueId, ResolveQueue>;

export interface SnapshotPayload {
  database : DatabaseEntries,
  updateTimestamp : number
}