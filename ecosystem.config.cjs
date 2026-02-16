module.exports = {
  apps: [
    {
      name: "family-coordinator",
      script: "src/index.ts",
      interpreter: "node",
      interpreter_args: "--env-file=.env.production --experimental-strip-types",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      min_uptime: "30s",
      max_restarts: 10,
      restart_delay: 5000,
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
