const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pdf': 'application/pdf'
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Danh sách SSE client để Hot-Reload
let sseClients = [];

function notifyHotReload(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  sseClients.forEach(res => {
    try {
      res.write(payload);
    } catch (e) {}
  });
}

// File Watcher với Debounce
let watchTimeout = null;
fs.watch(ROOT_DIR, { recursive: false }, (eventType, filename) => {
  if (!filename) return;
  const ext = path.extname(filename).toLowerCase();
  if (['.md', '.html', '.css', '.js'].includes(ext)) {
    if (watchTimeout) clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      console.log(`⚡ Phát hiện thay đổi trong file: ${filename} -> Đang kích hoạt Hot-Reload...`);
      if (filename === 'kt.md' || filename === 'tc.md') {
        notifyHotReload({ type: 'md-updated', file: filename });
      } else {
        notifyHotReload({ type: 'page-reload', file: filename });
      }
    }, 250);
  }
});

function startServer(port) {
  const server = http.createServer((req, res) => {
    // Add CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let reqPath = decodeURIComponent(req.url.split('?')[0]);

    // SSE Hot-Reload Endpoint
    if (reqPath === '/api/live-reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      });
      res.write(': connected\n\n');
      sseClients.push(res);
      req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
      });
      return;
    }

    if (reqPath === '/' || reqPath === '/index.html') {
      reqPath = '/ai-chatbot-studio.html';
    }

    let filePath = path.join(ROOT_DIR, reqPath);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${reqPath}`);
        return;
      }

      const contentType = getContentType(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Cổng ${port} đang bận, tự động chuyển sang cổng ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Lỗi máy chủ:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n======================================================`);
    console.log(`🚀 AI CHATBOT STUDIO PRO V2 - SERVER ĐANG CHẠY!`);
    console.log(`🔥 ĐÃ KÍCH HOẠT HOT-RELOAD CHO FILE KT.MD & TC.MD!`);
    console.log(`======================================================`);
    console.log(`🔗 Đường dẫn ứng dụng: ${url}`);
    console.log(`📄 Trang chính:        ${url}/ai-chatbot-studio.html`);
    console.log(`📚 Tri thức (kt.md):    ${url}/kt.md`);
    console.log(`🎭 Tính cách (tc.md):  ${url}/tc.md`);
    console.log(`======================================================\n`);

    // Tự động mở trình duyệt trên Windows
    const openCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(openCmd, (error) => {
      if (!error) {
        console.log(`✨ Đã tự động mở trình duyệt tại: ${url}`);
      }
    });
  });
}

startServer(DEFAULT_PORT);
