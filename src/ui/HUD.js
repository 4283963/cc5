import { gameState } from '../game/GameState.js';

export class HUD {
  constructor() {
    this.levelNumEl = document.getElementById('levelNum');
    this.progressFillEl = document.getElementById('progressFill');
    this.progressTextEl = document.getElementById('progressText');
    this.coinCountEl = document.getElementById('coinCount');
    this.latencyValueEl = document.getElementById('latencyValue');
    this.statusTextEl = document.getElementById('statusText');
    this.fpsCounterEl = document.getElementById('fpsCounter');
    this.statusIndicator = document.querySelector('.status-indicator');
    this.healthFillEl = document.getElementById('healthFill');
    this.healthTextEl = document.getElementById('healthText');
    
    this._bindEvents();
  }

  _bindEvents() {
    gameState.on('playerState', (state) => {
      this.updateCoins(state.coins);
    });
    
    gameState.on('progress', (progress) => {
      this.updateProgress(progress);
    });
    
    gameState.on('linkAdded', (link) => {
      this.updateLatency(link.latency);
    });
    
    gameState.on('levelLoaded', (levelData) => {
      this.updateLevel(levelData.id);
    });
    
    gameState.on('wsConnected', () => {
      this.updateStatus(true);
    });
    
    gameState.on('wsDisconnected', () => {
      this.updateStatus(false);
    });
    
    gameState.on('fpsUpdate', (fps) => {
      this.updateFPS(fps);
    });
    
    gameState.on('healthChanged', (health) => {
      this.updateHealth(health);
    });
    
    gameState.on('levelLoaded', () => {
      this.updateHealth(gameState.maxHealth);
    });
  }

  updateLevel(levelNum) {
    if (this.levelNumEl) {
      this.levelNumEl.textContent = String(levelNum).padStart(2, '0');
    }
  }

  updateProgress(progress) {
    if (this.progressFillEl) {
      this.progressFillEl.style.width = progress.percent + '%';
    }
    if (this.progressTextEl) {
      this.progressTextEl.textContent = `${progress.hacked} / ${progress.total}`;
    }
  }

  updateCoins(coins) {
    if (this.coinCountEl) {
      this._animateValue(this.coinCountEl, parseInt(this.coinCountEl.textContent) || 0, coins, 500);
    }
  }

  updateLatency(latency) {
    if (this.latencyValueEl) {
      this.latencyValueEl.textContent = `${Math.round(latency)} ms`;
      
      this.latencyValueEl.style.color = '#00ff88';
      this.latencyValueEl.style.textShadow = '0 0 8px rgba(0, 255, 136, 0.5)';
      
      setTimeout(() => {
        this.latencyValueEl.style.color = '';
        this.latencyValueEl.style.textShadow = '';
      }, 300);
    }
  }

  updateStatus(connected) {
    if (this.statusTextEl) {
      this.statusTextEl.textContent = connected ? '在线' : '离线';
    }
    if (this.statusIndicator) {
      this.statusIndicator.classList.toggle('offline', !connected);
    }
  }

  updateFPS(fps) {
    if (this.fpsCounterEl) {
      this.fpsCounterEl.textContent = fps;
    }
  }

  updateHealth(health) {
    if (this.healthFillEl) {
      const percent = (health / gameState.maxHealth) * 100;
      this.healthFillEl.style.width = percent + '%';
    }
    if (this.healthTextEl) {
      this.healthTextEl.textContent = Math.round(health) + '%';
    }
  }

  _animateValue(element, start, end, duration) {
    const startTime = performance.now();
    const diff = end - start;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * easeProgress);
      
      element.textContent = current.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}

export const hud = new HUD();
export default hud;
