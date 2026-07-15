const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertSecureBaseUrl(raw: string): string {
  const url = new URL(raw);
  const isLocalHttp = url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      `WEALTHAPI_BASE_URL must use https (or http on localhost), got: ${url.protocol}//${url.host}`
    );
  }
  return raw;
}
