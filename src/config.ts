import "dotenv/config";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  apiBaseUrl: string;
  bearerToken: string;
  logLevel: LogLevel;
}

const bearerToken = process.env.BEARER_TOKEN;
if (!bearerToken) {
  throw new Error("Missing required environment variable: BEARER_TOKEN");
}

const validLogLevels: LogLevel[] = ["debug", "info", "warn", "error"];
const rawLogLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;

export const config: Config = {
  apiBaseUrl: "https://wealthapi.eu/api",
  bearerToken,
  logLevel: validLogLevels.includes(rawLogLevel) ? rawLogLevel : "info",
};
