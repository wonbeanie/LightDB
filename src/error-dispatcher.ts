import eventBus from "./lib/event-bus.js";
import { EVENT_LIST } from "./lib/event-list.js";
import type { ErrorHandler } from "./lib/type/web-rtc.js";

class ErrorDispatcher {
  onError : ErrorHandler | null = null;

  constructor(){
    eventBus.on(EVENT_LIST.ERROR_DISPATCH, (error) => this.dispatch(error as Error));
  }

  dispatch(error : Error){
    if(this.onError){
      this.onError(error);
    }
    console.error("[LightDB Error]", error);
  }
}

const errorDispatcher = new ErrorDispatcher();
export default errorDispatcher;