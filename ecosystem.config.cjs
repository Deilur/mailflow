/**
 * PM2 Ecosystem — MailFlow
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup   ← auto-start on reboot
 */
module.exports = {
  apps: [
    {
      name: "mailflow",
      script: "./dist/index.cjs",
      cwd: "/opt/mailflow",          // ← change to your deploy path
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
        // These are read from the .env file loaded by dotenv.
        // You can also paste them directly here (less secure):
        // LISTMONK_URL: "http://localhost:9000",
        // LISTMONK_USERNAME: "admin",
        // LISTMONK_PASSWORD: "...",
        // DATABASE_URL: "postgresql://listmonk:...@localhost:5432/listmonk",
      },
      // Load .env file automatically
      node_args: "--require dotenv/config",
      // Logs
      out_file: "/var/log/mailflow/out.log",
      error_file: "/var/log/mailflow/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Restart policy
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
