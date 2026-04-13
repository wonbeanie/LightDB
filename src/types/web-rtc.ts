import type { DataConnection } from "peerjs";
import type { DatabaseData, DatabaseEntries, TableKey } from "./database.js";

export const HandlerType = {
  CONNECTION : "connection",
  CLOSE : "close",
  MESSAGE : "message",
  ERROR : "error",
  SEND : "send",
  DISCONNECT: "disconnect"
} as const;

export type HandlerType = typeof HandlerType[keyof typeof HandlerType];

export interface PeerEventMap {
  [HandlerType.CONNECTION] : ConnectionHandler;
  [HandlerType.CLOSE] : CloseHandler;
  [HandlerType.MESSAGE] : MessageHandler;
  [HandlerType.SEND] : SendHandler;
  [HandlerType.ERROR] : ErrorHandler;
  [HandlerType.DISCONNECT] : DisconnectHandler;
}
export type PeerHandler = PeerEventMap[keyof PeerEventMap];

export type Connections = Record<string, DataConnection>;
export type PeerID = string;

export interface WebRtcDispatchPayload {
  id : string,
  table : TableKey,
  data : DatabaseData,
  clear ?: boolean
};

export type ConnectionHandler = (targetId ?: PeerID) => void;
export type CloseHandler = (targetId ?: PeerID) => void;
export type MessageHandler = (data ?: unknown) => void;
export type ErrorHandler = (err ?: Error | unknown) => void;
export type SendHandler = () => void;
export type DisconnectHandler = (state : DisconnectType) => void;

export interface WebRtcConfig {
  maxReconnectCount ?: number;
  reconnectTimeout ?: number;
}

export const enum PeerDataType {
  SYNC = "SYNC",
  UPDATE = "UPDATE"
}

export interface PeerData<T = DatabaseEntries | WebRtcDispatchPayload> {
  data: T;
  timestamp: number;
  type: PeerDataType;
  senderId: PeerID;
}

export const enum DisconnectType {
  SUCCESS = "SUCCESS",
  RECONNECT_FAIL = "FAILED",
  RECONNECT_RETRY = "RETRY"
}