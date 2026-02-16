/**
 * Lightweight HTTP Health Check Server
 *
 * Provides a simple /health endpoint for monitoring without dependencies.
 * Uses Node.js built-in http module only.
 */

import * as http from "node:http";
import { pool } from "./db/pool.js";
import { logger } from "./utils/logger.js";

const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 3000;

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
  };
}

/**
 * Check database connectivity with a simple query
 */
async function checkDatabase(): Promise<boolean> {
  try {
    const result = await pool.query("SELECT 1");
    return result.rowCount === 1;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return false;
  }
}

/**
 * Generate health status
 */
async function getHealthStatus(): Promise<HealthStatus> {
  const databaseHealthy = await checkDatabase();

  return {
    status: databaseHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: databaseHealthy,
    },
  };
}

/**
 * Start the health check HTTP server
 *
 * @returns HTTP server instance
 */
export function startHealthServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    // Only handle GET /health
    if (req.method === "GET" && req.url === "/health") {
      const healthStatus = await getHealthStatus();
      const statusCode = healthStatus.status === "healthy" ? 200 : 503;

      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(healthStatus));
    } else {
      // 404 for all other paths
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.listen(HEALTH_PORT, () => {
    logger.info({ port: HEALTH_PORT }, "Health check server listening");
  });

  return server;
}

/**
 * Stop the health check HTTP server
 *
 * @param server HTTP server instance to close
 */
export function stopHealthServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        logger.error({ error: err }, "Error stopping health server");
        reject(err);
      } else {
        logger.info("Health check server stopped");
        resolve();
      }
    });
  });
}
