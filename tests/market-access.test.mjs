import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_PROXY_COUNTRIES } from "../lib/tinyfish/config.ts";
import { classifyAccess } from "../lib/markets/capability.ts";
import { investigationStages } from "../lib/investigations/live-view.ts";

const DOCUMENTED = [...SUPPORTED_PROXY_COUNTRIES];

describe("proxy capability", () => {
  it("keeps TinyFish residential proxy to the documented country list", () => {
    assert.deepEqual(DOCUMENTED, ["US", "GB", "CA", "DE", "FR", "JP", "AU"]);
    const japan = classifyAccess(
      { code: "JP", name: "Japan", proxySupported: true, storefrontAvailable: true, requested: "proxy" },
      DOCUMENTED,
    );
    assert.equal(japan.accessMethod, "proxy");
    assert.equal(japan.actualProxyCountry, "JP");
    assert.equal(japan.label, "Residential proxy · Japan");
  });

  it("does not label undocumented East Asian markets as residential proxies", () => {
    for (const code of ["KR", "HK", "TW", "SG", "TH", "MY"]) {
      const access = classifyAccess(
        { code, name: code, proxySupported: false, storefrontAvailable: true },
        DOCUMENTED,
      );
      assert.equal(access.accessMethod, "storefront", code);
      assert.equal(access.actualProxyCountry, null, code);
      assert.match(access.label, /^Storefront/);
    }
  });

  it("refuses a requested proxy country that the vendor does not document", () => {
    const access = classifyAccess(
      { code: "KR", name: "South Korea", proxySupported: false, storefrontAvailable: true, requested: "proxy" },
      DOCUMENTED,
    );
    assert.equal(access.enabled, false);
    assert.equal(access.label, "Market access unavailable");
  });

  it("leaves China unavailable", () => {
    const access = classifyAccess(
      { code: "CN", name: "China", proxySupported: false, storefrontAvailable: false, requested: "unsupported" },
      DOCUMENTED,
    );
    assert.equal(access.enabled, false);
    assert.equal(access.accessMethod, "unsupported");
  });
});

describe("investigation stages", () => {
  it("does not mark comparison complete while a job is still running", () => {
    const stages = investigationStages([
      { id: "a", status: "completed", offer: { totalPrice: 10 } },
      { id: "b", status: "extracting" },
    ]);
    assert.equal(stages.find((stage) => stage.id === "prices").complete, true);
    assert.equal(stages.find((stage) => stage.id === "compare").complete, false);
  });

  it("marks comparison complete only when every job is terminal", () => {
    const stages = investigationStages([
      { id: "a", status: "completed" },
      { id: "b", status: "timed_out" },
    ]);
    assert.equal(stages.find((stage) => stage.id === "compare").complete, true);
  });
});
