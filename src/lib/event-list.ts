import type { CloseHandler, ConnectionHandler, ErrorHandler, HandlerType, MessageHandler, PeerEventMap, PeerID, SendHandler, WebRtcDispatchPayload } from "./type/web-rtc.js";

export const enum EVENT_LIST {
  UPDATE_DATABASE = "database:update",

  REQUEST_PEER_SEND = "peer:send",
  REQUEST_PEER_CONNECT = "peer:connect",

  UPDATE_COMPLETE_DATABASE = "database:update:complete",

  ON_LISTENER = "on:listener",
  OFF_LISTENER = "off:listener"
}

export interface EventMap {
  [EVENT_LIST.UPDATE_DATABASE] : WebRtcDispatchPayload;

  [EVENT_LIST.REQUEST_PEER_SEND] : WebRtcDispatchPayload;
  [EVENT_LIST.REQUEST_PEER_CONNECT] : PeerID;

  [EVENT_LIST.UPDATE_COMPLETE_DATABASE] : void;

  [EVENT_LIST.ON_LISTENER] : {
    event : HandlerType,
    handler : PeerEventMap[HandlerType],
  };

  [EVENT_LIST.OFF_LISTENER] : HandlerType;
}