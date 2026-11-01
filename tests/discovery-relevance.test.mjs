import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHotelSearchQuery,
  classifyUrl,
  extractSearchHits,
  mapDestinationToSearchLocation,
  rankAndFilterCandidates,
  scoreHotelCandidate,
} from "../lib/hotels/discovery-relevance.ts";

const dubai = {
  city: "Dubai",
  country: "United Arab Emirates",
  countryCode: "AE",
  label: "Dubai, UAE",
};

const singapore = {
  city: "Singapore",
  country: "Singapore",
  countryCode: "SG",
  label: "Singapore, Singapore",
};

describe("mapDestinationToSearchLocation", () => {
  it("uses destination country code, not a US default when AE is set", () => {
    assert.equal(mapDestinationToSearchLocation(dubai), "AE");
  });

  it("maps Singapore to SG", () => {
    assert.equal(mapDestinationToSearchLocation(singapore), "SG");
  });

  it("falls back to US only when destination is empty", () => {
    assert.equal(mapDestinationToSearchLocation(null), "US");
    assert.equal(mapDestinationToSearchLocation({}), "US");
  });
});

describe("buildHotelSearchQuery", () => {
  it("embeds destination city and country for Atlantis / Dubai", () => {
    const q = buildHotelSearchQuery("Atlantis", dubai);
    assert.match(q, /Atlantis/i);
    assert.match(q, /Dubai/);
    assert.match(q, /United Arab Emirates/);
  });
});

describe("classifyUrl", () => {
  it("marks booking.com property pages as ota_property", () => {
    assert.equal(
      classifyUrl("https://www.booking.com/hotel/ae/atlantis-the-palm.html"),
      "ota_property",
    );
  });

  it("rejects generic provider homepages", () => {
    assert.equal(classifyUrl("https://www.agoda.com/"), "generic_homepage");
    assert.equal(classifyUrl("https://www.booking.com/"), "generic_homepage");
    assert.equal(classifyUrl("https://www.expedia.com/Hotels"), "generic_homepage");
  });

  it("classifies editorial domains", () => {
    assert.equal(
      classifyUrl("https://en.wikipedia.org/wiki/Atlantis_The_Palm"),
      "editorial",
    );
  });
});

describe("scoreHotelCandidate + rankAndFilterCandidates", () => {
  it("scores Dubai Atlantis highly and rejects Austin AT&T / Alaska Atka", () => {
    const good = scoreHotelCandidate({
      query: "Atlantis",
      destination: dubai,
      title: "Atlantis The Palm Dubai",
      snippet: "Luxury resort on Palm Jumeirah, Dubai, UAE",
      url: "https://www.booking.com/hotel/ae/atlantis-the-palm.html",
      sourceClass: "ota_property",
    });
    assert.ok(good.score >= 40, `expected high score, got ${good.score}`);

    const austin = scoreHotelCandidate({
      query: "atka",
      destination: dubai,
      title: "AT&T Hotel and Conference Center",
      snippet: "Austin, Texas hotel near University of Texas",
      url: "https://www.booking.com/hotel/us/att-hotel-austin.html",
      sourceClass: "ota_property",
    });
    assert.ok(austin.score < 15, `Austin should fail Dubai context, got ${austin.score}`);

    const alaska = scoreHotelCandidate({
      query: "atka",
      destination: dubai,
      title: "Cheap hotels in Atka, Alaska",
      snippet: "Find deals in Atka Alaska",
      url: "https://www.agoda.com/",
      sourceClass: "generic_homepage",
    });
    assert.ok(alaska.score < 0);
  });

  it("filters ranked candidates for Dubai / Atlantis acceptance case", () => {
    const ranked = rankAndFilterCandidates(
      [
        {
          title: "Atlantis The Palm, Dubai",
          url: "https://www.booking.com/hotel/ae/atlantis-the-palm.html",
          snippet: "5-star resort in Dubai, United Arab Emirates",
        },
        {
          title: "AT&T Hotel and Conference Center",
          url: "https://www.booking.com/hotel/us/att-austin.html",
          snippet: "Austin Texas",
        },
        {
          title: "Cheap hotels in Atka, Alaska",
          url: "https://www.agoda.com/",
          snippet: "Atka Alaska deals",
        },
        {
          title: "Agoda",
          url: "https://www.agoda.com/",
          snippet: "Book hotels worldwide",
        },
      ],
      { query: "Atlantis", destination: dubai, limit: 6, minScore: 20 },
    );

    assert.ok(ranked.length >= 1);
    assert.match(ranked[0].name, /Atlantis/i);
    assert.equal(ranked[0].discoveryStatus, "discovery_candidate");
    assert.ok(!ranked.some((c) => /Austin|Alaska|Atka/i.test(c.name)));
    assert.ok(!ranked.some((c) => c.sourceClass === "generic_homepage"));
  });

  it("ranks Singapore Marina Bay Sands with SG context", () => {
    const ranked = rankAndFilterCandidates(
      [
        {
          title: "Marina Bay Sands Singapore",
          url: "https://www.booking.com/hotel/sg/marina-bay-sands.html",
          snippet: "Iconic hotel in Singapore",
        },
        {
          title: "Marina Bay Hotel Miami",
          url: "https://www.booking.com/hotel/us/marina-bay-miami.html",
          snippet: "Miami Florida waterfront",
        },
      ],
      { query: "Marina Bay Sands", destination: singapore, minScore: 20 },
    );
    assert.equal(ranked.length, 1);
    assert.match(ranked[0].name, /Marina Bay Sands/i);
  });

  it("for ambiguous Palace in Dubai keeps location distinctions without inventing exact match", () => {
    const ranked = rankAndFilterCandidates(
      [
        {
          title: "Palace Downtown Dubai",
          url: "https://www.booking.com/hotel/ae/palace-downtown.html",
          snippet: "Palace Downtown, Dubai, UAE",
        },
        {
          title: "Emirates Palace Abu Dhabi",
          url: "https://www.booking.com/hotel/ae/emirates-palace.html",
          snippet: "Abu Dhabi, United Arab Emirates",
        },
        {
          title: "The Palace Hotel San Francisco",
          url: "https://www.booking.com/hotel/us/palace-sf.html",
          snippet: "San Francisco California",
        },
      ],
      { query: "Palace", destination: dubai, minScore: 15 },
    );
    assert.ok(ranked.length >= 1);
    assert.ok(ranked.every((c) => c.discoveryStatus === "discovery_candidate"));
    assert.ok(!ranked.some((c) => /San Francisco/i.test(c.name)));
  });
});

describe("extractSearchHits", () => {
  it("reads documented response shapes safely", () => {
    assert.deepEqual(extractSearchHits(null), []);
    assert.deepEqual(extractSearchHits({ results: [{ title: "A" }] }).length, 1);
    assert.deepEqual(extractSearchHits({ organic: [{ title: "B" }] }).length, 1);
    assert.deepEqual(extractSearchHits({ items: [] }), []);
    assert.deepEqual(extractSearchHits({ data: "not-array" }), []);
  });
});
