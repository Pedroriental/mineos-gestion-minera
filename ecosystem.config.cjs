/**
 * PM2 — producción MineOS
 * Uso en servidor:
 *   cd /var/www/mineos
 *   npm ci && npm run build
 *   pm2 delete mineos 2>/dev/null || true
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'mineos',
      cwd: '/var/www/mineos',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
