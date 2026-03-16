module.exports = {
  apps: [
    {
      name: "xcvr",
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};