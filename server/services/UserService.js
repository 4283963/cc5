import db from '../db/index.js';

const memoryStore = new Map();

export class UserService {
  async getOrCreateUser(playerId) {
    if (!db.isConnected()) {
      return this._getOrCreateMemoryUser(playerId);
    }
    
    try {
      let user = await db.queryOne(
        'SELECT * FROM users WHERE player_id = ?',
        [playerId]
      );
      
      if (!user) {
        await db.query(
          'INSERT INTO users (player_id, coins) VALUES (?, 0)',
          [playerId]
        );
        user = await db.queryOne(
          'SELECT * FROM users WHERE player_id = ?',
          [playerId]
        );
        
        await db.query(
          'INSERT INTO level_progress (user_id, level_id, stars) VALUES (?, 1, 0)',
          [user.id]
        );
      }
      
      return user;
    } catch (error) {
      console.error('[UserService] getOrCreateUser error:', error);
      return this._getOrCreateMemoryUser(playerId);
    }
  }

  _getOrCreateMemoryUser(playerId) {
    if (!memoryStore.has(playerId)) {
      memoryStore.set(playerId, {
        id: Date.now(),
        player_id: playerId,
        coins: 500,
        levelProgress: {
          1: { stars: 0, unlocked: true }
        }
      });
    }
    return memoryStore.get(playerId);
  }

  async getUserByPlayerId(playerId) {
    if (!db.isConnected()) {
      return memoryStore.get(playerId) || null;
    }
    
    return await db.queryOne(
      'SELECT * FROM users WHERE player_id = ?',
      [playerId]
    );
  }

  async updateCoins(userId, amount) {
    if (!db.isConnected()) {
      const user = memoryStore.values().next().value;
      if (user) {
        user.coins += amount;
        return user.coins;
      }
      return 0;
    }
    
    await db.query(
      'UPDATE users SET coins = coins + ? WHERE id = ?',
      [amount, userId]
    );
    
    const user = await db.queryOne('SELECT coins FROM users WHERE id = ?', [userId]);
    return user ? user.coins : 0;
  }

  async getPlayerState(playerId) {
    const user = await this.getOrCreateUser(playerId);
    const progress = await this.getLevelProgress(user.id);
    
    const unlockedLevels = [];
    const levelProgress = {};
    
    for (let i = 1; i <= 5; i++) {
      const p = progress[i];
      if (p && p.unlocked) {
        unlockedLevels.push(i);
      }
      if (p) {
        levelProgress[i] = {
          stars: p.stars || 0,
          bestLatency: p.best_latency || null
        };
      }
    }
    
    return {
      coins: user.coins || 0,
      currentLevel: Math.max(...unlockedLevels, 1),
      unlockedLevels,
      levelProgress
    };
  }

  async getLevelProgress(userId) {
    if (!db.isConnected()) {
      const user = memoryStore.values().next().value;
      return user ? user.levelProgress || {} : {};
    }
    
    const rows = await db.query(
      'SELECT * FROM level_progress WHERE user_id = ?',
      [userId]
    );
    
    const progress = {};
    rows.forEach(row => {
      progress[row.level_id] = {
        ...row,
        unlocked: true
      };
    });
    
    return progress;
  }

  async unlockLevel(userId, levelId) {
    if (!db.isConnected()) {
      return true;
    }
    
    try {
      const existing = await db.queryOne(
        'SELECT id FROM level_progress WHERE user_id = ? AND level_id = ?',
        [userId, levelId]
      );
      
      if (!existing) {
        await db.query(
          'INSERT INTO level_progress (user_id, level_id, stars) VALUES (?, ?, 0)',
          [userId, levelId]
        );
      }
      
      return true;
    } catch (error) {
      console.error('[UserService] unlockLevel error:', error);
      return false;
    }
  }
}

export const userService = new UserService();
export default userService;
