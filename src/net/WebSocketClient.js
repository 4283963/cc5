import { gameState } from '../game/GameState.js';

export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    this.messageHandlers = new Map();
    this.pendingMessages = [];
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            this.send(msg.type, msg.data);
          }
          
          gameState.emit('wsConnected');
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (e) {
            console.error('[WS] Parse error:', e);
          }
        };
        
        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.connected = false;
          gameState.emit('wsDisconnected');
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this._scheduleReconnect(url);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };
        
      } catch (e) {
        reject(e);
      }
    });
  }

  _scheduleReconnect(url) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(url).catch(() => {});
    }, delay);
  }

  _handleMessage(message) {
    const { type, data } = message;
    
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type).forEach(handler => handler(data));
    }
    
    gameState.emit('wsMessage', message);
    this._handleDefaultMessages(type, data);
  }

  _handleDefaultMessages(type, data) {
    switch (type) {
      case 'PLAYER_STATE':
        gameState.setPlayerData(data);
        break;
      
      case 'LEVEL_DATA':
        break;
      
      case 'LINK_RESULT':
        if (data.success) {
          gameState.coins += data.reward || 0;
          gameState.emit('playerState', gameState.getPlayerState());
        }
        break;
      
      case 'LEVEL_COMPLETE':
        gameState.coins += data.coinsEarned || 0;
        if (data.nextLevel && !gameState.unlockedLevels.includes(data.nextLevel)) {
          gameState.unlockedLevels.push(data.nextLevel);
        }
        gameState.emit('playerState', gameState.getPlayerState());
        break;
      
      case 'ERROR':
        console.error('[WS] Server error:', data.message);
        gameState.emit('error', data);
        break;
    }
  }

  send(type, data = {}) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingMessages.push({ type, data });
      return false;
    }
    
    const message = JSON.stringify({ type, data });
    this.ws.send(message);
    return true;
  }

  on(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type).add(handler);
    return () => this.messageHandlers.get(type).delete(handler);
  }

  off(type, handler) {
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type).delete(handler);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
