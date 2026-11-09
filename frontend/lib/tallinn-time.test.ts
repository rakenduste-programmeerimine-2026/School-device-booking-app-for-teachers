import { expect, test } from "vitest";
import { tallinnToIso } from "./tallinn-time";

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
