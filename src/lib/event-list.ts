import type { CloseHandler, ConnectionHandler, ErrorHandler, MessageHandler, PeerID, SendHandler, WebRtcDispatchPayload } from "./type/web-rtc.js";

export const enum EVENT_LIST {
  UPDATE_DATABASE = "database:update",

  REQUEST_PEER_SEND = "peer:send",
  REQUEST_PEER_CONNECT = "peer:connect",

  UPDATE_COMPLETE_DATABASE = "database:update:complete",

  ON_CONNECTION = "on:connection",
  ON_CLOSE = "on:close",
  ON_MESSAGE = "on:message",
  ON_SEND = "on:send",
  ON_ERROR = "on:error"
}

export interface EventMap {
  [EVENT_LIST.UPDATE_DATABASE] : WebRtcDispatchPayload;

  [EVENT_LIST.REQUEST_PEER_SEND] : WebRtcDispatchPayload;
  [EVENT_LIST.REQUEST_PEER_CONNECT] : PeerID;

  [EVENT_LIST.UPDATE_COMPLETE_DATABASE] : void;

  [EVENT_LIST.ON_CONNECTION] : ConnectionHandler;
  [EVENT_LIST.ON_CLOSE] : CloseHandler;
  [EVENT_LIST.ON_MESSAGE] : MessageHandler;
  [EVENT_LIST.ON_SEND] : SendHandler;
  [EVENT_LIST.ON_ERROR] : ErrorHandler;
}