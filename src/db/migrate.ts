import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pool, closePool } from "./pool.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  try {
    logger.info("Starting database migrations...");

    // Read all migration files
    const migrationsDir = join(__dirname, "migrations");
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    logger.info({ count: sqlFiles.length }, "Found migration files");

    // Run each migration
    for (const file of sqlFiles) {
      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, "utf-8");

      logger.info({ file }, "Running migration");
      await pool.query(sql);
      logger.info({ file }, "Migration completed");
    }

    logger.info("All migrations completed successfully");
  } catch (error) {
    logger.error({ error }, "Migration failed");
    throw error;
  } finally {
    await closePool();
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((error) => {
    console.error("Migration error:", error);
    process.exit(1);
  });
}

export { runMigrations };
