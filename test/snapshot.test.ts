import { Snapshot } from "../src/dto/snapshot.js";
import { errorHandler } from "../src/lib/utils.js";
import type { Database } from "../src/types/database.js";

describe("Snapshot 테스트", () => {
  describe("데이터 직렬화, 역직렬화 테스트", () => {
    let mockSnapshot : Snapshot;
    let mockDatabase : Database;

    beforeEach(()=>{
      mockDatabase = new Map();
      mockDatabase.set("user", {id: 1, name : "test", age : 22});
      mockDatabase.set("monster", {id: 1, name : "mons", age : 550});
      mockSnapshot = new Snapshot(mockDatabase, 1000);
    });

    test("데이터를 직렬화하여 반환해야 한다.", () => {
      const serialized = Snapshot.serialize(mockSnapshot);

      expect(serialized).toEqual({
        database : [
          ["user", {id: 1, name : "test", age : 22}],
          ["monster", {id: 1, name : "mons", age : 550}]
        ],
        updateTimestamp : 1000
      });
    });

    test("데이터가 없을때 빈 배열을 반환해야 한다.", () => {
      mockSnapshot = new Snapshot(new Map(), 1000);
      const serialized = Snapshot.serialize(mockSnapshot);

      expect(serialized).toEqual({
        database : [],
        updateTimestamp : 1000
      });
    });

    test("데이터를 역직렬화하여 반환해야 한다.", () => {
      const serialized = Snapshot.serialize(mockSnapshot);
      const deserialize = Snapshot.deserialize(serialized);

      expect(deserialize).toStrictEqual(
        new Snapshot(mockDatabase, 1000)
      );
    });
  })

  describe("데이터 문자열, 파싱 테스트", () => {
    let mockDatabase : Database;
    let mockSnapshot : Snapshot;

    beforeEach(() => {
      mockDatabase = new Map();
      mockDatabase.set("user", {id: 1});

      mockSnapshot = new Snapshot(mockDatabase, 1000);
    })
    
    test("데이터를 문자열화하여 반환해야 한다.", () => {
      const str = Snapshot.stringify(mockSnapshot);

      expect(str).toBe('{"database":{"user":{"id":1}},"updateTimestamp":1000}');
    });

    test("문자열화된 데이터를 Snapshot 객체로 변환하여 반환해야 한다.", () => {
      const str = Snapshot.stringify(mockSnapshot);


      expect(Snapshot.parse(str)).toStrictEqual(
        new Snapshot(mockDatabase, 1000)
      );
    });
  })

  describe("구조가 올바른 형식이 아닐때", () => {
    beforeEach(()=>{
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    test("payload를 역직렬화시 에러를 던저야 된다.", () => {
      const mockPayload = {
        database : {
          user : {id: 1, name : "test", age : 22},
          monster : {id: 1, name : "mons", age : 550}
        },
        updateTimestamp : 1000
      } as any;
      expect(() => Snapshot.deserialize(mockPayload)).toThrow("[Snapshot] Received invalid snapshot payload format.");
    });

    test("문자열를 변환시 에러를 던저야 된다.", () => {
      let mockText = '{invalid}';
      const errorMessage = "[Snapshot] Failed to convert string to object";
      expect(() => Snapshot.parse(mockText)).toThrow(errorMessage);

      mockText = '{"updateTimestamp" : 1000}';
      expect(() => Snapshot.parse(mockText)).toThrow(errorMessage);
    });
  })
})