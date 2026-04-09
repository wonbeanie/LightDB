import type { DatabaseEntries } from "../type/database.js";
import { PeerDataType, type PeerData, type PeerID, type WebRtcDispatchPayload } from "../type/web-rtc.js";

// export class PeerData<T extends DatabaseEntries | WebRtcDispatchPayload> {
//   data : T;
//   timestamp: number;
//   type : PeerDataType;

//   constructor(data : T, type : PeerDataType = PeerDataType.UPDATE){
//     this.data = data;
//     this.timestamp = Date.now();
//     this.type = type;
//   }
// }

export const createPeerData = <T extends DatabaseEntries | WebRtcDispatchPayload>(
  data: T,
  senderId: PeerID,
  type: PeerDataType = PeerDataType.UPDATE,
) : PeerData<T> => {
  return {
    data,
    timestamp: Date.now(),
    type,
    senderId
  }
};