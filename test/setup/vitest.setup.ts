import { MockPeer } from "../mock/mock-peerjs.js"

vi.mock('peerjs', () => {
  return {
    default: MockPeer,
    Peer: MockPeer
  }
});