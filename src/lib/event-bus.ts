import type { EVENT_LIST } from "./event-list.js";

class EventBus {
  listenerList = new Map<EVENT_LIST, Listener[]>();

  emit(event : EVENT_LIST, data ?: unknown){
    const listeners = this.listenerList.get(event);
    if(listeners){
      listeners.forEach((callback)=>{
        callback(data);
      })
    }
  }

  on(event : EVENT_LIST, listener : Listener){
    const listeners = this.listenerList.get(event);

    if(!listeners){
      this.listenerList.set(event, [listener]);
      return;
    }

    listeners.push(listener);
    this.listenerList.set(event, listeners);
  }

  off(event : EVENT_LIST){
    this.listenerList.delete(event);
  }
}

const eventBus = new EventBus();
export default eventBus;

type Listener = (data : unknown) => void;