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

/**
 * 변경된 경로만 복사하면서 두 데이터 객체를 병합합니다.
 * @remarks `null` 값은 해당 키를 삭제하는 신호로 처리하며, 배열과 일반 객체가 아닌 값은 병합하지 않고 교체합니다.
 * @param target - 기준이 되는 데이터 객체
 * @param source - 병합할 변경 데이터 객체
 * @returns 변경이 있으면 변경 경로만 복사한 새 객체, 변경이 없으면 기존 객체
 */
export function deepMerge(target : DatabaseData, source : DatabaseData) : DatabaseData {
  return mergeWithStructuralSharing(target, source);
}

/**
 * structural sharing을 유지하며 변경 데이터만 병합합니다.
 * @param target - 기준 객체
 * @param source - 병합할 변경 객체
 * @returns 변경된 경로만 새 참조로 교체한 객체
 */
function mergeWithStructuralSharing(target: DatabaseData, source: DatabaseData) : DatabaseData{
  let result : DatabaseData | null = null;

  for(const key in source){
    if (!Object.hasOwn(source, key)) continue;

    const sourceVal = source[key];
    const targetVal = target[key];

    if(sourceVal === null){
      if(!Object.hasOwn(target, key)) continue;

      result ??= {...target};
      delete result[key];
    }
    else if(isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      const nextVal = mergeWithStructuralSharing(targetVal, sourceVal);
      if(!Object.is(nextVal, targetVal)){
        result ??= {...target};
        result[key] = nextVal;
      }
    }
    else if(isPlainObject(sourceVal)) {
      const nextVal = mergeWithStructuralSharing({}, sourceVal);
      result ??= {...target};
      result[key] = nextVal;
    }
    else {
      if(!Object.is(sourceVal, targetVal)){
        result ??= {...target};
        result[key] = sourceVal;
      }
    }
  }

  return result ?? target;
}

/**
 * 값이 병합 가능한 일반 객체인지 확인합니다.
 * @param value - 확인할 값
 * @returns 일반 객체이면 true
 */
function isPlainObject(value : unknown) : value is DatabaseData{
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
