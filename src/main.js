import { GameEngine } from './game/GameEngine.js';
import { gameState, GamePhase } from './game/GameState.js';
import { wsClient } from './net/WebSocketClient.js';
import { hud } from './ui/HUD.js';
import { levelSelect } from './ui/LevelSelect.js';
import { gameOverModal } from './ui/GameOverModal.js';
import { leaderboard } from './ui/Leaderboard.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.engine = null;
    this.currentLevel = 1;
    this.useOfflineMode = true;
    
    this.init();
  }

  async init() {
    this.engine = new GameEngine(this.canvas);
    this.engine.start();
    
    levelSelect.render([1, 2, 3, 4, 5], {});
    levelSelect.show();
    
    try {
      const wsUrl = `ws://${window.location.hostname}:8080`;
      await wsClient.connect(wsUrl);
      
      wsClient.send('PLAYER_JOIN', { playerId: gameState.playerId });
      this.useOfflineMode = false;
      console.log('[App] Connected to server');
      
    } catch (e) {
      console.log('[App] Offline mode:', e.message);
      this.useOfflineMode = true;
      gameState.setPlayerData({
        coins: 500,
        currentLevel: 1,
        unlockedLevels: [1, 2, 3, 4, 5],
        levelProgress: {}
      });
    }
    
    this._bindEvents();
    
    const connectingModal = document.getElementById('connectingModal');
    if (connectingModal) {
      connectingModal.classList.add('hidden');
    }
  }

  _bindEvents() {
    gameState.on('levelSelect', (levelId) => {
      this.startLevel(levelId);
    });
    
    gameState.on('nextLevel', () => {
      const nextLevel = gameState.currentLevel + 1;
      if (nextLevel <= 5) {
        this.startLevel(nextLevel);
      } else {
        levelSelect.show();
      }
    });
    
    gameState.on('backToMenu', () => {
      levelSelect.show();
      gameState.phase = GamePhase.MENU;
    });
    
    gameState.on('retryLevel', () => {
      this.startLevel(gameState.currentLevel);
    });
    
    gameState.on('gameOver', () => {
      gameState.phase = GamePhase.GAME_OVER;
    });
    
    gameState.on('linkCreated', (linkData) => {
      if (!this.useOfflineMode) {
        wsClient.send('LINK_SUCCESS', {
          fromNode: linkData.from,
          toNode: linkData.to,
          latency: linkData.latency,
          levelId: gameState.currentLevel
        });
      } else {
        const baseReward = Math.floor(linkData.latency / 10);
        gameState.coins += baseReward;
        gameState.emit('playerState', gameState.getPlayerState());
      }
    });
    
    gameState.on('levelComplete', (result) => {
      if (this.useOfflineMode) {
        setTimeout(() => {
          gameState.coins += result.coinsEarned;
          const nextLevel = gameState.currentLevel + 1;
          if (nextLevel <= 5 && !gameState.unlockedLevels.includes(nextLevel)) {
            gameState.unlockedLevels.push(nextLevel);
          }
          gameState.emit('playerState', gameState.getPlayerState());
          levelSelect.render(gameState.unlockedLevels, gameState.levelProgress);
        }, 500);
      } else {
        wsClient.send('LEVEL_COMPLETE', {
          levelId: gameState.currentLevel,
          elapsedTime: result.elapsedTime,
          remainingHealth: result.remainingHealth,
          avgLatency: result.avgLatency,
          totalLatency: gameState.totalLatency,
          linkCount: gameState.linkCount
        });
      }
    });
    
    gameState.on('levelCompleteResult', (result) => {
      levelSelect.render(gameState.unlockedLevels, gameState.levelProgress);
    });
  }

  async startLevel(levelId) {
    gameState.currentLevel = levelId;
    gameState.phase = GamePhase.PLAYING;
    
    try {
      const response = await fetch(`/levels/level-${levelId}.json`);
      const levelData = await response.json();
      gameState.setLevelData(levelData);
      
    } catch (e) {
      console.error('[App] Failed to load level:', e);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
