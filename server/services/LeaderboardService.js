import db from '../db/index.js';

const memoryLeaderboard = new Map();

export class LeaderboardService {
  constructor() {
    this.memoryData = [];
  }

  async updatePlayerScore(userId, playerId, displayName = null) {
    if (!db.isConnected()) {
      return this._updateMemoryScore(playerId, displayName);
    }

    try {
      const userStats = await this._calculateUserStats(userId);
      
      const existing = await db.queryOne(
        'SELECT id FROM leaderboard WHERE user_id = ?',
        [userId]
      );

      if (existing) {
        await db.query(
          `UPDATE leaderboard 
           SET total_score = ?, total_stars = ?, levels_completed = ?, 
               best_total_time = ?, display_name = ?, last_updated = NOW()
           WHERE user_id = ?`,
          [
            userStats.totalScore,
            userStats.totalStars,
            userStats.levelsCompleted,
            userStats.bestTotalTime,
            displayName || userStats.displayName,
            userId
          ]
        );
      } else {
        await db.query(
          `INSERT INTO leaderboard 
           (user_id, player_id, display_name, total_score, total_stars, 
            levels_completed, best_total_time)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            playerId,
            displayName || userStats.displayName,
            userStats.totalScore,
            userStats.totalStars,
            userStats.levelsCompleted,
            userStats.bestTotalTime
          ]
        );
      }

      await this._recalculateRanks();
      
      return await this.getPlayerRank(playerId);
    } catch (error) {
      console.error('[LeaderboardService] updatePlayerScore error:', error);
      return null;
    }
  }

  async _calculateUserStats(userId) {
    const progress = await db.query(
      'SELECT * FROM level_progress WHERE user_id = ?',
      [userId]
    );

    const user = await db.queryOne(
      'SELECT display_name FROM users WHERE id = ?',
      [userId]
    );

    let totalScore = 0;
    let totalStars = 0;
    let levelsCompleted = 0;
    let bestTotalTime = 0;

    progress.forEach(p => {
      if (p.stars > 0) {
        levelsCompleted++;
        totalStars += p.stars;
        totalScore += p.level_score || 0;
        if (p.best_time) {
          bestTotalTime += p.best_time;
        }
      }
    });

    return {
      totalScore,
      totalStars,
      levelsCompleted,
      bestTotalTime: bestTotalTime > 0 ? bestTotalTime : null,
      displayName: user?.display_name || null
    };
  }

  async _recalculateRanks() {
    try {
      const rows = await db.query(
        'SELECT id, user_id FROM leaderboard ORDER BY total_score DESC, total_stars DESC, best_total_time ASC'
      );

      for (let i = 0; i < rows.length; i++) {
        await db.query(
          'UPDATE leaderboard SET rank = ? WHERE id = ?',
          [i + 1, rows[i].id]
        );
      }
    } catch (error) {
      console.error('[LeaderboardService] _recalculateRanks error:', error);
    }
  }

  async getLeaderboard(limit = 50) {
    if (!db.isConnected()) {
      return this._getMemoryLeaderboard(limit);
    }

    try {
      const rows = await db.query(
        `SELECT player_id, display_name, total_score, total_stars, 
                levels_completed, best_total_time, rank
         FROM leaderboard 
         ORDER BY rank ASC 
         LIMIT ?`,
        [limit]
      );

      return rows.map(row => ({
        playerId: row.player_id,
        displayName: row.display_name || '匿名黑客',
        totalScore: row.total_score,
        totalStars: row.total_stars,
        levelsCompleted: row.levels_completed,
        bestTotalTime: row.best_total_time,
        rank: row.rank
      }));
    } catch (error) {
      console.error('[LeaderboardService] getLeaderboard error:', error);
      return [];
    }
  }

  async getPlayerRank(playerId) {
    if (!db.isConnected()) {
      return this._getMemoryPlayerRank(playerId);
    }

    try {
      const row = await db.queryOne(
        `SELECT player_id, display_name, total_score, total_stars, 
                levels_completed, best_total_time, rank
         FROM leaderboard 
         WHERE player_id = ?`,
        [playerId]
      );

      if (!row) return null;

      return {
        playerId: row.player_id,
        displayName: row.display_name || '匿名黑客',
        totalScore: row.total_score,
        totalStars: row.total_stars,
        levelsCompleted: row.levels_completed,
        bestTotalTime: row.best_total_time,
        rank: row.rank
      };
    } catch (error) {
      console.error('[LeaderboardService] getPlayerRank error:', error);
      return null;
    }
  }

  _updateMemoryScore(playerId, displayName) {
    const existing = memoryLeaderboard.get(playerId);
    const entry = {
      playerId,
      displayName: displayName || existing?.displayName || '匿名黑客',
      totalScore: (existing?.totalScore || 0) + 100,
      totalStars: existing?.totalStars || 0,
      levelsCompleted: existing?.levelsCompleted || 0,
      bestTotalTime: existing?.bestTotalTime || null,
      lastUpdated: Date.now()
    };
    memoryLeaderboard.set(playerId, entry);
    return entry;
  }

  _getMemoryLeaderboard(limit) {
    return Array.from(memoryLeaderboard.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
  }

  _getMemoryPlayerRank(playerId) {
    const sorted = Array.from(memoryLeaderboard.values())
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const index = sorted.findIndex(e => e.playerId === playerId);
    if (index === -1) return null;
    
    return {
      ...sorted[index],
      rank: index + 1
    };
  }
}

export const leaderboardService = new LeaderboardService();
export default leaderboardService;
