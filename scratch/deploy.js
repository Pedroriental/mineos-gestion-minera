const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('==> SSH Connection Ready');
  
  // Ejecutar comando no interactivo
  conn.exec('cd /var/www/mineos && git fetch origin && git checkout release/diseno-sin-nomina && git pull origin release/diseno-sin-nomina && npm install && npm run build && pm2 restart all && pm2 status', (err, stream) => {
    if (err) throw err;
    
    stream.on('close', (code, signal) => {
      console.log('==> SSH Connection Closed with code: ' + code);
      conn.end();
      process.exit(0);
    });
    
    stream.on('data', (data) => {
      process.stdout.write(data.toString());
    });
    
    stream.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '24.144.116.215',
  port: 22,
  username: 'root',
  password: 'pEdrojoseito345_m'
});
