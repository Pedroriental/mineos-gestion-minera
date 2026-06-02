import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('==> SSH Connection Ready');
  
  conn.exec('cat /var/www/mineos/.env.local', (err, stream) => {
    if (err) throw err;
    
    stream.on('close', (code, signal) => {
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
