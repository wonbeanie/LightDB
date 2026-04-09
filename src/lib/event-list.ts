import type { Database, DatabaseConfig, DatabaseData, DatabaseEntries } from "./type/database.js";
import type { HandlerType, PeerEventMap, PeerID, WebRtcConfig, WebRtcDispatchPayload } from "./type/web-rtc.js";

export const enum EVENT_LIST {
  UPDATE_DATABASE = "database:update",

  REQUEST_PEER_SEND = "peer:send",
  REQUEST_PEER_CONNECT = "peer:connect",

  UPDATE_COMPLETE_DATABASE = "database:update:complete",

  ON_LISTENER = "on:listener",
  OFF_LISTENER = "off:listener",

  SET_WEBRTC_CONFIG = "webrtc:set:config",
  SET_DATABASE_CONFIG = "database:set:config",

  COMPLETE_JOIN_ROOM = "room:join:complete",
  REQUEST_SYNC_DATABASE = "database:sync:request",
  APPLY_DATABASE_SNAPSHOT = "database:apply:snapshot"
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
  [EVENT_LIST.SET_WEBRTC_CONFIG] : WebRtcConfig | undefined;
  [EVENT_LIST.SET_DATABASE_CONFIG] : DatabaseConfig | undefined;
  [EVENT_LIST.COMPLETE_JOIN_ROOM] : PeerID;
  [EVENT_LIST.REQUEST_SYNC_DATABASE] : {
    database : Database,
    peerId : PeerID
  };
  [EVENT_LIST.APPLY_DATABASE_SNAPSHOT] : DatabaseEntries;
}