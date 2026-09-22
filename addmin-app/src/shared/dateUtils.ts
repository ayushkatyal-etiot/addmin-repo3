/** Calendar / date-picker helpers — values are always `YYYY-MM-DD` (local calendar). */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(iso: string): Date | null {
  if (!ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Sunday-first grid (6 rows × 7 columns). */
export function buildMonthGrid(viewMonth: Date): Date[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = firstOfMonth.getDay();
  const count = daysInMonth(year, month);
  const cells: Date[] = [];

  const prevLast = new Date(year, month, 0).getDate();
  for (let i = leading - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevLast - i));
  }
  for (let d = 1; d <= count; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!;
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return cells;
}

export function isDateDisabled(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

export function splitDatetimeLocal(value: string): { date: string; time: string } {
  if (!value.includes("T")) return { date: value.slice(0, 10), time: "09:00" };
  const [date, time = "09:00"] = value.split("T");
  return { date: date ?? "", time: time.slice(0, 5) };
}

export function joinDatetimeLocal(date: string, time: string): string {
  if (!date) return "";
  const t = time || "09:00";
  return `${date}T${t}`;
}

export function formatDisplayDateTime(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
