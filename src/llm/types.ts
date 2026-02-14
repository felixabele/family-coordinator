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
 * Entities extracted from user message for calendar operations
 */
export interface CalendarEntities {
  title?: string;
  date?: string;
  time?: string;
  duration_minutes?: number;
  end_time?: string; // HH:mm format for explicit end times
  event_search_query?: string; // Search text for update/delete operations
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
export const CalendarEntitiesSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  end_time: z.string().optional(),
  event_search_query: z.string().optional(),
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
