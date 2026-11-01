#!/usr/bin/env node
/**
 * Live hotel investigation harness — uses the same HTTP APIs as the app.
 *
 * Usage:
 *   npm run test:live -- --test T01
 *   npm run test:live -- --list
 *   npm run test:live -- --test T01 --base-url http://localhost:3005
 *
 * Does NOT run the full suite unless --all is passed explicitly.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "reports");

const DEFAULT_STAY = {
  checkIn: "2026-12-10",
  checkOut: "2026-12-13",
  adults: 2,
  children: 0,
  childrenAges: [],
  rooms: 1,
};

const HOTELS = {
  A: {
    name: "Atlantis The Palm",
    location: "Dubai, UAE",
    hintUrl: "https://www.atlantis.com/atlantis-the-palm",
  },
  B: {
    name: "Jumeirah Burj Al Arab",
    location: "Dubai, UAE",
    hintUrl: "https://www.jumeirah.com/",
  },
  C: {
    name: "Marina Bay Sands",
    location: "Singapore",
    hintUrl: "https://www.marinabaysands.com/",
  },
  D: {
    name: "The Leela Palace Bengaluru",
    location: "Bengaluru, India",
    hintUrl: "https://www.theleela.com/",
  },
  E: {
    name: "Hilton London Metropole",
    location: "London, UK",
    hintUrl: "https://www.hilton.com/",
  },
  F: {
    name: "Hotel Adlon Kempinski Berlin",
    location: "Berlin, Germany",
    hintUrl: "https://www.kempinski.com/",
  },
};

const SCENARIOS = {
  T01: {
    id: "T01",
    hotelKey: "A",
    provider: "booking",
    market: "GB",
    access: "proxy",
    description: "Atlantis The Palm × Booking.com × GB proxy",
  },
  T02: {
    id: "T02",
    hotelKey: "A",
    provider: "booking",
    market: "DE",
    access: "proxy",
    description: "Atlantis The Palm × Booking.com × DE proxy",
  },
  T03: {
    id: "T03",
    hotelKey: "A",
    provider: "agoda",
    market: "GB",
    access: "proxy",
    description: "Atlantis The Palm × Agoda × GB proxy",
  },
  T04: {
    id: "T04",
    hotelKey: "B",
    provider: "booking",
    market: "GB",
    access: "proxy",
    description: "Jumeirah Burj Al Arab × Booking.com × GB proxy",
  },
  T05: {
    id: "T05",
    hotelKey: "C",
    provider: "booking",
    market: "US",
    access: "proxy",
    description: "Marina Bay Sands × Booking.com × US proxy",
  },
  T06: {
    id: "T06",
    hotelKey: "D",
    provider: "booking",
    market: "IN",
    access: "storefront",
    description: "The Leela Palace Bengaluru × Booking.com × IN storefront",
  },
  T07: {
    id: "T07",
    hotelKey: "E",
    provider: "booking",
    market: "GB",
    access: "proxy",
    description: "Hilton London Metropole × Booking.com × GB proxy",
  },
  T08: {
    id: "T08",
    hotelKey: "F",
    provider: "booking",
    market: "DE",
    access: "proxy",
    description: "Hotel Adlon Kempinski Berlin × Booking.com × DE proxy",
  },
};

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PRICEPORT_BASE_URL || "http://localhost:3005",
    tests: [],
    all: false,
    list: false,
    timeoutMs: Number(process.env.LIVE_TEST_TIMEOUT_MS || 300000),
    pollMs: 5000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--all") args.all = true;
    else if (a === "--test") args.tests.push(String(argv[++i] || "").toUpperCase());
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else if (a === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const s of Object.values(SCENARIOS)) {
      console.log(`${s.id}: ${s.description}`);
    }
    return;
  }

  const selected = args.all
    ? Object.keys(SCENARIOS)
    : args.tests.length
      ? args.tests
      : [];

  if (!selected.length) {
    console.error(
      "Select tests explicitly. Example: npm run test:live -- --test T01\nUse --list to see scenarios. Refusing to run the full suite by default.",
    );
    process.exitCode = 2;
    return;
  }

  if (args.all) {
    console.warn(
      "WARNING: --all runs multiple live TinyFish investigations and may incur significant usage cost.",
    );
  }

  await ensureReady(args.baseUrl);

  const results = [];
  for (const id of Object.keys(SCENARIOS)) {
    if (!selected.includes(id)) {
      results.push(notRun(SCENARIOS[id]));
      continue;
    }
    console.log(`\n=== Running ${id}: ${SCENARIOS[id].description} ===`);
    results.push(await runScenario(SCENARIOS[id], args));
  }

  await writeReports(results);
  const executed = results.filter((r) => r.executionStatus !== "NOT_RUN");
  const failed = executed.filter((r) => r.validationResult === "FAIL");
  console.log(`\nWrote reports to ${REPORT_DIR}`);
  console.log(
    `Executed ${executed.length}; FAIL ${failed.length}; PARTIAL ${executed.filter((r) => r.validationResult === "PARTIAL").length}; PASS ${executed.filter((r) => r.validationResult === "PASS").length}`,
  );
  if (failed.length) process.exitCode = 1;
}

function notRun(scenario) {
  return {
    testId: scenario.id,
    description: scenario.description,
    hotel: HOTELS[scenario.hotelKey].name,
    provider: scenario.provider,
    market: scenario.market,
    accessMethod: scenario.access,
    executionStatus: "NOT_RUN",
    validationResult: "NOT_RUN",
  };
}

async function ensureReady(baseUrl) {
  const health = await fetch(`${baseUrl}/search`);
  if (!health.ok) {
    throw new Error(`App not ready at ${baseUrl}/search (HTTP ${health.status})`);
  }

  // Probe TinyFish configuration via discover with empty body → 400 means route alive.
  const probe = await fetch(`${baseUrl}/api/hotels/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "priceport readiness probe hotel" }),
  });
  const probeJson = await probe.json().catch(() => ({}));
  if (probe.status === 503 || probeJson.configured === false) {
    throw new Error(
      "TinyFish is not configured. Add TINYFISH_API_KEY on the server (.env.local).",
    );
  }
  console.log(`App ready at ${baseUrl}; TinyFish configured=${probeJson.configured !== false}`);
}

async function runScenario(scenario, args) {
  const hotelMeta = HOTELS[scenario.hotelKey];
  const startedAt = new Date().toISOString();
  const row = {
    testId: scenario.id,
    description: scenario.description,
    hotel: hotelMeta.name,
    location: hotelMeta.location,
    provider: scenario.provider,
    market: scenario.market,
    accessMethod: scenario.access,
    requestedProxyCountry: scenario.access === "proxy" ? scenario.market : null,
    actualProxyCountry: null,
    investigationId: null,
    tinyfishRunId: null,
    streamingUrl: null,
    startedAt,
    finishedAt: null,
    executionStatus: "RUNNING",
    propertyMatch: null,
    roomType: null,
    mealPlan: null,
    cancellationPolicy: null,
    originalPrice: null,
    currency: null,
    basePrice: null,
    taxes: null,
    mandatoryFees: null,
    estimatedFees: null,
    unknownFees: [],
    totalStatus: null,
    fxConversionStatus: null,
    sourceUrl: null,
    extractionTimestamp: null,
    validationResult: null,
    validationReasons: [],
    error: null,
    evidence: [],
    rawSummary: null,
  };

  try {
    const discovered = await discoverHotel(
      args.baseUrl,
      hotelMeta,
      scenario.provider,
    );
    row.discovery = {
      source: discovered.source,
      candidateCount: discovered.results?.length || 0,
      selected: discovered.selected
        ? {
            name: discovered.selected.name,
            providerUrl: discovered.selected.providerUrl,
            officialWebsite: discovered.selected.officialWebsite,
          }
        : null,
      note: discovered.note || null,
    };

    if (!discovered.selected) {
      row.executionStatus = "FAILED";
      row.validationResult = "FAIL";
      row.error = discovered.note || "Hotel discovery returned no usable candidate";
      row.finishedAt = new Date().toISOString();
      return row;
    }

    const created = await postJson(`${args.baseUrl}/api/investigations`, {
      hotel: {
        name: discovered.selected.name || hotelMeta.name,
        location: discovered.selected.location || hotelMeta.location,
        address: discovered.selected.address || null,
        providerUrl: discovered.selected.providerUrl || null,
        officialWebsite:
          discovered.selected.officialWebsite || hotelMeta.hintUrl || null,
        evidence: discovered.selected.evidence || [],
      },
      bookingDetails: { ...DEFAULT_STAY },
      homeCountry: "IN",
      preferredCurrency: "USD",
      providers: [scenario.provider],
      markets: [scenario.market],
      marketAccess: { [scenario.market]: scenario.access },
    });

    row.investigationId = created.id;
    const final = await waitForInvestigation(
      args.baseUrl,
      created.id,
      args.timeoutMs,
      args.pollMs,
    );
    row.finishedAt = new Date().toISOString();
    row.executionStatus = final.status;
    row.rawSummary = final.summary;

    const job = final.jobs?.[0];
    if (!job) {
      row.validationResult = "FAIL";
      row.error = "No investigation job returned";
      return row;
    }

    row.actualProxyCountry = job.actualProxyCountry ?? null;
    row.accessMethod = job.accessMethod || row.accessMethod;
    row.tinyfishRunId = job.tinyfishRunId || null;
    row.streamingUrl = job.streamingUrl || null;
    row.error = job.error || null;

    if (job.status === "unsupported") {
      row.validationResult = "UNSUPPORTED";
      row.validationReasons = [job.error || "Unsupported market/provider access"];
      return row;
    }

    if (!job.tinyfishRunId && job.status === "failed") {
      row.validationResult = "FAIL";
      row.validationReasons = [job.error || "TinyFish run did not start"];
      return row;
    }

    const offer = job.offer;
    if (!offer) {
      row.validationResult = "FAIL";
      row.validationReasons = [
        job.error ||
          "Completed or failed without a usable structured offer",
      ];
      return row;
    }

    row.propertyMatch = offer.propertyMatch;
    row.roomType = offer.roomType;
    row.mealPlan = offer.mealPlan;
    row.cancellationPolicy = offer.cancellationPolicy;
    row.originalPrice = offer.totalPrice ?? offer.basePrice;
    row.currency = offer.currency;
    row.basePrice = offer.basePrice;
    row.taxes = offer.taxes;
    row.mandatoryFees = offer.mandatoryFees;
    row.estimatedFees = offer.estimatedFees;
    row.unknownFees = offer.unknownFees || [];
    row.totalStatus = offer.totalStatus;
    row.sourceUrl = offer.sourceUrl;
    row.extractionTimestamp = offer.checkedAt;
    row.evidence = offer.evidence || [];

    const results = await getJson(`${args.baseUrl}/api/results/${created.id}`);
    const ranked = results.offers?.[0];
    row.fxConversionStatus = ranked?.conversion?.available
      ? `available rate=${ranked.conversion.rate} source=${ranked.conversion.source}`
      : ranked?.conversion?.reason || "unavailable";

    const classification = classifyLocal(offer, {
      tinyfishRunId: row.tinyfishRunId,
      provider: scenario.provider,
    });
    row.validationResult = classification.result;
    row.validationReasons = classification.reasons;
    return row;
  } catch (error) {
    row.finishedAt = new Date().toISOString();
    row.executionStatus = "FAILED";
    row.validationResult = "FAIL";
    row.error = error instanceof Error ? error.message : String(error);
    return row;
  }
}

async function discoverHotel(baseUrl, hotelMeta, preferredProvider = null) {
  const query =
    preferredProvider === "booking"
      ? `${hotelMeta.name} ${hotelMeta.location} site:booking.com`
      : preferredProvider === "agoda"
        ? `${hotelMeta.name} ${hotelMeta.location} site:agoda.com`
        : `${hotelMeta.name} ${hotelMeta.location}`;

  const byQuery = await postJson(`${baseUrl}/api/hotels/discover`, { query });

  let selected =
    pickBestCandidate(byQuery.results || [], hotelMeta, preferredProvider) ||
    (byQuery.results || [])[0] ||
    null;

  if (!selected && hotelMeta.hintUrl) {
    const byUrl = await postJson(`${baseUrl}/api/hotels/discover`, {
      directUrl: hotelMeta.hintUrl,
    });
    selected = (byUrl.results || [])[0] || null;
    return {
      source: "direct_url_fallback",
      results: byUrl.results || [],
      selected,
      note: selected
        ? "Fell back to hint URL after search produced no selectable candidate"
        : "Search and hint URL discovery both failed",
    };
  }

  return {
    source: byQuery.source,
    results: byQuery.results || [],
    selected,
    note: selected
      ? null
      : "TinyFish Search returned no usable hotel candidate for this query",
  };
}

function pickBestCandidate(results, hotelMeta, preferredProvider = null) {
  const needle = hotelMeta.name.toLowerCase();
  const city = hotelMeta.location.split(",")[0].toLowerCase();
  const providerHosts = {
    booking: ["booking.com"],
    agoda: ["agoda.com"],
    expedia: ["expedia."],
    official: [],
  };
  const preferHosts = providerHosts[preferredProvider] || [];

  const scored = results
    .map((r) => {
      const name = String(r.name || "").toLowerCase();
      const url = String(r.providerUrl || "").toLowerCase();
      let score = 0;
      if (name.includes(needle.split(" ")[0])) score += 2;
      if (city && (name.includes(city) || String(r.location || "").toLowerCase().includes(city))) {
        score += 3;
      }
      if (preferHosts.some((h) => url.includes(h))) score += 8;
      if (url.includes("skyscanner.") || url.includes("kayak.") || url.includes("trivago.")) {
        score -= 5;
      }
      if (r.officialWebsite && !String(r.officialWebsite).includes("skyscanner")) score += 2;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].r : null;
}

async function waitForInvestigation(baseUrl, id, timeoutMs, pollMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await getJson(`${baseUrl}/api/investigations/${id}`);
    if (["completed", "failed", "partial"].includes(data.status)) return data;
    const job = data.jobs?.[0];
    console.log(
      `  … ${data.status} / job=${job?.status || "?"} run=${job?.tinyfishRunId || "-"}`,
    );
    await sleep(pollMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for investigation ${id}`);
}

function classifyLocal(offer, context = {}) {
  if (!offer) return { result: "FAIL", reasons: ["No offer"] };
  const reasons = [];
  if (!offer.sourceUrl) reasons.push("Missing source URL");
  if (!offer.currency) reasons.push("Missing currency");
  if (!offer.tinyfishRunId && !context.tinyfishRunId) {
    reasons.push("Missing TinyFish run ID");
  }
  if (offer.propertyMatch === "unmatched") {
    return { result: "FAIL", reasons: ["Property unmatched", ...reasons] };
  }
  if (offer.totalPrice == null && offer.basePrice == null) {
    if (offer.availability === "unavailable") {
      return {
        result: "PARTIAL",
        reasons: ["Availability reported unavailable; no price"],
      };
    }
    return { result: "FAIL", reasons: ["No meaningful price", ...reasons] };
  }
  if (
    offer.totalStatus === "confirmed" &&
    ["exact", "probable"].includes(offer.propertyMatch) &&
    offer.sourceUrl &&
    offer.taxes != null &&
    offer.mandatoryFees != null &&
    !(offer.unknownFees || []).length
  ) {
    return { result: "PASS", reasons: ["Verified comparable price"] };
  }
  return {
    result: "PARTIAL",
    reasons: [
      `totalStatus=${offer.totalStatus || "unknown"}`,
      `propertyMatch=${offer.propertyMatch}`,
      ...reasons,
    ],
  };
}

async function writeReports(results) {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    stay: DEFAULT_STAY,
    concurrencyNote: "App runner enforces max 2 concurrent TinyFish agents",
    results,
  };
  const jsonPath = path.join(REPORT_DIR, "live-hotel-test-report.json");
  const mdPath = path.join(REPORT_DIR, "live-hotel-test-report.md");
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2));
  await fs.writeFile(mdPath, toMarkdown(payload));
}

function toMarkdown(payload) {
  const lines = [
    "# Priceport live hotel test report",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    `Default stay: ${payload.stay.checkIn} → ${payload.stay.checkOut}, ${payload.stay.adults} adults, ${payload.stay.rooms} room(s)`,
    "",
    "| Test | Hotel | Provider | Market | Access | Run ID | Exec | Validation | Price | Status |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of payload.results) {
    lines.push(
      `| ${r.testId} | ${r.hotel} | ${r.provider} | ${r.market} | ${r.accessMethod} | ${r.tinyfishRunId || "—"} | ${r.executionStatus} | ${r.validationResult} | ${r.originalPrice != null ? `${r.currency || ""} ${r.originalPrice}` : "—"} | ${r.totalStatus || "—"} |`,
    );
  }
  lines.push("", "## Details", "");
  for (const r of payload.results) {
    lines.push(`### ${r.testId} — ${r.description || r.hotel}`);
    lines.push("");
    if (r.executionStatus === "NOT_RUN") {
      lines.push("NOT RUN");
      lines.push("");
      continue;
    }
    lines.push(`- Investigation: \`${r.investigationId || "—"}\``);
    lines.push(`- TinyFish run: \`${r.tinyfishRunId || "—"}\``);
    lines.push(`- Streaming URL present: ${r.streamingUrl ? "yes" : "no"}`);
    lines.push(`- Property match: ${r.propertyMatch || "—"}`);
    lines.push(`- Room: ${r.roomType || "—"}`);
    lines.push(`- Meal plan: ${r.mealPlan || "—"}`);
    lines.push(`- Cancellation: ${r.cancellationPolicy || "—"}`);
    lines.push(
      `- Price: base=${r.basePrice ?? "—"}, taxes=${r.taxes ?? "—"}, mandatory=${r.mandatoryFees ?? "—"}, total=${r.originalPrice ?? "—"} ${r.currency || ""}`,
    );
    lines.push(`- Total status: ${r.totalStatus || "—"}`);
    lines.push(`- FX: ${r.fxConversionStatus || "—"}`);
    lines.push(`- Source: ${r.sourceUrl || "—"}`);
    lines.push(`- Validation: **${r.validationResult}**`);
    if (r.validationReasons?.length) {
      lines.push(`- Reasons: ${r.validationReasons.join("; ")}`);
    }
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `POST ${url} failed (${response.status})`);
  }
  return json;
}

async function getJson(url) {
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `GET ${url} failed (${response.status})`);
  }
  return json;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
