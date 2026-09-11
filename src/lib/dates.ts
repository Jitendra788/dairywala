function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function todayISO() {
  return toISODate(new Date());
}

export function formatDate(value: string) {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateRange(from: string, to: string) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function formatTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDMY(iso: string) {
  return formatDate(iso) === "—" ? "" : formatDate(iso);
}

export function currentShift(): "morning" | "evening" {
  return new Date().getHours() < 15 ? "morning" : "evening";
}

export function startOfMonth(iso = todayISO()) {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

export function endOfMonth(iso = todayISO()) {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(last)}`;
}

export function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(Math.min(d, last))}`;
}

export function eachDay(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}
