import pg from "pg";
import { validateEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

const env = validateEnv();

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

pool.on("connect", () => {
  logger.debug("New database connection established");
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error");
});

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
