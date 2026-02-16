/**
 * Application Entry Point - Signal Daemon
 *
 * Wires all components together:
 * - Environment validation
 * - PostgreSQL database connection
 * - Signal client and message listener
 * - LLM client and state stores
 * - Graceful shutdown handlers
 */

import { validateEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { pool, closePool } from "./db/pool.js";
import { createSignalClient } from "./signal/client.js";
import { setupMessageListener } from "./signal/listener.js";
import { createAnthropicClient } from "./llm/client.js";
import { createCalendarClient } from "./calendar/client.js";
import { ConversationStore } from "./state/conversation.js";
import { IdempotencyStore } from "./state/idempotency.js";
import { loadFamilyConfig, FamilyWhitelist } from "./config/family-members.js";
import { startHealthServer, stopHealthServer } from "./health.js";

/**
 * Start the Signal bot daemon
 */
async function start() {
  // 1. Validate environment
  logger.info("Validating environment configuration...");
  const config = validateEnv();

  logger.info(
    {
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      signalPhone: config.SIGNAL_PHONE_NUMBER.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
    },
    "Environment validated",
  );

  // 2. Load family whitelist
  logger.info("Loading family member configuration...");
  const familyConfig = await loadFamilyConfig();
  const familyWhitelist = new FamilyWhitelist(familyConfig);
  logger.info(
    { memberCount: familyWhitelist.getMemberCount() },
    "Family whitelist loaded",
  );

  // 3. Create service instances
  logger.info("Initializing service instances...");

  const signalClient = createSignalClient(config.SIGNAL_PHONE_NUMBER);
  const anthropicClient = createAnthropicClient(config.ANTHROPIC_API_KEY);
  const calendarClient = createCalendarClient(
    config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    config.GOOGLE_CALENDAR_ID,
    config.FAMILY_TIMEZONE,
  );
  const conversationStore = new ConversationStore(pool);
  const idempotencyStore = new IdempotencyStore(pool);

  logger.info(
    {
      calendarId: config.GOOGLE_CALENDAR_ID.replace(/(.{6}).*(@.*)/, "$1***$2"),
      timezone: config.FAMILY_TIMEZONE,
    },
    "Service instances created",
  );

  // 4. Run idempotency cleanup on startup
  logger.info("Running idempotency cleanup...");
  await idempotencyStore.cleanup();
  logger.info("Idempotency cleanup complete");

  // 5. Connect to Signal via signal-cli
  logger.info("Connecting to Signal...");
  await signalClient.connect();
  logger.info("Connected to Signal");

  // 6. Setup message listener
  logger.info("Setting up Signal message listener...");
  setupMessageListener({
    signalClient,
    anthropicClient,
    conversationStore,
    idempotencyStore,
    calendarClient,
    familyWhitelist,
  });

  logger.info(
    {
      phoneNumber: config.SIGNAL_PHONE_NUMBER.replace(/\d(?=\d{4})/g, "*"),
      calendarConnected: true,
    },
    "Signal bot started with calendar integration - listening for messages",
  );

  // 7. Start health check server
  const healthServer = startHealthServer();

  // 8. Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal, cleaning up...");

    try {
      // Stop health check server first (monitoring sees it go down)
      await stopHealthServer(healthServer);
      logger.info("Health check server stopped");

      // Stop Signal client
      await signalClient.gracefulShutdown();
      logger.info("Signal client stopped");

      // Close PostgreSQL pool
      await closePool();
      logger.info("PostgreSQL pool closed");

      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Error during shutdown");
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start the application
start().catch((error) => {
  logger.error({ error }, "Fatal error during startup");
  process.exit(1);
});
