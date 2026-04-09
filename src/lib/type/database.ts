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