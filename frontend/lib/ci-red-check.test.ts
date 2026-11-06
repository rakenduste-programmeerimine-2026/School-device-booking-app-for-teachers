import { expect, test } from "vitest";

test("temporary: proves a failing Vitest test fails CI", () => {
  expect(1).toBe(2);
});
