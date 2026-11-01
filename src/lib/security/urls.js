const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

/**
 * Validate investigation target URLs — HTTPS/HTTP only, no SSRF to private nets.
 */
export function assertSafeHttpUrl(input, { allowHttp = false } = {}) {
  if (!input || typeof input !== "string") {
    throw new Error("URL is required");
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }

  if (!allowHttp && url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Internal or local URLs are not allowed");
  }

  if (isPrivateIp(host)) {
    throw new Error("Private network URLs are not allowed");
  }

  return url.toString();
}

function isPrivateIp(host) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

export function isProviderDomain(urlString, domains = []) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
