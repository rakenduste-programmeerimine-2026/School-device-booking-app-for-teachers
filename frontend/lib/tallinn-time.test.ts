import { expect, test } from "vitest";
import { addDays, tallinnDate, tallinnToIso } from "./tallinn-time";

test("summer time is UTC+3", () => {
  expect(tallinnToIso("2026-09-01", "08:00")).toBe("2026-09-01T05:00:00.000Z");
});

test("winter time is UTC+2", () => {
  expect(tallinnToIso("2026-12-01", "08:00")).toBe("2026-12-01T06:00:00.000Z");
});

test("same wall-clock time shifts by an hour across the DST change", () => {
  // Clocks went back on 2026-10-25, so 08:00 on the 24th is UTC+3 and on the 26th UTC+2.
  expect(tallinnToIso("2026-10-24", "08:00")).toBe("2026-10-24T05:00:00.000Z");
  expect(tallinnToIso("2026-10-26", "08:00")).toBe("2026-10-26T06:00:00.000Z");
});

test("accepts database times with seconds", () => {
  expect(tallinnToIso("2026-12-01", "08:45:00")).toBe("2026-12-01T06:45:00.000Z");
});

test("throws on an invalid date so the caller can report it", () => {
  expect(() => tallinnToIso("null", "null")).toThrow(RangeError);
  expect(() => tallinnToIso("2026-13-45", "08:00")).toThrow(RangeError);
});

test("a late evening booking belongs to its Tallinn day, not the UTC day", () => {
  // 22:30 UTC in winter is 00:30 the next day in Tallinn.
  expect(tallinnDate("2026-12-01T22:30:00Z")).toBe("2026-12-02");
  expect(tallinnDate("2026-12-01T21:30:00Z")).toBe("2026-12-01");
});

test("addDays steps calendar days across the DST change and month ends", () => {
  expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
});
