export const NodeState = {
  LOCKED: 'locked',
  HACKING: 'hacking',
  HACKED: 'hacked'
};

export const GamePhase = {
  MENU: 'menu',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  GAME_OVER: 'game_over'
};

const MAX_HEALTH = 100;

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
    this.firewallNodes = [];
    this.sourceNode = null;
    
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    
    this.isDragging = false;
    this.dragStartNode = null;
    this.dragEndPos = { x: 0, y: 0 };
    
    this.totalLatency = 0;
    this.linkCount = 0;
    this.lastLatency = 0;
    
    this.levelStartTime = 0;
    this.levelElapsedTime = 0;
    
    this.activeFirewalls = new Map();
    this.tracebackPulses = [];
    
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
    this.firewallNodes = [];
    this.sourceNode = null;
    this.totalLatency = 0;
    this.linkCount = 0;
    this.levelConfig = levelData;
    
    this.health = this.maxHealth;
    this.activeFirewalls.clear();
    this.tracebackPulses = [];
    this.levelStartTime = performance.now();
    this.levelElapsedTime = 0;
    
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
      if (node.type === 'firewall') {
        this.firewallNodes.push(node.id);
      }
    });
    
    this.emit('levelLoaded', levelData);
    this.emit('progress', this.getProgress());
    this.emit('healthChanged', this.health);
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
    
    if (node && node.type === 'firewall') {
      this._activateFirewallTraceback(toNode);
    }
    
    this.totalLatency += latency;
    this.linkCount++;
    this.lastLatency = latency;
    
    this.emit('linkAdded', link);
    this.emit('progress', this.getProgress());
    
    const progress = this.getProgress();
    if (progress.hacked === progress.total && progress.total > 0) {
      this.levelElapsedTime = performance.now() - this.levelStartTime;
      this.emit('levelComplete', this.calculateLevelResult());
    }
    
    return link;
  }

  _activateFirewallTraceback(firewallNodeId) {
    const node = this.nodes.get(firewallNodeId);
    if (!node || node.type !== 'firewall') return;
    
    const tracebackTime = node.tracebackTime || 3000;
    const tracebackDamage = node.tracebackDamage || 20;
    
    this.activeFirewalls.set(firewallNodeId, {
      startTime: performance.now(),
      duration: tracebackTime,
      damage: tracebackDamage,
      triggered: false
    });
    
    this.emit('firewallActivated', {
      nodeId: firewallNodeId,
      duration: tracebackTime
    });
  }

  updateFirewalls(currentTime) {
    if (this.phase !== GamePhase.PLAYING) return;
    
    for (const [nodeId, fw] of this.activeFirewalls) {
      if (fw.triggered) continue;
      
      const elapsed = currentTime - fw.startTime;
      if (elapsed >= fw.duration) {
        fw.triggered = true;
        this._triggerTraceback(nodeId, fw.damage);
      }
    }
  }

  _triggerTraceback(fromNodeId, damage) {
    const path = this._findPathToSource(fromNodeId);
    
    if (path && path.length > 0) {
      const pulse = {
        id: 'pulse_' + Date.now(),
        path: path,
        currentIndex: 0,
        progress: 0,
        speed: 0.003,
        damage: damage,
        active: true
      };
      
      this.tracebackPulses.push(pulse);
      this.emit('tracebackStarted', { nodeId: fromNodeId, damage });
    }
  }

  _findPathToSource(fromNodeId) {
    const visited = new Set();
    const queue = [{ node: fromNodeId, path: [fromNodeId] }];
    
    while (queue.length > 0) {
      const { node, path } = queue.shift();
      
      if (node === this.sourceNode) {
        return path.reverse();
      }
      
      if (visited.has(node)) continue;
      visited.add(node);
      
      for (const link of this.links) {
        if (link.to === node && this.hackedNodes.has(link.from)) {
          if (!visited.has(link.from)) {
            queue.push({ node: link.from, path: [...path, link.from] });
          }
        }
        if (link.from === node && this.hackedNodes.has(link.to)) {
          if (!visited.has(link.to)) {
            queue.push({ node: link.to, path: [...path, link.to] });
          }
        }
      }
    }
    
    const hackedList = Array.from(this.hackedNodes);
    if (hackedList.length > 0) {
      return [fromNodeId, this.sourceNode];
    }
    
    return null;
  }

  updateTracebackPulses(deltaTime, physics) {
    if (this.phase !== GamePhase.PLAYING) return;
    
    for (const pulse of this.tracebackPulses) {
      if (!pulse.active) continue;
      
      pulse.progress += deltaTime * pulse.speed;
      
      if (pulse.progress >= 1) {
        pulse.currentIndex++;
        pulse.progress = 0;
        
        if (pulse.currentIndex >= pulse.path.length - 1) {
          pulse.active = false;
          this._takeDamage(pulse.damage);
          this.emit('tracebackHit', { damage: pulse.damage });
        }
      }
    }
    
    this.tracebackPulses = this.tracebackPulses.filter(p => p.active);
  }

  getPulsePosition(pulse, physics) {
    if (!pulse.active || pulse.currentIndex >= pulse.path.length - 1) {
      return null;
    }
    
    const fromNode = pulse.path[pulse.currentIndex];
    const toNode = pulse.path[pulse.currentIndex + 1];
    
    const fromBody = physics.getNodeBody(fromNode);
    const toBody = physics.getNodeBody(toNode);
    
    if (!fromBody || !toBody) return null;
    
    const x = fromBody.position.x + (toBody.position.x - fromBody.position.x) * pulse.progress;
    const y = fromBody.position.y + (toBody.position.y - fromBody.position.y) * pulse.progress;
    
    return { x, y, fromNode, toNode };
  }

  _takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.emit('healthChanged', this.health);
    this.emit('playerDamaged', { amount, health: this.health });
    
    if (this.health <= 0) {
      this.phase = GamePhase.GAME_OVER;
      this.emit('gameOver', { reason: 'traceback' });
    }
  }

  getHealth() {
    return this.health;
  }

  getHealthPercent() {
    return (this.health / this.maxHealth) * 100;
  }

  getElapsedTime() {
    if (this.phase === GamePhase.PLAYING) {
      return performance.now() - this.levelStartTime;
    }
    return this.levelElapsedTime;
  }

  getActiveFirewallProgress(nodeId) {
    const fw = this.activeFirewalls.get(nodeId);
    if (!fw) return null;
    
    const elapsed = performance.now() - fw.startTime;
    return Math.min(1, elapsed / fw.duration);
  }

  calculateLevelResult() {
    const avgLatency = this.linkCount > 0 ? this.totalLatency / this.linkCount : 0;
    const targetLatency = this.levelConfig?.targetLatency || 200;
    const elapsedTime = this.getElapsedTime();
    
    let stars = 1;
    if (avgLatency <= targetLatency && this.health >= 70) stars = 3;
    else if (avgLatency <= targetLatency * 1.5 && this.health >= 40) stars = 2;
    
    const baseReward = this.levelConfig?.baseReward || 100;
    const starMultiplier = stars === 3 ? 1.5 : stars === 2 ? 1.2 : 1;
    const healthBonus = Math.floor(this.health * 0.5);
    const coinsEarned = Math.floor(baseReward * starMultiplier) + healthBonus;
    
    const baseScore = baseReward * 2;
    const latencyScore = Math.max(0, (targetLatency - avgLatency) * 2);
    const healthScore = this.health * 3;
    const timePenalty = Math.floor(elapsedTime / 1000) * 5;
    const levelScore = Math.max(100, Math.floor(baseScore + latencyScore + healthScore - timePenalty));
    
    return {
      stars,
      coinsEarned,
      levelScore,
      avgLatency: Math.round(avgLatency),
      elapsedTime: Math.round(elapsedTime),
      links: this.linkCount,
      remainingHealth: this.health
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
    
    this.health = this.maxHealth;
    this.activeFirewalls.clear();
    this.tracebackPulses = [];
    this.levelStartTime = performance.now();
    this.levelElapsedTime = 0;
    
    this.nodes.forEach((node, id) => {
      node.state = node.type === 'source' ? NodeState.HACKED : NodeState.LOCKED;
      if (node.type === 'source') {
        this.hackedNodes.add(id);
      }
    });
    
    this.emit('levelReset');
    this.emit('progress', this.getProgress());
    this.emit('healthChanged', this.health);
  }
}

export const gameState = new GameState();
export default gameState;
