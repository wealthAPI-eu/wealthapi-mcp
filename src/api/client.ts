import { config } from "../config.js";
import { logger } from "../util/logger.js";

const MAX_RETRIES_5XX = 2;
const MAX_RETRIES_429 = 3;

type QueryValue = string | number | boolean | string[] | number[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export class ApiClient {
  async get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.execute<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.execute<T>("POST", path, { body });
  }

  private async execute<T>(
    method: string,
    path: string,
    options: { params?: QueryParams; body?: unknown },
    retryCount = 0
  ): Promise<T> {
    const url = buildUrl(config.apiBaseUrl, path, options.params);
    const fetchInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.bearerToken}`,
      },
    };
    if (options.body !== undefined) {
      fetchInit.body = JSON.stringify(options.body);
    }

    logger.info(`→ ${method} ${path}`);

    let res: Response;
    let text: string;
    try {
      res = await fetch(url, fetchInit);
      text = await res.text();
    } catch (err) {
      if (retryCount < MAX_RETRIES_5XX) {
        const delay = retryCount === 0 ? 500 : 1500;
        logger.warn({ method, path, attempt: retryCount + 1 }, "Retrying after network error");
        await sleep(delay);
        return this.execute<T>(method, path, options, retryCount + 1);
      }
      throw new Error(`Network error calling ${method} ${path}: ${err}`);
    }

    logger.info(`← ${res.status} ${method} ${path} (${text.length} bytes)`);

    if (res.status === 429 && retryCount < MAX_RETRIES_429) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000;
      logger.warn({ method, path, delay }, "Rate limited, backing off");
      await sleep(delay);
      return this.execute<T>(method, path, options, retryCount + 1);
    }

    if (res.status >= 500 && retryCount < MAX_RETRIES_5XX) {
      const delay = retryCount === 0 ? 500 : 1500;
      logger.warn({ method, path, status: res.status }, "Server error, retrying");
      await sleep(delay);
      return this.execute<T>(method, path, options, retryCount + 1);
    }

    if (!res.ok) {
      throw new Error(`API error ${res.status} on ${method} ${path}: ${text}`);
    }

    return JSON.parse(text) as T;
  }
}

export function buildUrl(baseUrl: string, path: string, params?: QueryParams): string {
  const url = new URL(`${baseUrl}${path}`);
  if (!params) return url.toString();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
