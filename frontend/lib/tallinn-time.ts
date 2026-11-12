const tallinn = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Tallinn",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Milliseconds Tallinn is ahead of UTC at the given instant (2h in winter, 3h in summer).
function tallinnOffset(instant: number): number {
  const p = Object.fromEntries(tallinn.formatToParts(instant).map((x) => [x.type, x.value]));
  const wallClockAsUtc = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return wallClockAsUtc - Math.floor(instant / 60000) * 60000;
}

// Turns a Tallinn wall-clock date ("2026-10-26") and time ("08:00") into a UTC ISO string.
// Offset is looked up twice because the first guess may sit on the other side of a DST change.
export function tallinnToIso(date: string, time: string): string {
  // Date.parse is lenient (it reads "nullTnull:00Z" as the year 2000), so check the format first.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
    throw new RangeError("Invalid date or time");
  }
  const wallClockAsUtc = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  const guess = wallClockAsUtc - tallinnOffset(wallClockAsUtc);
  return new Date(wallClockAsUtc - tallinnOffset(guess)).toISOString();
}

// The Tallinn calendar date ("2026-11-16") of an instant, so a booking at 23:30 local time
// lands on its local day, not the UTC one.
export function tallinnDate(instant: string | number): string {
  const p = Object.fromEntries(tallinn.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// Plain calendar arithmetic: dates carry no clock time, so UTC math cannot hit a DST change.
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
