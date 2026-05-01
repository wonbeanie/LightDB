import type { Snapshot } from "../dto/snapshot.js";
import { LightStorage } from "./storage.js";
import { errorHandler, removeNull } from "./utils.js";
import { DB_PATH, type DatabaseConfig, type DatabaseData, type DatabaseRecord, type Listener, type ListenerHandler, type ListenerKey, type ResolveQueueId, type TableKey, type UpdateResolveQueue } from "../types/database.js";
import type { WebRtcDispatchPayload } from "../types/web-rtc.js";
import { ErrorType } from "../types/utils.js";

/**
 * 사용자의 데이터를 관리하는 클래스입니다.
 * @remark 방장이 아닌 사용자는 변경사항을 방장과 통신하여 결과를 받아 업데이트 처리됩니다.
 */
export class LiveDatabase {
  private storage : LightStorage;

  /**
   * DB 상태 변경에 대해 구독을 관리하기 위한 맵 객체
   */
  private listener : Listener = new Map();

  /**
   * 동시 DB 업데이트 처리를 위한 Map 기반의 큐
   */
  private updateResolveQueue : UpdateResolveQueue = new Map();

  /**
   * 방장 구분을 위한 변수
   */
  public roomChief = false;

  /**
   * DB 업데이트시 시간 초과에 대한 최소 시간(ms)
   */
  private updateTimeout : number = 5000;

  /**
   * 동시 DB 업데이트 처리시 중복을 피하기 위한 변수
   */
  private lastResolveQueueId = 1;

  /**
   * WebRtc에 방장에게 변경사항을 요청하는 메서드
   * @remark 명시적 콜백을 위한 메서드
   */
  public onSend : (data : WebRtcDispatchPayload) => void = () => {};

  /**
   * 데이터 변경이 완료 이후에 사용되는 메서드
   * @remark 명시적 콜백을 위한 메서드
   */
  public onUpdateComplete : () => void = () => {};

  /**
   * 새로운 데이터베이스 인스턴스를 생성
   * @param storage - 데이터를 저장할 {@link LightStorage} 구현체
   * @param [config] - 외부 커스텀 {@link DatabaseConfig} 객체 (선택 사항)
   */
  constructor(storage : LightStorage, config : DatabaseConfig = {}){
    this.updateTimeout = config?.updateTimeout ?? this.updateTimeout;
    this.storage = storage;
  }

  /**
   * 외부에서 커스텀 키를 받아 저장소에 전파하기 위한 메서드
   * @see {@link LightStorage.onSetStorageKey}
   */
  public onSetStorageKey = (key : string) => {
    this.storage.onSetStorageKey(key);
  };

  /**
   * 엔진을 통한 데이터 동기화를 위한 메서드
   * @param snapshot - 동기화 할 {@link Snapshot} 객체
   */
  public syncDatabase(snapshot : Snapshot){
    this.storage.syncStorage(snapshot);
    this.onUpdateComplete();
  }

  /**
   * 데이터베이스 변경사항을 구독하기 위한 메서드
   * @param tableKey - 구독할 테이블 키
   * @param dbHandler - 데이터 변경 시 실행될 콜백 함수
   */
  public addDBListener(tableKey : TableKey, dbHandler : ListenerHandler){
    this.listener.set(tableKey, (data : DatabaseData | null) => dbHandler(data));
  }

  /**
   * 외부에서 데이터베이스 변경사항 구독을 취소하기 위한 메서드
   * @param listenerKey - 변경사항 구독을 취소할 Key
   */
  public removeDBListener(listenerKey : ListenerKey){
    this.listener.delete(listenerKey);
  }

  /**
   * 데이터베이스를 업데이트하고 변경 사항이 동기화 될 때까지 대기하는 메서드
   * @param table - 업데이트할 테이블 키 (기본값: {@link DB_PATH.ROOT})
   * @param data - 저장할 {@link DatabaseData} 객체
   * @param [clear] - true일 경우 초기화, 기본값일 경우 전체 초기화 (선택 사항)
   * @returns 업데이트가 완료된 후의 전체 데이터베이스 레코드 {@link DatabaseRecord}
   * @throws 업데이트 타임아웃 또는 처리 실패 시 발생
   */
  public async updateDB(table : TableKey = DB_PATH.ROOT, data : DatabaseData, clear = false){
    try {
      const ResolveQueueId : ResolveQueueId = `${Date.now()}-${this.lastResolveQueueId}`;
      this.lastResolveQueueId += 1;

      if(this.roomChief){
        this.onValue({
          id : ResolveQueueId,
          data,
          table,
          clear,
        }, false);
      }
      
      const promise = this.checkUpdate(ResolveQueueId);

      if(Object.keys(data).length > 0 || clear){
        this.onSend({
          id : ResolveQueueId,
          table,
          data,
          clear,
        });
      }

      const newDatabase = await promise;

      this.onUpdateComplete();
      return newDatabase;
    }
    catch(error){
      throw errorHandler(ErrorType.DATABASE, 'Database Update Failed:', error);
    }
  }

