import { errorHandler, formatNow } from "../src/lib/utils.js";
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
})