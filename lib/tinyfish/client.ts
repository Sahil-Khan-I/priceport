import { TinyFish } from "@tiny-fish/sdk";
import { getTinyFishApiKey, isTinyFishConfigured } from "./config";
import { TinyFishConfigError } from "./errors";

let singleton: TinyFish | null = null;

/**
 * Server-side TinyFish client.
 * API key must stay in TINYFISH_API_KEY — never expose to the browser.
 */
export function getTinyFishClient(): TinyFish {
  if (!isTinyFishConfigured()) {
    throw new TinyFishConfigError(
      "Missing TINYFISH_API_KEY. Add it to .env.local for server-side investigations.",
    );
  }

  if (!singleton) {
    const apiKey = getTinyFishApiKey();
    if (!apiKey) {
      throw new TinyFishConfigError("TinyFish API key is required.");
    }
    singleton = new TinyFish({ apiKey });
  }

  return singleton;
}

export function createTinyFishClient(apiKey: string | null = getTinyFishApiKey()) {
  if (!apiKey) {
    throw new TinyFishConfigError("TinyFish API key is required.");
  }
  return new TinyFish({ apiKey });
}
