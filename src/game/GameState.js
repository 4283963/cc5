export const NodeState = {
  LOCKED: 'locked',
  HACKING: 'hacking',
  HACKED: 'hacked'
};

export const GamePhase = {
  MENU: 'menu',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete'
};

class GameState {
  constructor() {
    this.phase = GamePhase.MENU;
    this.playerId = this.getOrCreatePlayerId();
    this.coins = 0;
    this.currentLevel = 1;
    this.unlockedLevels = [1];
    this.levelProgress = {};
    
    this.nodes = new Map();
    this.links = [];
    this.hackedNodes = new Set();
    this.targetNodes = [];
    this.sourceNode = null;
    
    this.isDragging = false;
    this.dragStartNode = null;
    this.dragEndPos = { x: 0, y: 0 };
    
    this.totalLatency = 0;
    this.linkCount = 0;
    this.lastLatency = 0;
    
    this.listeners = new Map();
  }

  getOrCreatePlayerId() {
    let id = localStorage.getItem('cyberhack_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('cyberhack_player_id', id);
    }
    return id;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  setPlayerData(data) {
    this.coins = data.coins || 0;
    this.currentLevel = data.currentLevel || 1;
    this.unlockedLevels = data.unlockedLevels || [1];
    this.levelProgress = data.levelProgress || {};
    this.emit('playerState', this.getPlayerState());
  }

  getPlayerState() {
    return {
      playerId: this.playerId,
      coins: this.coins,
      currentLevel: this.currentLevel,
      unlockedLevels: [...this.unlockedLevels],
      levelProgress: { ...this.levelProgress }
    };
  }

  setLevelData(levelData) {
    this.nodes.clear();
    this.links = [];
    this.hackedNodes.clear();
    this.targetNodes = [];
    this.sourceNode = null;
    this.totalLatency = 0;
    this.linkCount = 0;
    this.levelConfig = levelData;
    
    levelData.nodes.forEach(node => {
      this.nodes.set(node.id, {
        ...node,
        state: node.type === 'source' ? NodeState.HACKED : NodeState.LOCKED,
        body: null
      });
      
      if (node.type === 'source') {
        this.sourceNode = node.id;
        this.hackedNodes.add(node.id);
      }
      if (node.type === 'target') {
        this.targetNodes.push(node.id);
      }
    });
    
    this.emit('levelLoaded', levelData);
    this.emit('progress', this.getProgress());
  }

  getProgress() {
    const totalTargets = this.targetNodes.length;
    const hackedTargets = this.targetNodes.filter(id => this.hackedNodes.has(id)).length;
    return {
      hacked: hackedTargets,
      total: totalTargets,
      percent: totalTargets > 0 ? (hackedTargets / totalTargets) * 100 : 0
    };
  }

  addLink(fromNode, toNode, latency) {
    const link = { from: fromNode, to: toNode, latency };
    this.links.push(link);
    
    const node = this.nodes.get(toNode);
    if (node) {
      node.state = NodeState.HACKED;
      this.hackedNodes.add(toNode);
    }
    
    this.totalLatency += latency;
    this.linkCount++;
    this.lastLatency = latency;
    
    this.emit('linkAdded', link);
    this.emit('progress', this.getProgress());
    
    const progress = this.getProgress();
    if (progress.hacked === progress.total && progress.total > 0) {
      this.emit('levelComplete', this.calculateLevelResult());
    }
    
    return link;
  }

  calculateLevelResult() {
    const avgLatency = this.linkCount > 0 ? this.totalLatency / this.linkCount : 0;
    const targetLatency = this.levelConfig?.targetLatency || 200;
    
    let stars = 1;
    if (avgLatency <= targetLatency) stars = 3;
    else if (avgLatency <= targetLatency * 1.5) stars = 2;
    
    const baseReward = this.levelConfig?.baseReward || 100;
    const starMultiplier = stars === 3 ? 1.5 : stars === 2 ? 1.2 : 1;
    const coinsEarned = Math.floor(baseReward * starMultiplier);
    
    return {
      stars,
      coinsEarned,
      avgLatency: Math.round(avgLatency),
      links: this.linkCount
    };
  }

  isNodeHackable(nodeId) {
    if (this.hackedNodes.has(nodeId)) return false;
    
    return this.hackedNodes.size > 0;
  }

  resetLevel() {
    this.links = [];
    this.hackedNodes.clear();
    this.totalLatency = 0;
    this.linkCount = 0;
    this.lastLatency = 0;
    
    this.nodes.forEach((node, id) => {
      node.state = node.type === 'source' ? NodeState.HACKED : NodeState.LOCKED;
      if (node.type === 'source') {
        this.hackedNodes.add(id);
      }
    });
    
    this.emit('levelReset');
    this.emit('progress', this.getProgress());
  }
}

export const gameState = new GameState();
export default gameState;
