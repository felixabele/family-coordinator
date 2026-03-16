import { describe, it, expect } from "vitest";
import { formatDayName } from "./timezone.js";

describe("formatDayName", () => {
  const tz = "Europe/Berlin";

  // All 7 weekdays test (primary diagnostic)
  // 2026-03-16 is Monday through 2026-03-22 is Sunday
  it("should format Monday correctly", () => {
    expect(formatDayName("2026-03-16", tz)).toBe("Montag");
  });

  it("should format Tuesday correctly", () => {
    expect(formatDayName("2026-03-17", tz)).toBe("Dienstag");
  });

  it("should format Wednesday correctly", () => {
    expect(formatDayName("2026-03-18", tz)).toBe("Mittwoch");
  });

  it("should format Thursday correctly", () => {
    expect(formatDayName("2026-03-19", tz)).toBe("Donnerstag");
  });

  it("should format Friday correctly", () => {
    expect(formatDayName("2026-03-20", tz)).toBe("Freitag");
  });

  it("should format Saturday correctly", () => {
    expect(formatDayName("2026-03-21", tz)).toBe("Samstag");
  });

  it("should format Sunday correctly", () => {
    expect(formatDayName("2026-03-22", tz)).toBe("Sonntag");
  });

  // Weekend-specific tests
  describe("weekend days", () => {
    it("Saturday should return Samstag", () => {
      expect(formatDayName("2026-03-21", tz)).toBe("Samstag");
    });

    it("Sunday should return Sonntag", () => {
      expect(formatDayName("2026-03-22", tz)).toBe("Sonntag");
    });
  });

  // DST boundary edge case (Europe/Berlin DST starts last Sunday of March)
  describe("DST boundary", () => {
    it("should return Sonntag for DST transition day (2026-03-29)", () => {
      expect(formatDayName("2026-03-29", tz)).toBe("Sonntag");
    });

    it("should return Montag for day after DST (2026-03-30)", () => {
      expect(formatDayName("2026-03-30", tz)).toBe("Montag");
    });
  });

  // Timezone consistency test
  describe("timezone consistency", () => {
    it("should return same result for same date with Europe/Berlin", () => {
      const result1 = formatDayName("2026-03-20", tz);
      const result2 = formatDayName("2026-03-20", tz);
      expect(result1).toBe(result2);
      expect(result1).toBe("Freitag");
    });
  });
});
