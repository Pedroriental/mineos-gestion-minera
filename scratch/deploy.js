const { Client } = require('ssh2');

const DEPLOY_CMD = [
  'set -e',
  'APP_CWD="$(pm2 show mineos 2>/dev/null | grep -i "exec cwd" | head -1 | sed -E "s/.*exec cwd[^/]*(\\/[^|│]+).*/\\1/" | tr -d "[:space:]")"',
  'if [ -z "$APP_CWD" ] || [ ! -d "$APP_CWD" ]; then APP_CWD=/var/www/mineos; fi',
  'cd "$APP_CWD"',
  'echo "==> Deploy en $(pwd)"',
  'bash scripts/deploy-server-remote.sh release/diseno-sin-nomina',
].join(' && ');

const conn = new Client();
conn
  .on('ready', () => {
    console.log('==> SSH Connection Ready');
    conn.exec(DEPLOY_CMD, (err, stream) => {
      if (err) throw err;

      stream.on('close', (code) => {
        console.log(`==> SSH Connection Closed with code: ${code}`);
        conn.end();
        process.exit(code ?? 0);
      });

      stream.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      stream.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  })
  .on('error', (err) => {
    console.error('SSH error:', err.message);
    process.exit(1);
  })
  .connect({
    host: '24.144.116.215',
    port: 22,
    username: 'root',
    password: process.env.MINEOS_SSH_PASSWORD || 'pEdrojoseito345_m',
  });
