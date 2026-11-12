import { tallinnToIso } from "./tallinn-time";

type DateRange = { starts_on: string; ends_on: string };

export type SeriesDate = { date: string; startsAt: string; endsAt: string };

type Options = {
  schoolYear: DateRange;
  nonTeachingPeriods: DateRange[];
  weekdays: number[]; // 1 = Monday ... 7 = Sunday
  startTime: string; // Tallinn wall clock, "08:00"
  endTime: string;
  keepDates?: string[]; // non-teaching dates the teacher explicitly keeps
};

// Dates are walked as calendar days and only then turned into instants, so a
// 7 × 24 h step never slips an hour across the daylight-saving change.
export function generateSeriesDates(o: Options): SeriesDate[] {
  const keep = new Set(o.keepDates ?? []);
  const result: SeriesDate[] = [];
  const last = Date.parse(`${o.schoolYear.ends_on}T00:00:00Z`);
  for (let t = Date.parse(`${o.schoolYear.starts_on}T00:00:00Z`); t <= last; t += 86_400_000) {
    const day = new Date(t);
    const date = day.toISOString().slice(0, 10);
    if (!o.weekdays.includes(day.getUTCDay() || 7)) continue;
    const off = o.nonTeachingPeriods.some((p) => p.starts_on <= date && date <= p.ends_on);
    if (off && !keep.has(date)) continue;
    result.push({ date, startsAt: tallinnToIso(date, o.startTime), endsAt: tallinnToIso(date, o.endTime) });
  }
  return result;
}
