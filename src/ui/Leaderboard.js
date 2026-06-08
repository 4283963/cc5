import { gameState } from '../game/GameState.js';
import { wsClient } from '../net/WebSocketClient.js';

export class Leaderboard {
  constructor() {
    this.modal = document.getElementById('leaderboardModal');
    this.btnLeaderboard = document.getElementById('btnLeaderboard');
    this.btnClose = document.getElementById('btnCloseLeaderboard');
    this.itemsContainer = document.getElementById('leaderboardItems');
    this.myRankEl = document.getElementById('myRank');
    this.myScoreEl = document.getElementById('myScore');
    
    this.leaderboardData = [];
    this.myRank = null;
    
    this._bindEvents();
  }

  _bindEvents() {
    if (this.btnLeaderboard) {
      this.btnLeaderboard.addEventListener('click', () => {
        this.show();
      });
    }
    
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        this.hide();
      });
    }
    
    gameState.on('leaderboardData', (data) => {
      this.leaderboardData = data.leaderboard || [];
      this.render();
    });
    
    gameState.on('leaderboardRank', (data) => {
      this.myRank = data;
      this._updateMyRank();
    });
    
    gameState.on('wsConnected', () => {
      this._fetchData();
    });
  }

  show() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this._fetchData();
  }

  hide() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
  }

  _fetchData() {
    if (wsClient.isConnected()) {
      wsClient.send('LEADERBOARD_GET', { limit: 50 });
      wsClient.send('LEADERBOARD_RANK', { playerId: gameState.playerId });
    } else {
      this._renderMockData();
    }
  }

  _updateMyRank() {
    if (!this.myRank) {
      if (this.myRankEl) this.myRankEl.textContent = '--';
      if (this.myScoreEl) this.myScoreEl.textContent = '0 分';
      return;
    }
    
    if (this.myRankEl) {
      this.myRankEl.textContent = this.myRank.rank ? `#${this.myRank.rank}` : '未上榜';
    }
    if (this.myScoreEl) {
      this.myScoreEl.textContent = `${this.myRank.totalScore || 0} 分`;
    }
  }

  render() {
    if (!this.itemsContainer) return;
    
    if (this.leaderboardData.length === 0) {
      this.itemsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          暂无排行数据
        </div>
      `;
      return;
    }
    
    const html = this.leaderboardData.map((entry, index) => {
      const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
      const starsStr = '★'.repeat(entry.totalStars || 0);
      
      return `
        <div class="leaderboard-item ${rankClass}">
          <span class="col-rank">#${entry.rank || index + 1}</span>
          <span class="col-name">${this._truncateName(entry.displayName, 12)}</span>
          <span class="col-stars">${starsStr || '—'}</span>
          <span class="col-score">${entry.totalScore?.toLocaleString() || 0}</span>
        </div>
      `;
    }).join('');
    
    this.itemsContainer.innerHTML = html;
  }

  _truncateName(name, maxLength) {
    if (!name) return '匿名黑客';
    if (name.length <= maxLength) return name;
    return name.substr(0, maxLength) + '...';
  }

  _renderMockData() {
    const mockData = [
      { rank: 1, displayName: 'PhantomX', totalScore: 15800, totalStars: 15 },
      { rank: 2, displayName: 'CyberGhost', totalScore: 14200, totalStars: 14 },
      { rank: 3, displayName: 'NeonHacker', totalScore: 12900, totalStars: 13 },
      { rank: 4, displayName: 'ZeroDay', totalScore: 11500, totalStars: 12 },
      { rank: 5, displayName: 'ByteRunner', totalScore: 10200, totalStars: 11 },
      { rank: 6, displayName: 'ShadowNet', totalScore: 9800, totalStars: 10 },
      { rank: 7, displayName: 'CodeBreaker', totalScore: 8500, totalStars: 9 },
      { rank: 8, displayName: 'DarkByte', totalScore: 7200, totalStars: 8 },
      { rank: 9, displayName: 'Firewall_Pro', totalScore: 6500, totalStars: 7 },
      { rank: 10, displayName: 'RootAccess', totalScore: 5800, totalStars: 6 }
    ];
    
    this.leaderboardData = mockData;
    this.myRank = { rank: null, totalScore: 0 };
    this.render();
    this._updateMyRank();
  }
}

export const leaderboard = new Leaderboard();
export default leaderboard;
