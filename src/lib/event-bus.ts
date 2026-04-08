import type { EVENT_LIST } from "./event-list.js";

export class EventBus<T extends Record<EVENT_LIST, unknown>> {
  listenerList: { [K in keyof T]?: Listener<T[K]>[]} = {};

  emit<K extends keyof T>(event: K, ...args: T[K] extends void ? [] : [data: T[K]]){
    const listeners = this.listenerList[event];
    if(listeners){
      listeners.forEach((callback)=>callback(args[0] as T[K]));
    }
  }

  on<K extends keyof T>(event: K, listener: Listener<T[K]>){
    if(!this.listenerList[event]){
      this.listenerList[event] = [];
    }
    this.listenerList[event]!.push(listener);
  }

  off<K extends keyof T>(event: K){
    delete this.listenerList[event];
  }

  destroy(){
    this.listenerList = {};
  }
}

type Listener<T> = (data: T) => void;