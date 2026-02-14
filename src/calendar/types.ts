/**
 * Calendar domain types
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isAllDay: boolean;
  description?: string;
}

export interface CreateEventInput {
  summary: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes?: number; // default: 60
  description?: string;
}

export interface UpdateEventInput {
  eventId: string;
  summary?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  durationMinutes?: number;
}

export type EventSearchResult =
  | { event: CalendarEvent }
  | { candidates: CalendarEvent[] }
  | { notFound: true };

export class CalendarError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "PERMISSION_DENIED"
      | "RATE_LIMITED"
      | "API_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}
