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
  const wallClockAsUtc = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  const guess = wallClockAsUtc - tallinnOffset(wallClockAsUtc);
  return new Date(wallClockAsUtc - tallinnOffset(guess)).toISOString();
}
