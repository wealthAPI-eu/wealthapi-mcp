import "dotenv/config";

export interface Config {
  apiBaseUrl: string;
  bearerToken: string;
}

const bearerToken = process.env.BEARER_TOKEN;
if (!bearerToken) {
  throw new Error("Missing required environment variable: BEARER_TOKEN");
}

export const config: Config = {
  apiBaseUrl: "https://wealthapi.eu/api",
  bearerToken,
};
