import { WebSocketServer } from 'ws';
import gameService from '../services/GameService.js';
import userService from '../services/UserService.js';
import config from '../config.js';

export class WebSocketGateway {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    
    this._setupConnectionHandler();
    console.log(`[WS] WebSocket server ready on port ${config.wsPort}`);
  }

  _setupConnectionHandler() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this._generateClientId();
      console.log(`[WS] Client connected: ${clientId}`);
      
      const client = {
        id: clientId,
        ws,
        playerId: null,
        connectedAt: Date.now()
      };
      
      this.clients.set(clientId, client);
      
      ws.on('message', (data) => this._handleMessage(client, data));
      
      ws.on('close', () => {
        console.log(`[WS] Client disconnected: ${clientId}`);
        if (client.playerId) {
          gameService.leaveGame(client.playerId);
        }
        this.clients.delete(clientId);
      });
      
      ws.on('error', (error) => {
        console.error(`[WS] Client error ${clientId}:`, error.message);
      });
    });
  }

  _generateClientId() {
    return 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  async _handleMessage(client, data) {
    try {
      const message = JSON.parse(data.toString());
      const { type, data: payload } = message;
      
      console.log(`[WS] Received ${type} from ${client.id}`);
      
      switch (type) {
        case 'PLAYER_JOIN':
          await this._handlePlayerJoin(client, payload);
          break;
        
        case 'LEVEL_START':
          await this._handleLevelStart(client, payload);
          break;
        
        case 'LINK_SUCCESS':
          await this._handleLinkSuccess(client, payload);
          break;
        
        case 'PING':
          this._send(client, 'PONG', { timestamp: Date.now() });
          break;
        
        default:
          console.log(`[WS] Unknown message type: ${type}`);
      }
      
    } catch (error) {
      console.error('[WS] Message handling error:', error);
      this._send(client, 'ERROR', {
        code: 'INVALID_MESSAGE',
        message: error.message
      });
    }
  }

  async _handlePlayerJoin(client, data) {
    const { playerId } = data;
    
    if (!playerId) {
      this._send(client, 'ERROR', { code: 'INVALID_PLAYER', message: 'Player ID required' });
      return;
    }
    
    client.playerId = playerId;
    gameService.joinGame(playerId);
    
    const state = await userService.getPlayerState(playerId);
    
    this._send(client, 'PLAYER_STATE', state);
    
    console.log(`[WS] Player joined: ${playerId}`);
  }

  async _handleLevelStart(client, data) {
    const { levelId } = data;
    const playerId = client.playerId;
    
    if (!playerId) {
      this._send(client, 'ERROR', { code: 'NOT_AUTHENTICATED', message: 'Player not joined' });
      return;
    }
    
    const result = await gameService.startLevel(playerId, levelId);
    
    if (!result.success) {
      this._send(client, 'ERROR', { code: 'LEVEL_START_FAILED', message: result.error });
      return;
    }
    
    this._send(client, 'LEVEL_DATA', result.levelData);
  }

  async _handleLinkSuccess(client, data) {
    const { fromNode, toNode, latency, levelId } = data;
    const playerId = client.playerId;
    
    if (!playerId) {
      this._send(client, 'ERROR', { code: 'NOT_AUTHENTICATED', message: 'Player not joined' });
      return;
    }
    
    const result = await gameService.processLink(playerId, fromNode, toNode, latency);
    
    if (!result.success) {
      this._send(client, 'ERROR', { code: 'LINK_FAILED', message: result.error });
      return;
    }
    
    this._send(client, 'LINK_RESULT', {
      success: true,
      reward: result.reward,
      isTarget: result.isTarget,
      targetProgress: result.targetProgress,
      totalTargets: result.totalTargets
    });
    
    if (result.levelComplete && result.completeResult) {
      this._send(client, 'LEVEL_COMPLETE', result.completeResult);
    }
    
    const state = await userService.getPlayerState(playerId);
    this._send(client, 'PLAYER_STATE', state);
  }

  _send(client, type, data = {}) {
    if (client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({ type, data }));
    }
  }

  broadcast(type, data = {}) {
    const message = JSON.stringify({ type, data });
    this.clients.forEach(client => {
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      }
    });
  }

  getClientCount() {
    return this.clients.size;
  }
}

export let wsGateway = null;

export function initWebSocket(server) {
  wsGateway = new WebSocketGateway(server);
  return wsGateway;
}

export default WebSocketGateway;
