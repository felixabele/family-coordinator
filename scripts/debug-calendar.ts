/**
 * Quick diagnostic script to debug Google Calendar access.
 * Run: npx tsx --env-file=.env scripts/debug-calendar.ts
 */

import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";

const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
const calendarId = process.env.GOOGLE_CALENDAR_ID;

console.log("=== Google Calendar Debug ===\n");

// Step 1: Check env vars
console.log("1. Environment variables:");
console.log(`   GOOGLE_SERVICE_ACCOUNT_KEY_FILE: ${keyFilePath || "NOT SET"}`);
console.log(`   GOOGLE_CALENDAR_ID: ${calendarId || "NOT SET"}`);
console.log(`   FAMILY_TIMEZONE: ${process.env.FAMILY_TIMEZONE || "NOT SET"}`);

if (!keyFilePath || !calendarId) {
  console.error("\n❌ Missing env vars. Check your .env file.");
  process.exit(1);
}

// Step 2: Check key file exists
console.log(`\n2. Key file exists: ${existsSync(keyFilePath)}`);
if (!existsSync(keyFilePath)) {
  console.error(`\n❌ Key file not found at: ${keyFilePath}`);
  console.error(
    "   Make sure the path is correct (relative to project root or absolute).",
  );
  process.exit(1);
}

// Step 3: Parse key file
let keyData: Record<string, string>;
try {
  keyData = JSON.parse(readFileSync(keyFilePath, "utf-8"));
  console.log(`   Type: ${keyData.type}`);
  console.log(`   Project: ${keyData.project_id}`);
  console.log(`   Client email: ${keyData.client_email}`);
  console.log(`   Private key present: ${!!keyData.private_key}`);
} catch (e) {
  console.error(`\n❌ Failed to parse key file: ${(e as Error).message}`);
  process.exit(1);
}

// Step 4: Test auth
console.log("\n3. Testing authentication...");
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const client = await auth.getClient();
  console.log("   ✓ Auth successful");
} catch (e) {
  console.error(`   ❌ Auth failed: ${(e as Error).message}`);
  process.exit(1);
}

// Step 5: Test calendar access
console.log(`\n4. Testing calendar access (${calendarId})...`);
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: tomorrow.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 5,
  });

  const events = response.data.items || [];
  console.log(
    `   ✓ Calendar access works! Found ${events.length} event(s) in next 24h`,
  );
  for (const event of events) {
    console.log(
      `     - ${event.summary} (${event.start?.dateTime || event.start?.date})`,
    );
  }
} catch (e: any) {
  console.error(`   ❌ Calendar access failed!`);
  console.error(`   Status: ${e.code || "unknown"}`);
  console.error(`   Message: ${e.message}`);

  if (e.code === 403) {
    console.error(
      `\n   Fix: Share the calendar with the service account email:`,
    );
    console.error(`   1. Open Google Calendar → Settings → "${calendarId}"`);
    console.error(`   2. "Share with specific people" → Add`);
    console.error(`   3. Email: ${keyData!.client_email}`);
    console.error(`   4. Permission: "Make changes to events"`);
  } else if (e.code === 404) {
    console.error(`\n   Fix: Calendar ID "${calendarId}" not found.`);
    console.error(`   Check: Google Calendar → Settings → Calendar ID`);
  }
}

console.log("\n=== Done ===");
