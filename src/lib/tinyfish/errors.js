export class TinyFishError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "TinyFishError";
    this.code = options.code || "TINYFISH_ERROR";
    this.cause = options.cause;
    this.details = options.details || null;
  }
}

export class TinyFishConfigError extends TinyFishError {
  constructor(message) {
    super(message, { code: "TINYFISH_CONFIG" });
    this.name = "TinyFishConfigError";
  }
}

export class TinyFishUnsupportedMarketError extends TinyFishError {
  constructor(message, details) {
    super(message, { code: "UNSUPPORTED_MARKET", details });
    this.name = "TinyFishUnsupportedMarketError";
  }
}

export function toTinyFishError(error) {
  if (error instanceof TinyFishError) return error;
  return new TinyFishError(
    error instanceof Error ? error.message : "TinyFish request failed",
    { cause: error },
  );
}
