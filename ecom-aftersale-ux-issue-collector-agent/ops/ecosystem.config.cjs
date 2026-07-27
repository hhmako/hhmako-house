module.exports = {
  apps: [
    {
      name: "ux-issue-group-listener",
      cwd: __dirname + "/..",
      script: "src/run-group-listener.mjs",
      args: "--config config.local.json",
      interpreter: "node",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: { NODE_ENV: "production" },
    },
  ],
};
