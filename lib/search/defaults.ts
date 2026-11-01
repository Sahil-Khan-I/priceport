/** Local-date helpers — avoid UTC shift issues for stay defaults. */

export function formatLocalDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function defaultStayDates() {
  const checkIn = addLocalDays(new Date(), 14);
  const checkOut = addLocalDays(checkIn, 3);
  return {
    checkIn: formatLocalDate(checkIn),
    checkOut: formatLocalDate(checkOut),
  };
}

export function formatStaySummary({
  checkIn,
  checkOut,
  adults,
  children,
  rooms,
}: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
}) {
  const guests =
    children > 0
      ? `${adults} adults · ${children} child${children === 1 ? "" : "ren"}`
      : `${adults} adult${adults === 1 ? "" : "s"}`;
  return `${prettyDate(checkIn)}–${prettyDate(checkOut)} · ${guests} · ${rooms} room${rooms === 1 ? "" : "s"}`;
}

function prettyDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
