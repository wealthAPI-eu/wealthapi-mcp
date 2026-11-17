import pino from "pino";

const LEVELS = ["debug", "info", "warn", "error"];

function readLevel(): string {
  const level = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVELS.includes(level) ? level : "info";
}

export const logger = pino({ level: readLevel() }, process.stderr);
