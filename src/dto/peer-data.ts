import type { SnapshotPayload } from "../types/database.js";
import { PeerDataType, type PeerData, type PeerID, type WebRtcDispatchPayload } from "../types/web-rtc.js";

export const createPeerData = <T extends SnapshotPayload | WebRtcDispatchPayload>(
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