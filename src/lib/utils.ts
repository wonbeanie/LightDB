import type { DatabaseData } from "../types/database.js";
import { ErrorType } from "../types/utils.js";
import { LDBError } from "./error.js";

export function errorHandler(type : ErrorType, message : string, error ?: unknown){
  if(error instanceof LDBError){
    return error;
  }

  let err = error instanceof Error ? error : 
            typeof error === "string" ? new Error(error) : new Error();
  
  if(type && message){
    err = new LDBError(type, `[${type}] ${message}`, err);
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

export function deepMerge(target : DatabaseData, source : DatabaseData) {
  const result = structuredClone(target);
  return mergeInto(result, source);
}

function mergeInto(target: DatabaseData, source: DatabaseData){
  for(const key in source){
    if (!Object.hasOwn(source, key)) continue;

    const sourceVal = source[key];
    const targetVal = target[key];

    if(sourceVal === null){
      delete target[key];
    }
    else if(sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
      target[key] = mergeInto(
        (targetVal && typeof targetVal === 'object' ? targetVal : {}) as DatabaseData,
        sourceVal as DatabaseData
      );
    }
    else {
      target[key] = sourceVal;
    }
  }

  return target;
}