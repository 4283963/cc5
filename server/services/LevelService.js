import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir = path.join(__dirname, '..', '..', 'public', 'levels');

export class LevelService {
  constructor() {
    this.levelCache = new Map();
    this._loadAllLevels();
  }

  _loadAllLevels() {
    try {
      const files = fs.readdirSync(levelsDir);
      files.filter(f => f.endsWith('.json')).forEach(file => {
        const levelId = parseInt(file.replace('level-', '').replace('.json', ''), 10);
        const data = JSON.parse(fs.readFileSync(path.join(levelsDir, file), 'utf8'));
        this.levelCache.set(levelId, data);
      });
      console.log(`[LevelService] Loaded ${this.levelCache.size} levels`);
    } catch (error) {
      console.error('[LevelService] Failed to load levels:', error.message);
    }
  }

  getLevel(levelId) {
    return this.levelCache.get(levelId) || null;
  }

  getAllLevels() {
    return Array.from(this.levelCache.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([id, data]) => ({ id, name: data.name, description: data.description }));
  }

  getLevelCount() {
    return this.levelCache.size;
  }

  validateLink(levelId, fromNode, toNode) {
    const level = this.getLevel(levelId);
    if (!level) {
      return { valid: false, reason: 'Level not found' };
    }
    
    const nodes = level.nodes;
    const fromNodeData = nodes.find(n => n.id === fromNode);
    const toNodeData = nodes.find(n => n.id === toNode);
    
    if (!fromNodeData || !toNodeData) {
      return { valid: false, reason: 'Node not found' };
    }
    
    if (fromNode === toNode) {
      return { valid: false, reason: 'Cannot link to self' };
    }
    
    return {
      valid: true,
      fromNode: fromNodeData,
      toNode: toNodeData
    };
  }

  calculateStars(latency, levelId) {
    const level = this.getLevel(levelId);
    if (!level) return 1;
    
    const targetLatency = level.targetLatency || 200;
    
    if (latency <= targetLatency) return 3;
    if (latency <= targetLatency * 1.5) return 2;
    return 1;
  }

  calculateReward(stars, levelId) {
    const level = this.getLevel(levelId);
    if (!level) return 0;
    
    const baseReward = level.baseReward || 100;
    const multipliers = { 1: 1.0, 2: 1.2, 3: 1.5 };
    const multiplier = multipliers[stars] || 1.0;
    
    return Math.floor(baseReward * multiplier);
  }

  calculateLevelScore(levelId, avgLatency, elapsedTime, remainingHealth) {
    const level = this.getLevel(levelId);
    if (!level) return 100;
    
    const baseReward = level.baseReward || 100;
    const targetLatency = level.targetLatency || 200;
    
    const baseScore = baseReward * 2;
    const latencyScore = Math.max(0, (targetLatency - avgLatency) * 2);
    const healthScore = (remainingHealth || 100) * 3;
    const timePenalty = Math.floor(elapsedTime / 1000) * 5;
    
    return Math.max(100, Math.floor(baseScore + latencyScore + healthScore - timePenalty));
  }

  async saveProgress(userId, levelId, stars, bestLatency, coinsEarned, bestTime = null, levelScore = null) {
    if (!db.isConnected()) {
      return true;
    }
    
    try {
      const existing = await db.queryOne(
        'SELECT * FROM level_progress WHERE user_id = ? AND level_id = ?',
        [userId, levelId]
      );
      
      if (existing) {
        const newStars = Math.max(existing.stars, stars);
        const newBestLatency = existing.best_latency 
          ? Math.min(existing.best_latency, bestLatency) 
          : bestLatency;
        const newBestTime = existing.best_time && bestTime 
          ? Math.min(existing.best_time, bestTime) 
          : (bestTime || existing.best_time);
        const newLevelScore = Math.max(existing.level_score || 0, levelScore || 0);
        
        await db.query(
          `UPDATE level_progress 
           SET stars = ?, best_latency = ?, coins_earned = coins_earned + ?, 
               best_time = ?, level_score = ?, completed_at = ?
           WHERE user_id = ? AND level_id = ?`,
          [newStars, newBestLatency, coinsEarned, newBestTime, newLevelScore, new Date(), userId, levelId]
        );
      } else {
        await db.query(
          `INSERT INTO level_progress 
           (user_id, level_id, stars, best_latency, coins_earned, best_time, level_score, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, levelId, stars, bestLatency, coinsEarned, bestTime, levelScore, new Date()]
        );
      }
      
      return true;
    } catch (error) {
      console.error('[LevelService] saveProgress error:', error);
      return false;
    }
  }

  async checkLevelComplete(userId, levelId, hackedTargets, totalTargets) {
    if (hackedTargets < totalTargets) {
      return { complete: false };
    }
    
    return {
      complete: true,
      nextLevel: levelId + 1 <= 5 ? levelId + 1 : null
    };
  }
}

export const levelService = new LevelService();
export default levelService;
