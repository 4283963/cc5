import userService from './UserService.js';
import levelService from './LevelService.js';
import leaderboardService from './LeaderboardService.js';

export class GameService {
  constructor() {
    this.activeSessions = new Map();
  }

  joinGame(playerId) {
    const session = {
      playerId,
      currentLevel: null,
      levelState: null,
      joinedAt: Date.now()
    };
    
    this.activeSessions.set(playerId, session);
    return session;
  }

  leaveGame(playerId) {
    this.activeSessions.delete(playerId);
  }

  async startLevel(playerId, levelId) {
    const level = levelService.getLevel(levelId);
    if (!level) {
      return { success: false, error: 'Level not found' };
    }
    
    const user = await userService.getOrCreateUser(playerId);
    const progress = await userService.getLevelProgress(user.id);
    
    if (!progress[levelId] || !progress[levelId].unlocked) {
      return { success: false, error: 'Level not unlocked' };
    }
    
    const session = this.activeSessions.get(playerId) || this.joinGame(playerId);
    session.currentLevel = levelId;
    session.levelState = {
      hackedNodes: new Set([level.nodes.find(n => n.type === 'source')?.id]),
      targetNodes: level.nodes.filter(n => n.type === 'target').map(n => n.id),
      links: [],
      totalLatency: 0,
      linkCount: 0
    };
    
    return {
      success: true,
      levelData: level
    };
  }

  async processLink(playerId, fromNode, toNode, latency) {
    const session = this.activeSessions.get(playerId);
    if (!session || !session.currentLevel) {
      return { success: false, error: 'No active session' };
    }
    
    const { currentLevel, levelState } = session;
    
    const validation = levelService.validateLink(currentLevel, fromNode, toNode);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    if (!levelState.hackedNodes.has(fromNode)) {
      return { success: false, error: 'Source node not hacked' };
    }
    
    if (levelState.hackedNodes.has(toNode)) {
      return { success: false, error: 'Target already hacked' };
    }
    
    if (latency < 10 || latency > 5000) {
      return { success: false, error: 'Invalid latency value' };
    }
    
    const linkReward = Math.floor(latency / 20);
    levelState.hackedNodes.add(toNode);
    levelState.links.push({ from: fromNode, to: toNode, latency });
    levelState.totalLatency += latency;
    levelState.linkCount++;
    
    const user = await userService.getOrCreateUser(playerId);
    await userService.updateCoins(user.id, linkReward);
    
    const isTarget = levelState.targetNodes.includes(toNode);
    const targetProgress = levelState.targetNodes.filter(n => levelState.hackedNodes.has(n)).length;
    const totalTargets = levelState.targetNodes.length;
    
    const levelComplete = targetProgress >= totalTargets && totalTargets > 0;
    let completeResult = null;
    
    if (levelComplete) {
      const avgLatency = levelState.totalLatency / levelState.linkCount;
      const stars = levelService.calculateStars(avgLatency, currentLevel);
      const coinsEarned = levelService.calculateReward(stars, currentLevel);
      const elapsedTime = levelState.elapsedTime || 0;
      const remainingHealth = levelState.remainingHealth ?? 100;
      const levelScore = levelService.calculateLevelScore(
        currentLevel, 
        avgLatency, 
        elapsedTime, 
        remainingHealth
      );
      
      await userService.updateCoins(user.id, coinsEarned);
      await levelService.saveProgress(
        user.id, 
        currentLevel, 
        stars, 
        Math.round(avgLatency), 
        coinsEarned,
        elapsedTime > 0 ? Math.round(elapsedTime) : null,
        levelScore
      );
      
      const nextLevel = currentLevel + 1;
      if (nextLevel <= 5) {
        await userService.unlockLevel(user.id, nextLevel);
      }
      
      const rankInfo = await leaderboardService.updatePlayerScore(
        user.id, 
        playerId, 
        user.display_name
      );
      
      completeResult = {
        stars,
        coinsEarned,
        avgLatency: Math.round(avgLatency),
        elapsedTime: Math.round(elapsedTime),
        levelScore,
        remainingHealth,
        nextLevel: nextLevel <= 5 ? nextLevel : null,
        rank: rankInfo?.rank || null,
        totalScore: rankInfo?.totalScore || 0
      };
    }
    
    return {
      success: true,
      reward: linkReward,
      isTarget,
      targetProgress,
      totalTargets,
      levelComplete,
      completeResult
    };
  }

  getSession(playerId) {
    return this.activeSessions.get(playerId) || null;
  }

  async completeLevel(playerId, levelId, data) {
    const session = this.activeSessions.get(playerId);
    if (!session || !session.currentLevel) {
      return { success: false, error: 'No active session' };
    }

    if (session.currentLevel !== levelId) {
      return { success: false, error: 'Level mismatch' };
    }

    const { elapsedTime, remainingHealth, avgLatency, totalLatency, linkCount } = data;
    
    if (elapsedTime == null || remainingHealth == null || avgLatency == null) {
      return { success: false, error: 'Missing required data' };
    }

    const user = await userService.getOrCreateUser(playerId);
    const stars = levelService.calculateStars(avgLatency, levelId);
    const coinsEarned = levelService.calculateReward(stars, levelId);
    const levelScore = levelService.calculateLevelScore(
      levelId,
      avgLatency,
      elapsedTime,
      remainingHealth
    );

    await userService.updateCoins(user.id, coinsEarned);
    await levelService.saveProgress(
      user.id,
      levelId,
      stars,
      Math.round(avgLatency),
      coinsEarned,
      Math.round(elapsedTime),
      levelScore
    );

    const nextLevel = levelId + 1;
    if (nextLevel <= 5) {
      await userService.unlockLevel(user.id, nextLevel);
    }

    const rankInfo = await leaderboardService.updatePlayerScore(
      user.id,
      playerId,
      user.display_name
    );

    session.levelState = null;
    session.currentLevel = null;

    return {
      success: true,
      stars,
      coinsEarned,
      avgLatency: Math.round(avgLatency),
      elapsedTime: Math.round(elapsedTime),
      levelScore,
      remainingHealth,
      nextLevel: nextLevel <= 5 ? nextLevel : null,
      rank: rankInfo?.rank || null,
      totalScore: rankInfo?.totalScore || 0
    };
  }
}

export const gameService = new GameService();
export default gameService;
