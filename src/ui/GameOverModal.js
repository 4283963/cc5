import { gameState, GamePhase } from '../game/GameState.js';
import { wsClient } from '../net/WebSocketClient.js';

export class GameOverModal {
  constructor() {
    this.modal = document.getElementById('gameOverModal');
    this.starsEl = document.getElementById('modalStars');
    this.coinsEl = document.getElementById('modalCoins');
    this.latencyEl = document.getElementById('modalLatency');
    this.btnNext = document.getElementById('btnNextLevel');
    this.btnBack = document.getElementById('btnBackToMenu');
    
    this._bindEvents();
  }

  _bindEvents() {
    gameState.on('levelComplete', (result) => {
      this.show(result);
    });
    
    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => {
        this.hide();
        gameState.emit('nextLevel');
      });
    }
    
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        this.hide();
        gameState.emit('backToMenu');
      });
    }
  }

  show(result) {
    if (!this.modal) return;
    
    const starsStr = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    this.starsEl.textContent = starsStr;
    this.coinsEl.textContent = `+${result.coinsEarned}`;
    this.latencyEl.textContent = `${result.avgLatency} ms`;
    
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
    
    if (gameState.currentLevel >= 5) {
      this.btnNext.textContent = '返回菜单';
    } else {
      this.btnNext.textContent = '下一关';
    }
    
    this.modal.classList.remove('hidden');
  }

  hide() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }
}

export const gameOverModal = new GameOverModal();
export default gameOverModal;
