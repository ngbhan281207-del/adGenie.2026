// server.js — chạy local: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

// Đọc .env đơn giản (không cần cài thêm thư viện)
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  });
} catch (_) {}

const handler = require('./generate.js');
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/generate') {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { code: 'SERVER', message: 'Lỗi máy chủ không xác định.' } }));
    }
    return;
  }

  if (url === '/' || url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, buf) => {
      if (err) {
        res.statusCode = 500;
        return res.end('Không đọc được index.html');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(buf);
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`AdGenie đang chạy tại http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Chưa có GEMINI_API_KEY. Tạo file .env (xem .env.example).');
  }
});
