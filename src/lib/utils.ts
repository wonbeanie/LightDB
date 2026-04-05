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

export function formatNow(): string {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}