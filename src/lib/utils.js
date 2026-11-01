export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function formatStatusLabel(status) {
  if (!status) return "";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isProxyCountrySupported(code) {
  if (!code) return false;
  const supported = new Set(["US", "GB", "CA", "DE", "FR", "JP", "AU"]);
  return supported.has(String(code).toUpperCase());
}
