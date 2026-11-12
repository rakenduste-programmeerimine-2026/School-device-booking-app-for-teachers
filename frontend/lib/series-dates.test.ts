import { expect, test } from "vitest";
import { generateSeriesDates } from "./series-dates";

const base = {
  schoolYear: { starts_on: "2026-09-01", ends_on: "2027-06-05" },
  nonTeachingPeriods: [{ starts_on: "2026-10-26", ends_on: "2026-11-01" }],
  weekdays: [1], // Monday
  startTime: "08:00",
  endTime: "08:45",
};

test("keeps the same Tallinn wall-clock time across the DST change", () => {
  const dates = generateSeriesDates({ ...base, nonTeachingPeriods: [] });
  const byDate = Object.fromEntries(dates.map((d) => [d.date, d.startsAt]));
  expect(byDate["2026-10-19"]).toBe("2026-10-19T05:00:00.000Z"); // UTC+3
  expect(byDate["2026-10-26"]).toBe("2026-10-26T06:00:00.000Z"); // UTC+2 after clocks went back
});

test("covers the whole school year", () => {
  const dates = generateSeriesDates({ ...base, nonTeachingPeriods: [] });
  expect(dates[0].date).toBe("2026-09-07");
  expect(dates.at(-1)?.date).toBe("2027-05-31");
});

test("skips dates inside non-teaching periods, bounds included", () => {
  const dates = generateSeriesDates({ ...base, weekdays: [1, 7] }).map((d) => d.date);
  expect(dates).toContain("2026-10-25");
  expect(dates).not.toContain("2026-10-26");
  expect(dates).not.toContain("2026-11-01");
  expect(dates).toContain("2026-11-02");
});

test("keeps a non-teaching date the teacher explicitly keeps", () => {
  const dates = generateSeriesDates({ ...base, keepDates: ["2026-10-26"] }).map((d) => d.date);
  expect(dates).toContain("2026-10-26");
});
