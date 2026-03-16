module.exports = {
  apps: [
    {
      name: "xcvr",
      // ใช้ npm script เป็น entry (เช่น Vite preview)
      script: "npm",
      args: "run preview -- --port 3000",
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

