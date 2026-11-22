const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const dayLabelWithYear = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

/** "03:12", in local time (R-UI-22). */
export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}

/** The full date and time, shown on hover. */
export function formatFull(iso: string): string {
  return fullDate.format(new Date(iso));
}

/** A key that is equal for two timestamps on the same local day. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Today", "Yesterday", or the date, for the divider between days. */
export function formatDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (dayKey(iso) === dayKey(now.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return (date.getFullYear() === now.getFullYear() ? dayLabel : dayLabelWithYear).format(date);
}
