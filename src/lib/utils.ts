import eventBus from "./event-bus.js";
import { EVENT_LIST } from "./event-list.js";

export function errorHandler(error : Error | string, fatal = false){
  const err = error instanceof Error ? error : new Error(error);
  eventBus.emit(EVENT_LIST.ERROR_DISPATCH, err);

  if(fatal){
    throw err;
  }
  return err;
}