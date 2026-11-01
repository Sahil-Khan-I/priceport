import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafeHttpUrl } from "../lib/security/urls.ts";

describe("assertSafeHttpUrl", () => {
  it("allows https provider URLs", () => {
    const url = assertSafeHttpUrl("https://www.booking.com/hotel/ae/atlantis.html");
    assert.match(url, /^https:\/\//);
  });

  it("rejects localhost", () => {
    assert.throws(() => assertSafeHttpUrl("http://localhost:3000"), /local/i);
  });

  it("rejects private IPs", () => {
    assert.throws(() => assertSafeHttpUrl("https://192.168.1.10/admin"), /Private/);
  });

  it("rejects non-http schemes", () => {
    assert.throws(() => assertSafeHttpUrl("file:///etc/passwd"), /http/i);
  });

  it("rejects invalid URLs", () => {
    assert.throws(() => assertSafeHttpUrl("not-a-url"), /Invalid/);
  });
});
