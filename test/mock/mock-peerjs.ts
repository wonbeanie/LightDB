import type { Mock } from "vitest";

export class MockPeer {
  private events: Record<string, Function> = {};
  destroyed = false;

  on(event: string, cb: Function){
    this.events[event] = cb;
    if(event == 'open'){
      cb('mock-peer-id');
    }
  }

  connect(id: string){
    const mockConn = new MockConnection(id);

    return mockConn;
  }

  destroy(){
    this.destroyed = true;
  }

  disconnect(){

  }
}

export class MockConnection {
  peer : string;
  open : boolean = false;
  listener : Map<string, Function[]> = new Map();
  
  constructor(id : string = "mock-peer-id"){
    this.peer = id;
  }

  on(event : string, cb : Function){
    if(this.listener.has(event)){
      const listenerList = this.listener.get(event) ?? [];
      listenerList.push(cb);
      this.listener.set(event, listenerList);
    }
    else {
      this.listener.set(event, [cb]);
    }

    if (event === 'open') {
      cb();
      return;
    };
  }

  close(){

  }

  send(){

  }

  listenerCount(event : string){
    return this.listener.get(event)?.length ?? 0;
  }
}

export interface MockConn {
  peer: string;
  on: (event: string, cb: Function) => void;
  close: Mock;
  send: Mock;
  listenerCount: () => number;
}