/** 简易静态文件服务器 — 手机访问 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(ROOT, file);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => {
  const os = require('os');
  let ip = 'localhost';
  const nets = os.networkInterfaces();
  for (const [, ifaces] of Object.entries(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) { ip = iface.address; break; }
    }
  }
  console.log('==========================================');
  console.log('  多考试备考系统 - 手机访问模式');
  console.log('==========================================');
  console.log('  电脑访问: http://localhost:' + PORT);
  console.log('  手机访问: http://' + ip + ':' + PORT);
  console.log('  确保手机和电脑在同一WiFi网络');
  console.log('  按 Ctrl+C 停止');
  console.log('==========================================');
});
