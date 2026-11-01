export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) return "";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isProxyCountrySupported(code?: string | null): boolean {
  if (!code) return false;
  const supported = new Set(["US", "GB", "CA", "DE", "FR", "JP", "AU"]);
  return supported.has(String(code).toUpperCase());
}
