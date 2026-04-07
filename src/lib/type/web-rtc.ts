import type { DataConnection } from "peerjs";
import type { DatabaseData, TableKey } from "./database.js";

export const HandlerType = {
  CONNECTION : "onConnection",
  CLOSE : "onClose",
  MESSAGE : "onMessage",
  ERROR : "onError",
  SEND : "onSend"
} as const;

type HandlerType = typeof HandlerType[keyof typeof HandlerType];

export interface CustomPeerHandlers {
  [HandlerType.CONNECTION] : ConnectionHandler;
  [HandlerType.CLOSE] : CloseHandler;
  [HandlerType.MESSAGE] : MessageHandler;
  [HandlerType.SEND] : SendHandler;
  [HandlerType.ERROR] : ErrorHandler;
}

export type Connections = Record<string, DataConnection>;
export type PeerID = string;

export interface WebRtcDispatchPayload {
  table : TableKey,
  data : DatabaseData,
  clear ?: boolean
};

export type PeerData = {
  data : WebRtcDispatchPayload,
  timestamp : number
};


export type ConnectionHandler = (targetId ?: PeerID) => void;
export type CloseHandler = (targetId ?: PeerID) => void;
export type MessageHandler = (data ?: unknown) => void;
export type ErrorHandler = (err ?: Error | unknown) => void;
export type SendHandler = () => void;