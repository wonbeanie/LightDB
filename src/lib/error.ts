import type { ErrorType } from "../types/utils.js";

export class LDBError extends Error {
  type : ErrorType;

  constructor(type : ErrorType, message: string, cause ?: unknown){
    super(message, {
      cause: cause ?? undefined
    });
    this.name = "LDBError"
    this.type = type;
    this.cause = cause;
  }
}