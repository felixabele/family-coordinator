/**
 * Timezone-aware date/time utilities using Luxon
 */

import { DateTime } from "luxon";

/**
 * Infer event date from time string.
 * If time hasn't passed today, return today's date.
 * If time has passed today, return tomorrow's date.
 */
export function inferEventDate(time: string, timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  const [hours, minutes] = time.split(":").map(Number);

  // Create a datetime for today at the specified time
  const todayAtTime = now.set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });

  // If time hasn't passed yet, use today; otherwise use tomorrow
  if (now < todayAtTime) {
    return now.toFormat("yyyy-MM-dd");
  } else {
    return now.plus({ days: 1 }).toFormat("yyyy-MM-dd");
  }
}

/**
 * Create Google Calendar event datetime object.
 * Returns both dateTime (ISO) and timeZone for DST-safe handling.
 */
export function createEventDateTime(
  date: string,
  time: string,
  timezone: string,
): { dateTime: string; timeZone: string } {
  const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
    zone: timezone,
  });

  return {
    dateTime: dt.toISO()!,
    timeZone: timezone,
  };
}

/**
 * Create event end datetime by adding duration to start time.
 */
export function createEventEndDateTime(
  date: string,
  time: string,
  durationMinutes: number,
  timezone: string,
): { dateTime: string; timeZone: string } {
  const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
    zone: timezone,
  });

  const endDt = dt.plus({ minutes: durationMinutes });

  return {
    dateTime: endDt.toISO()!,
    timeZone: timezone,
  };
}

/**
 * Format ISO datetime to time string (HH:mm) in specified timezone.
 */
export function formatEventTime(isoString: string, timezone: string): string {
  const dt = DateTime.fromISO(isoString).setZone(timezone);
  return dt.toFormat("HH:mm");
}

/**
 * Format ISO datetime to German localized date string.
 * Example: "Di, 14. Feb"
 */
export function formatEventDate(isoString: string, timezone: string): string {
  const dt = DateTime.fromISO(isoString).setZone(timezone);
  return dt.setLocale("de").toFormat("ccc, d. MMM");
}

/**
 * Get German day name from YYYY-MM-DD date.
 * Example: "Dienstag"
 */
export function formatDayName(date: string, timezone: string): string {
  const dt = DateTime.fromFormat(date, "yyyy-MM-dd", { zone: timezone });
  return dt.setLocale("de").toFormat("cccc");
}
