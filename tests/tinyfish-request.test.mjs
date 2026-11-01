import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAgentRequest, isConfigurationRejection } from "../lib/tinyfish/request.ts";
import { deriveInvestigationStatus } from "../lib/investigations/deadline.ts";
import { planRetries } from "../lib/investigations/lifecycle.ts";

const agentSource = readFileSync(new URL("../lib/tinyfish/agent.ts", import.meta.url), "utf8");

describe("TinyFish request shape", () => {
  it("does not send max steps or a beta agent config", () => {
    assert.doesNotMatch(agentSource, /max_steps|maxSteps|agent_config|agentConfig/);
    const booking = buildAgentRequest({
      url: "https://www.booking.com/hotel/ae/atlantis.html",
      goal: "Read the base room price.",
      outputSchema: { type: "object" },
      browserProfile: "lite",
      proxy: { enabled: true, country_code: "US" },
    });
    const agoda = buildAgentRequest({
      url: "https://www.agoda.com/atlantis/hotel/dubai-ae.html",
      goal: "Read the deluxe room price.",
      outputSchema: { type: "object" },
      browserProfile: "lite",
      proxy: null,
    });
    for (const request of [booking, agoda]) {
      assert.equal("max_steps" in request, false);
      assert.equal("maxSteps" in request, false);
      assert.equal("agent_config" in request, false);
      assert.equal(request.browser_profile, "lite");
      assert.equal(request.output_schema.type, "object");
    }
    assert.deepEqual(booking.proxy_config, { enabled: true, country_code: "US" });
    assert.equal("proxy_config" in agoda, false);
  });
});

describe("configuration failures", () => {
  it("does not erase another provider result or retry the rejected request", () => {
    const jobs = [
      {
        id: "booking",
        status: "completed",
        provider: "booking",
        market: "US",
        stage: "initial",
        offer: { totalPrice: 220, currency: "USD" },
      },
      {
        id: "agoda",
        status: "failed",
        provider: "agoda",
        market: "US",
        stage: "initial",
        url: "https://www.agoda.com/search",
        goal: "price",
        error: "Your account is not enabled for custom max steps yet. Join the beta program at /beta, then retry.",
      },
    ];
    assert.equal(deriveInvestigationStatus(jobs), "partial");
    assert.equal(jobs[0].offer.totalPrice, 220);
    assert.equal(isConfigurationRejection(jobs[1].error), true);
    assert.deepEqual(planRetries(jobs, null), []);
  });
});
