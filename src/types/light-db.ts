import type { DatabaseConfig } from "./database.js";
import type { WebRtcConfig } from "./web-rtc.js";

export interface Config {
  database ?: DatabaseConfig;
  webRtc ?: WebRtcConfig
}