import type { DataConnection } from "peerjs";
import type { DatabaseData, DatabaseEntries, SnapshotPayload, TableKey } from "./database.js";

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
  /**
   * 새로운 Peer 간의 연결이 성공일때 호출됩니다.
   * @param targetId - 새로운 Peer의 id
  */
  [HandlerType.CONNECTION] : ConnectionHandler;

  /**
   * 다른 Peer와 연결이 완전히 종료되었을때 호출됩니다.
   * @param targetId - 연결이 종료된 Peer의 id
  */
  [HandlerType.CLOSE] : CloseHandler;

  /**
   * 다른 Peer로부터 동기화, 업데이트 데이터를 받을때 호출됩니다.
   * @param data - {@link ResponseData} 형태의 데이터
  */
  [HandlerType.MESSAGE] : MessageHandler;

  /**
   * 데이터를 다른 Peer에게 전송했을 때 호출됩니다.
   * @param data - {@link PeerData<WebRtcDispatchPayload>} 형태의 데이터
  */
  [HandlerType.SEND] : SendHandler;

  /**
   * Peer와의 통신 중 에러가 발생 시 호출됩니다.
  */
  [HandlerType.ERROR] : ErrorHandler;

  /**
   * 연결 종료 상태를 전달합니다.
   * @param state - {@link DisconnectType} 형태의 상태 값
  */
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
export type MessageHandler = (data ?: ResponseData) => void;
export type ErrorHandler = (err ?: Error | unknown) => void;
export type SendHandler = (data ?: PeerData<WebRtcDispatchPayload>) => void;
export type DisconnectHandler = (state ?: DisconnectType) => void;

export interface WebRtcConfig {
  maxReconnectCount ?: number;
  reconnectTimeout ?: number;
}

export const enum PeerDataType {
  SYNC = "SYNC",
  UPDATE = "UPDATE"
}

export interface PeerData<T = SnapshotPayload | WebRtcDispatchPayload> {
  data: T;
  timestamp: number;
  type: PeerDataType;
  senderId: PeerID;
}

export type ResponseData = 
  | (Omit<PeerData<SnapshotPayload>, 'type'> & { type: PeerDataType.SYNC })
  | (Omit<PeerData<WebRtcDispatchPayload>, 'type'> & { type: PeerDataType.UPDATE });

export const enum DisconnectType {
  SUCCESS = "SUCCESS",
  RECONNECT_FAIL = "FAILED",
  RECONNECT_RETRY = "RETRY",
  SIGNAL_FAIL = "SIGNAL_FAIL",
  SIGNAL_SUCCESS = "SIGNAL_SUCCESS"
}

export interface InitPromise {
  promise : Promise<string>
  resolve : (peerId : PeerID) => void
  reject : (err: Error) => void
}