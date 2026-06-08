import { gameState } from '../game/GameState.js';
import { wsClient } from '../net/WebSocketClient.js';

export class LevelSelect {
  constructor() {
    this.container = document.getElementById('levelSelect');
    this.grid = document.getElementById('levelGrid');
    this.totalLevels = 5;
    
    this._bindEvents();
  }

  _bindEvents() {
    gameState.on('playerState', (state) => {
      this.render(state.unlockedLevels, state.levelProgress);
    });
    
    gameState.on('levelComplete', () => {
      this.show();
    });
  }

  render(unlockedLevels, levelProgress) {
    if (!this.grid) return;
    
    this.grid.innerHTML = '';
    
    for (let i = 1; i <= this.totalLevels; i++) {
      const card = document.createElement('div');
      card.className = 'level-card';
      
      const isUnlocked = unlockedLevels.includes(i);
      const progress = levelProgress[i];
      
      if (!isUnlocked) {
        card.classList.add('locked');
      }
      if (progress && progress.stars > 0) {
        card.classList.add('completed');
      }
      
      const stars = progress ? progress.stars : 0;
      const starsStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      
      card.innerHTML = `
        <span class="level-num">${String(i).padStart(2, '0')}</span>
        ${isUnlocked ? `<span class="level-stars">${starsStr}</span>` : '<span class="level-stars">🔒</span>'}
      `;
      
      if (isUnlocked) {
        card.addEventListener('click', () => this._selectLevel(i));
      }
      
      this.grid.appendChild(card);
    }
  }

  _selectLevel(levelId) {
    this.hide();
    gameState.emit('levelSelect', levelId);
  }

  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }
}

export const levelSelect = new LevelSelect();
export default levelSelect;
