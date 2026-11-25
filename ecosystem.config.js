module.exports = {
  apps: [
    {
      name: 'infra-portal-api',
      script: 'src/index.js',
      instances: 1, // Keep 1 instance for SQLite + in-memory simulated provisioner
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
