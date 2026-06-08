import { gameState, GamePhase } from '../game/GameState.js';
import { wsClient } from '../net/WebSocketClient.js';

export class GameOverModal {
  constructor() {
    this.modal = document.getElementById('gameOverModal');
    this.modalTitle = this.modal?.querySelector('.modal-title');
    this.statsContainer = this.modal?.querySelector('.modal-stats');
    this.starsEl = document.getElementById('modalStars');
    this.coinsEl = document.getElementById('modalCoins');
    this.latencyEl = document.getElementById('modalLatency');
    this.healthEl = document.getElementById('modalHealth');
    this.timeEl = document.getElementById('modalTime');
    this.scoreEl = document.getElementById('modalScore');
    this.btnNext = document.getElementById('btnNextLevel');
    this.btnRetry = document.getElementById('btnRetry');
    this.btnBack = document.getElementById('btnBackToMenu');
    
    this._bindEvents();
  }

  _bindEvents() {
    gameState.on('levelComplete', (result) => {
      this.showLevelComplete(result);
    });
    
    gameState.on('gameOver', (data) => {
      this.showGameOver(data);
    });
    
    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => {
        this.hide();
        gameState.emit('nextLevel');
      });
    }
    
    if (this.btnRetry) {
      this.btnRetry.addEventListener('click', () => {
        this.hide();
        gameState.emit('retryLevel');
      });
    }
    
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        this.hide();
        gameState.emit('backToMenu');
      });
    }
  }

  showLevelComplete(result) {
    if (!this.modal) return;
    
    if (this.modalTitle) {
      this.modalTitle.textContent = '入侵完成';
      this.modalTitle.setAttribute('data-text', '入侵完成');
      this.modalTitle.style.color = 'var(--neon-green)';
      this.modalTitle.style.textShadow = '0 0 10px var(--neon-green)';
    }
    
    const starsStr = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    if (this.starsEl) this.starsEl.textContent = starsStr;
    if (this.coinsEl) this.coinsEl.textContent = `+${result.coinsEarned}`;
    if (this.latencyEl) this.latencyEl.textContent = `${result.avgLatency} ms`;
    if (this.healthEl) this.healthEl.textContent = `${result.remainingHealth}%`;
    if (this.timeEl) this.timeEl.textContent = this._formatTime(result.elapsedTime);
    if (this.scoreEl) this.scoreEl.textContent = result.levelScore;
    
    if (this.starsEl) {
      if (result.stars >= 3) {
        this.starsEl.style.color = '#ffff00';
        this.starsEl.style.textShadow = '0 0 15px rgba(255, 255, 0, 0.8)';
      } else if (result.stars >= 2) {
        this.starsEl.style.color = '#00ff88';
        this.starsEl.style.textShadow = '0 0 15px rgba(0, 255, 136, 0.8)';
      } else {
        this.starsEl.style.color = '#ff6600';
        this.starsEl.style.textShadow = '0 0 15px rgba(255, 102, 0, 0.8)';
      }
    }
    
    if (this.btnNext) {
      this.btnNext.style.display = 'inline-block';
      if (gameState.currentLevel >= 5) {
        this.btnNext.textContent = '返回菜单';
      } else {
        this.btnNext.textContent = '下一关';
      }
    }
    if (this.btnRetry) {
      this.btnRetry.style.display = 'none';
    }
    
    this.modal.classList.remove('hidden');
  }

  showGameOver(data) {
    if (!this.modal) return;
    
    if (this.modalTitle) {
      this.modalTitle.textContent = '系统崩溃';
      this.modalTitle.setAttribute('data-text', '系统崩溃');
      this.modalTitle.style.color = 'var(--neon-red)';
      this.modalTitle.style.textShadow = '0 0 10px var(--neon-red)';
    }
    
    if (this.starsEl) this.starsEl.textContent = '—';
    if (this.coinsEl) this.coinsEl.textContent = '+0';
    if (this.latencyEl) this.latencyEl.textContent = '-- ms';
    if (this.healthEl) this.healthEl.textContent = '0%';
    if (this.timeEl) this.timeEl.textContent = this._formatTime(gameState.getElapsedTime());
    if (this.scoreEl) this.scoreEl.textContent = '0';
    
    if (this.starsEl) {
      this.starsEl.style.color = 'var(--text-secondary)';
      this.starsEl.style.textShadow = 'none';
    }
    
    if (this.btnNext) {
      this.btnNext.style.display = 'none';
    }
    if (this.btnRetry) {
      this.btnRetry.style.display = 'inline-block';
    }
    
    this.modal.classList.remove('hidden');
  }

  _formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  hide() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }
}

export const gameOverModal = new GameOverModal();
export default gameOverModal;
