import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  wsPort: parseInt(process.env.WS_PORT || '8080', 10),
  
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cyber_hack',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  
  game: {
    maxLevels: 5,
    baseReward: 100,
    starMultipliers: {
      1: 1.0,
      2: 1.2,
      3: 1.5
    },
    maxLatencyMultiplier: 3,
    minLinksForCompletion: 1
  }
};

export default config;
