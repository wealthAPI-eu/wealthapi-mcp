import { describe, it, expect } from "vitest";

import { assertSecureBaseUrl } from "../../src/util/base-url.js";

describe("assertSecureBaseUrl", () => {
  it("assertSecureBaseUrl returns https URLs unchanged", () => {
    expect(assertSecureBaseUrl("https://www.wealthapi.eu/api")).toBe(
      "https://www.wealthapi.eu/api"
    );
  });

  it("assertSecureBaseUrl allows http on localhost", () => {
    expect(assertSecureBaseUrl("http://localhost:8080/api")).toBe("http://localhost:8080/api");
  });

  it("assertSecureBaseUrl allows http on 127.0.0.1", () => {
    expect(assertSecureBaseUrl("http://127.0.0.1:8080/api")).toBe("http://127.0.0.1:8080/api");
  });

  it("assertSecureBaseUrl allows http on IPv6 loopback", () => {
    expect(assertSecureBaseUrl("http://[::1]:8080/api")).toBe("http://[::1]:8080/api");
  });

  it("assertSecureBaseUrl rejects http on non-local hosts", () => {
    expect(() => assertSecureBaseUrl("http://www.wealthapi.eu/api")).toThrow(
      "must use https"
    );
  });

  it("assertSecureBaseUrl rejects invalid URLs", () => {
    expect(() => assertSecureBaseUrl("not a url")).toThrow();
  });
});
