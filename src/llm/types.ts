/**
 * LLM Types for Calendar Intent Extraction
 */

import { z } from "zod";

/**
 * Possible calendar intent types recognized by the system
 */
export type IntentType =
  | "create_event"
  | "query_events"
  | "update_event"
  | "delete_event"
  | "greeting"
  | "help"
  | "unclear";

/**
 * Recurrence pattern for recurring events
 */
export interface RecurrenceEntities {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  day_of_week?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
  end_date?: string; // YYYY-MM-DD format, null = forever
}

/**
 * Entities extracted from user message for calendar operations
 */
export interface CalendarEntities {
  title?: string;
  date?: string;
  date_end?: string; // YYYY-MM-DD end date for multi-day queries (e.g., "Wochenende")
  time?: string;
  duration_minutes?: number;
  end_time?: string; // HH:mm format for explicit end times
  event_search_query?: string; // Search text for update/delete operations
  recurrence?: RecurrenceEntities;
  all_day?: boolean; // True for all-day events (no specific time)
}

/**
 * Structured intent extracted from natural language via Claude tool use
 */
export interface CalendarIntent {
  intent: IntentType;
  entities: CalendarEntities;
  confidence: number;
  clarification_needed?: string;
}

/**
 * Zod schema for runtime validation of Claude tool use output
 */
export const RecurrenceEntitiesSchema = z.object({
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  day_of_week: z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]).optional(),
  end_date: z.string().optional(),
});

export const CalendarEntitiesSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  date_end: z.string().optional(),
  time: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  end_time: z.string().optional(),
  event_search_query: z.string().optional(),
  recurrence: RecurrenceEntitiesSchema.optional(),
  all_day: z.boolean().optional(),
});

export const CalendarIntentSchema = z.object({
  intent: z.enum([
    "create_event",
    "query_events",
    "update_event",
    "delete_event",
    "greeting",
    "help",
    "unclear",
  ]),
  entities: CalendarEntitiesSchema,
  confidence: z.number().min(0).max(1),
  clarification_needed: z.string().optional(),
});

/**
 * Error thrown when intent extraction fails
 */
export class IntentExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "IntentExtractionError";
  }
}
