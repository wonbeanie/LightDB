import type { ErrorHandler } from "./web-rtc.js";

class ErrorDispatcher {
  onError : ErrorHandler | null = null;

  dispatch(message : string | Error){
    if(message instanceof Error){
      this.dispatch(message.message);
      return;
    }
    
    const err = new Error(message);
    if(this.onError){
      this.onError(err);
    }
    console.error("[LightDB Error]",err);
  }
}

const errorDispatcher = new ErrorDispatcher();
export default errorDispatcher;