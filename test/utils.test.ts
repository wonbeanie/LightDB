import { deepMerge, errorHandler, formatNow } from "../src/lib/utils.js";
import { ErrorType } from "../src/types/utils.js";

describe("유틸리티 테스트", () => {
  describe("formatNow 테스트", () => {
    afterEach(()=>{
      vi.useRealTimers();
    });

    test("현재 날짜를 포맷팅하여 반환해야된다.", ()=>{
      vi.useFakeTimers();
      const mockDate = new Date(1776150246047);
      vi.setSystemTime(mockDate);

      expect(formatNow()).toBe("2026-04-14 16:04:06");
    });
  })

  describe("에러 핸들러 테스트", ()=>{
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('문자열을 인자로 받으면 Error 객체로 변환하여 반환해야 한다', () => {
      const message = 'Test Error';
      const result = errorHandler(ErrorType.SNAPSHOT, message);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain(message);
    });

    test('Error 객체를 인자로 받으면 cause에 반영되어야 해야 한다', () => {
      const error = new Error('Original Error');
      const message = 'Additional Message';
      const result = errorHandler(ErrorType.LIGHTDB, message, error);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain(message);
      expect(result.cause).toBe(error);
    });
  });

  describe("객체 병합 테스트", () => {
    test("두 객체가 병합되어 반환되어야 한다.", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };

      const merged = deepMerge(obj1, obj2);

      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });
    
    test("객체가 다차원일때 병합되어 반환되어야 한다.", () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { b: { d: 3 }, e: 4 };

      const merged = deepMerge(obj1, obj2);

      expect(merged).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    test("객체에 null이 존재할때 그 속성은 삭제되고 반환되어야 한다.", () => {
      const obj1 = { a: 1, b: { c: 2, d : 6 } };
      const obj2 = { b: { d: null }, e: 4 };

      const merged = deepMerge(obj1, obj2);

      expect(merged).toEqual({ a: 1, b: { c: 2 }, e: 4 });
    });
  });
})