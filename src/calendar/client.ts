/**
 * Google Calendar API client with service account authentication
 */

import { google, calendar_v3 } from "googleapis";

export interface CalendarClient {
  calendar: calendar_v3.Calendar;
  calendarId: string;
  timezone: string;
}

export function createCalendarClient(
  keyFilePath: string,
  calendarId: string,
  timezone: string,
): CalendarClient {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({
    version: "v3",
    auth,
    retryConfig: {
      retry: 3,
      statusCodesToRetry: [
        [429, 429],
        [500, 599],
      ],
      httpMethodsToRetry: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  return {
    calendar,
    calendarId,
    timezone,
  };
}
