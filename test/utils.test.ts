import { errorHandler, formatNow } from "../src/lib/utils.js";

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
      const result = errorHandler(message);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(message);
    });

    test('Error 객체를 인자로 받으면 그대로 반환해야 한다', () => {
      const error = new Error('Original Error');
      const result = errorHandler(error);

      expect(result).toBe(error);
    });

    test('호출 시 console.error가 에러 메시지와 함께 실행되어야 한다', () => {
      const message = 'Log Message';
      errorHandler(message);

      expect(console.error).toHaveBeenCalledWith(message);
    });

    test('message을 문자열로 받으면 message를 추가한 새로운 Error 객체를 반환해야 한다.', () => {
      const error = new Error('Original Error');
      const message = 'Additional Message';
      const result = errorHandler(error, message);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(`${message} ${error.message}`);
    });
  });
})