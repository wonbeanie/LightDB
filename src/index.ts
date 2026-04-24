import { LightDBEngine } from "./lib/engine.js";
import { DB_PATH, type DatabaseData } from "./types/database.js";
import type { Config } from "./types/light-db.js";
import type { StorageEngine } from "./types/storage.js";
import type { HandlerType, PeerEventMap } from "./types/web-rtc.js";

const internals = new WeakMap<LightDB, {
  engine : LightDBEngine
}>();

/**
 * WebRTC 기반의 실시간 P2P 데이터베이스 메인 클래스입니다.
 * @see {@link LightDBEngine}
 */
export class LightDB {

  /**
   * 현재 메모리에 로드된 데이터베이스의 전체 레코드 객체
   */
  public database = {};

  /**
   * 방장의 상태를 구분하는 변수
   */
  public roomChief = false;

  /**
   * 현재 접속 중인 방의 아이디
   */
  public roomId : string | null = null;

  /**
   * 현재 {@link database}를 업데이트한 시간
   * @remarks - 'YYYY-MM-DD hh:mm:ss' 형식으로 표현하고있습니다.
   */
  public updateTimestamp : string = "";

  /**
   * 새로운 LightDB 인스턴스를 생성
   * @param [config] - 외부 커스텀 {@link Config} 객체 (선택 사항)
   * @param [storage] - 데이터를 저장할 {@link LightStorage} 구현체 (선택 사항)
   */
  constructor(config ?: Config, storage ?: StorageEngine){
    const engine = new LightDBEngine(config, storage);

    engine.onUpdateComplete = () => {
      this.database = engine.database;
      this.roomChief = engine.roomChief;
      this.roomId = engine.roomId;
      this.updateTimestamp = engine.updateTimestamp;
    }

    internals.set(this, {
      engine
    });
  }

  /**
   * 데이터베이스 방을 생성하고 자신을 방장으로 설정합니다.
   * @param [storageKey] - 저장될 저장소의 키 (선택사항)
   * @returns 생성된 방의 Peer 아이디를 담은 Promise
   */
  async createRoom(storageKey ?: string){
    const {engine} = internals.get(this)!;
    if(storageKey){
      engine.onSetStorageKey(storageKey);
    }
    return engine.createRoom();
  }

  /**
   * 데이터베이스 방을 생성하고 자신을 방장으로 설정합니다.
   * @param targetId - 참여하고자 하는 방 아이디 {@link roomId}
   * @returns 생성된 방의 Peer 아이디를 담은 Promise
   */
  async joinRoom(targetId: string){
    const {engine} = internals.get(this)!;
    engine.joinRoom(targetId);
  }

  /**
   * 데이터베이스 변경사항을 구독하기 위한 메서드
   * @param table - 구독할 테이블 키
   * @param handler - 데이터 변경 시 실행될 콜백 함수
   */
  on(table : string, handler : Function){
    const {engine} = internals.get(this)!;
    engine.on(table, handler);
  }

  /**
   * 데이터베이스 변경사항 구독을 취소하기 위한 메서드
   * @param table - 변경사항 구독을 취소할 키
   */
  off(table : string){
    const {engine} = internals.get(this)!;
    engine.off(table);
  }

  /**
   * 데이터베이스의 특정 테이블 데이터를 업데이트하는 메서드
   * @param table - 업데이트할 테이블 키 (기본값: {@link DB_PATH.ROOT})
   * @param data - 저장할 {@link DatabaseData} 객체
   */
  async update(table : string = DB_PATH.ROOT, data : DatabaseData){
    const {engine} = internals.get(this)!;
    return engine.update(table, data);
  }

  /**
   * 데이터베이스의 모든 데이터를 삭제하고 초기화하는 메서드
   */
  async clear(){
    const {engine} = internals.get(this)!;
    return engine.clear();
  }

  /**
   * WebRTC의 변경사항을 구독하기 위한 메서드
   * @param event - 설정할 핵심 이벤트 {@link HandlerType}
   * @param handler - 할당할 핸들러 {@link PeerEventMap}
   */
  onPeer<K extends HandlerType>(event : K, handler: PeerEventMap[K]){
    const {engine} = internals.get(this)!;
    engine.onPeer(event, handler);
  }

  /**
   * WebRTC의 변경사항 구독을 해제하기 위한 메서드
   * @param event - 설정할 핵심 이벤트 {@link HandlerType}
   */
  offPeer<K extends HandlerType>(event : K){
    const {engine} = internals.get(this)!;
    engine.offPeer(event);
  }

  /**
   * 메모리 할당 해제를 위한 메서드
   */
  destroy(){
    const {engine} = internals.get(this)!;
    engine.destroy();
    internals.delete(this);
  }

  /**
   * 데이터베이스의 특정 테이블 데이터를 삭제하는 메서드
   * @param table - 삭제할 테이블 키
   */
  remove(table: string){
    const {engine} = internals.get(this)!;
    engine.remove(table);
  }
}

const lightDB = new LightDB();
export default lightDB;