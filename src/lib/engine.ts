import { LiveDatabase } from "./database.js";
import { DB_PATH, type DatabaseData } from "../types/database.js";
import type { Config } from "../types/light-db.js";
import type { StorageEngine } from "../types/storage.js";
import type { HandlerType, PeerEventMap } from "../types/web-rtc.js";
import { WebRTC } from "./web-rtc.js";
import { LightStorage } from "./storage.js";
import { errorHandler, formatNow } from "./utils.js";
import type { LightDB } from "../index.js";
import { ErrorType } from "../types/utils.js";

/**
 * LightDB의 핵심 엔진 클래스입니다.
 * @remarks LightStorage와 WebRtc을 조율하는 역할을 합니다.
 */
export class LightDBEngine {
  public db : LiveDatabase;
  public rtc : WebRTC;
  public storage : LightStorage;

  /**
   * 현재 {@link LightStorage.database}를 업데이트한 시간
   * @remarks - 'YYYY-MM-DD hh:mm:ss' 형식으로 표현하고있습니다.
   */
  public updateTimestamp : string = "";

  /**
   * 방장의 상태를 구분하는 변수
   */
  public roomChief = false;

  /**
   * 방장의 PeerID를 담고있는 변수
   */
  public roomId : string | null = null;

  /**
   * 진입점(index)에서 사용할 변수들을 업데이트하기 위한 메서드
   * @remark 명시적 콜백을 위한 메서드
   */
  public onUpdateComplete : () => void = () => {};
  
  /**
   * 새로운 LightDB 인스턴스를 생성
   * @see {@link LightDB}
   */
  constructor(config : Config = {}, storage ?: StorageEngine){
    this.storage = new LightStorage(storage);
    this.db = new LiveDatabase(this.storage, config.database);
    this.rtc = new WebRTC(config.webRtc);
    
    this.db.onSend = (data) => this.rtc.send(data);
    this.db.onUpdateComplete = () => {
      this.updateTimestamp = formatNow();
      this.roomChief = this.db.roomChief;
      this.onUpdateComplete();
    };
    this.db.onError = config.onError ?? (() => {});
    
    this.rtc.onGetSnapshot = () => this.db.getSnapshot();
    this.rtc.onUpdateDatabase = (data) => this.db.onValue(data);
    this.rtc.onSyncDatabase = (snapshot) => this.db.syncDatabase(snapshot);
    this.rtc.onGetIsRoomChief = () => this.db.roomChief;
    this.rtc.onStorageClear = () => this.storage.clear();
  }

  /**
   * 외부에서 커스텀 키를 받아 저장소에 전파하기 위한 메서드
   * @see {@link LightStorage.onSetStorageKey}
   */
  public onSetStorageKey = (key : string) => {
    this.db.onSetStorageKey(key)
  };
  
  /**
   * 데이터베이스 방을 생성하고 자신을 방장으로 설정합니다.
   * @param resetStorage 기존에 저장된 저장소를 초기화하여 시작할지 여부 (기본값 : false)
   * @returns 생성된 방의 Peer 아이디를 담은 Promise
   * @throws WebRTC 초기화에 실패하거나 방 생성 실패시 발생
   */
  public async createRoom(resetStorage = false){
    try{
      const peerId = await this.rtc.init(resetStorage);
      this.db.roomChief = true;
      this.roomChief = true;
      this.roomId = peerId;
      this.onUpdateComplete();
      return peerId;
    }
    catch(err){
      throw errorHandler(ErrorType.LIGHTDB, 'Create Room Failed:', err);
    }
  }

  /**
   * 지정된 방 ID를 가진 기존 방에 참여합니다.
   * @param targetId - 참여하고자 하는 방장의 고유 Peer 아이디
   * @param resetStorage 기존에 저장된 저장소를 초기화하여 시작할지 여부 (기본값 : false)
   * @throws WebRtc 초기화에 실패, 방장과의 연결 수립 실패시 발생
   */
  public async joinRoom(targetId: string, resetStorage = false){
    return new Promise(async (resolve, reject) => {
      try{
        await this.rtc.init(resetStorage);
        await this.rtc.connect(targetId);
        this.roomId = targetId;
        this.onUpdateComplete();
        resolve(true);
      }
      catch(err){
        reject(errorHandler(ErrorType.LIGHTDB, 'Join Room Failed:', err));
      }
    });
  }

  /**
   * 데이터베이스 변경사항을 구독하기 위한 메서드 
   * @see {@link LiveDatabase.addDBListener}
   */
  public on(table : string, handler : Function){
    this.db.addDBListener(table, handler);
  }

  /**
   * 데이터베이스 변경사항 구독을 취소하기 위한 메서드 
   * @see {@link LiveDatabase.removeDBListener}
   */
  public off(table : string){
    this.db.removeDBListener(table);
  }

  /**
   * 데이터베이스의 특정 테이블 데이터를 업데이트하는 메서드
   * @see {@link LiveDatabase.updateDB}
   */
  public async update(table : string = DB_PATH.ROOT, data : DatabaseData){
    return this.db.updateDB(table, data);
  }

  /**
   * 데이터베이스의 모든 데이터를 삭제하고 초기화하는 메서드
   * @returns - 전체 데이터베이스 레코드 {@link DatabaseRecord}를 반환하는 Promise
   */
  public async clear(){
    return this.db.updateDB(DB_PATH.ROOT, {}, true);
  }

  /**
   * WebRTC의 변경사항을 구독하기 위한 메서드
   * @see {@link WebRTC.setHandler}
   */
  public onPeer<K extends HandlerType>(event : K, handler: PeerEventMap[K]){
    this.rtc.setHandler(event, handler);
  }

  /**
   * WebRTC의 변경사항 구독을 해제하기 위한 메서드
   * @see {@link WebRTC.setHandler}
   */
  public offPeer<K extends HandlerType>(event : K){
    this.rtc.setHandler(event, () => {});
  }

  /**
   * 메모리 할당 해제를 위한 메서드
   */
  public destroy(){
    this.rtc.destroy();
    this.db.destroy();
    this.roomId = null;
    this.roomChief = false;
  }

  /**
   * 데이터베이스의 특정 테이블 데이터를 삭제하는 메서드
   * @see {@link LiveDatabase.removeTable}
   */
  public async remove(table : string){
    return this.db.removeTable(table);
  }

  /**
   * 현재 메모리에 로드된 전체 데이터베이스의 레코드 객체
   */
  get database(){
    return this.db.database;
  }
}