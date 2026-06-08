import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { initDatabase, isConnected } from './db/index.js';
import { initWebSocket } from './ws/WebSocketServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

const publicDir = path.join(__dirname, '..', 'public');
app.use('/levels', express.static(path.join(publicDir, 'levels')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: isConnected() ? 'connected' : 'disconnected',
    timestamp: Date.now()
  });
});

app.get('/api/levels', (req, res) => {
  const levels = [1, 2, 3, 4, 5].map(id => ({
    id,
    name: `Level ${id}`,
    url: `/levels/level-${id}.json`
  }));
  res.json({ levels });
});

async function startServer() {
  await initDatabase();
  
  initWebSocket(server);
  
  server.listen(config.wsPort, () => {
    console.log(`[Server] WebSocket + HTTP server running on port ${config.wsPort}`);
    console.log(`[Server] HTTP API: http://localhost:${config.wsPort}`);
    console.log(`[Server] WebSocket: ws://localhost:${config.wsPort}`);
    console.log(`[Server] Database: ${isConnected() ? 'MySQL connected' : 'Memory mode'}`);
  });
  
  server.on('error', (error) => {
    console.error('[Server] Server error:', error);
  });
}

startServer().catch(error => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});

export { app, server };
export default app;
