import type { DatabaseEntries } from "../type/database.js";
import { PeerDataType, type PeerData, type PeerID, type WebRtcDispatchPayload } from "../type/web-rtc.js";

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