  /**
   * 비동기적인 DB 업데이트를 감지를 위해 큐에 추가하는 메서드
   */
  private async checkUpdate(id : ResolveQueueId) : Promise<DatabaseRecord>{
    return new Promise((resolve, reject)=>{
      if(this.roomChief){
        resolve(this.database);
        return;
      }
      
      const timeoutId = setTimeout(()=>{
        reject(new Error("Database Update Timeout"));
        this.updateResolveQueue.delete(id);
      }, this.updateTimeout);

      this.updateResolveQueue.set(id, {
        resolve : resolve,
        reject: reject,
        timeoutId
      });
    });
  }

  /**
   * 실질적인 데이터베이스를 업데이트하는 메서드
   * @remarks 최종 데이터베이스의 `null` 값은 해당 키를 물리적으로 제거하는 '삭제' 신호로 처리됩니다.
   * @param payload - 데이터 업데이트에 필요한 {@link WebRtcDispatchPayload} 객체
   * @param [send] - 업데이트 완료 후 방장에게 데이터를 보낼 것인지에 대한 변수 (기본값: true)
   */
  public onValue({id, table, data, clear = false} : WebRtcDispatchPayload, send = true){
    if(clear){
      if(table === DB_PATH.ROOT){
        this.storage.clear();
        this.emitAllCallbackClear();
      }
      else {
        this.storage.remove(table);
        this.listener.delete(table);
      }
    }
    else {
      let prevDatabase = this.storage.get(table) || {};
      const newDatabase = removeNull({
        ...prevDatabase,
        ...data
      });

      this.storage.set(table, newDatabase);
      this.emitCallback(table, newDatabase);
    }

    if(this.updateResolveQueue.size > 0){
      const resolveData = this.updateResolveQueue.get(id);
      if(resolveData){
        const {resolve, timeoutId} = resolveData;
        clearTimeout(timeoutId);
        resolve(this.database);
        this.updateResolveQueue.delete(id);
      }
    }

    
    if(this.roomChief && send){
      this.onSend({
        id,
        table,
        data,
        clear,
      });
    }

    this.onUpdateComplete();
  }

  /**
   * 구독한 리스너에 전달하는 메서드
   * @param table 업데이트한 Table Key
   * @param data 최신 {@link DatabaseData} 객체
   */
  private emitCallback(table : TableKey, data : DatabaseData){
    if(!this.listener.has(table)){
      return;
    }
    const handler = this.listener.get(table) || function(){};
    
    try{
      handler(data);
    }
    catch(err){
      throw errorHandler(ErrorType.LISTENER, 'Lisatener Error:', err);
    }
  }

  /**
   * 구독한 모든 리스너에게 초기화된 값을 전달하는 메서드
   */
  private emitAllCallbackClear(){
    try{
      for(const handler of this.listener.values()){
        handler({});
      }
    }
    catch(err){
      throw errorHandler(ErrorType.LISTENER, 'Lisatener Error:', err);
    }
  }

  /**
   * 메모리 할당 해제를 위한 메서드입니다.
   * @remark 진행 중인 비동기 업데이트 요청은 모두 reject 처리됩니다.
   */
  public destroy(){
    this.listener.clear();
    this.storage.destroy();

    if(this.updateResolveQueue.size > 0){
      this.updateResolveQueue.forEach(resolveData => {
        resolveData.reject(errorHandler(ErrorType.DATABASE, "Destroyed"));
      });
      this.updateResolveQueue.clear();
    }
  }

  public getSnapshot(){
    return this.storage.getSnapshot();
  }

  public async removeTable(table : TableKey){
    return this.updateDB(table, {}, true);
  }

  get database(){
    return Object.fromEntries(this.storage.getDatabase()) as DatabaseRecord;
  }
}