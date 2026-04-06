export const enum EVENT_LIST {
  UPDATE_DATABASE = "database:update",
  ERROR_DISPATCH = "error:dispatch",


  CREATE_COMPLETE_ROOM = "room:create:complete",

  REQUEST_INIT_ROOM = "room:init",
  REQUEST_JOIN_ROOM = "room:join",
  ADD_DATABASE_LISTENER = "database:add:listener",

  REQUEST_PEER_SEND = "peer:send",
  REQUEST_PEER_CONNECT = "peer:connect",

  UPDATE_COMPLETE_DATABASE = "database:update:complete",

  ON_CONNECTION = "on:connection",
  ON_CLOSE = "on:close",
  ON_MESSAGE = "on:message",
  ON_SEND = "on:send",
  ON_ERROR = "on:error"
}