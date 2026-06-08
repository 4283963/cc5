import { PhysicsWorld } from './PhysicsWorld.js';
import { NodeRenderer } from './NodeRenderer.js';
import { LinkRenderer } from './LinkRenderer.js';
import { gameState, GamePhase } from './GameState.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.physics = new PhysicsWorld(canvas);
    this.nodeRenderer = new NodeRenderer(this.ctx);
    this.linkRenderer = new LinkRenderer(this.ctx);
    
    this.running = false;
    this.lastTime = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTime = 0;
    
    this.isDragging = false;
    this.dragStartNode = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.dragEndPos = { x: 0, y: 0 };
    this.hoveredNode = null;
    
    this._setupInput();
    this._setupGameEvents();
    this._resizeCanvas();
    
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    
    this.ctx.scale(dpr, dpr);
    
    this.viewWidth = container.clientWidth;
    this.viewHeight = container.clientHeight;
    
    if (this.physics) {
      this.physics.resize(container.clientWidth, container.clientHeight);
    }
  }

  _setupInput() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this._onMouseUp(e));
    
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onMouseUp({});
    });
  }

  _getCanvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  _onMouseDown(e) {
    if (gameState.phase !== GamePhase.PLAYING) return;
    
    const pos = this._getCanvasPos(e.clientX, e.clientY);
    const body = this.physics.getBodyAtPosition(pos.x, pos.y);
    
    if (body && gameState.hackedNodes.has(body.label)) {
      this.isDragging = true;
      this.dragStartNode = body.label;
      this.dragStartPos = { x: body.position.x, y: body.position.y };
      this.dragEndPos = { ...pos };
      this.canvas.style.cursor = 'grabbing';
    }
  }

  _onMouseMove(e) {
    const pos = this._getCanvasPos(e.clientX, e.clientY);
    this.dragEndPos = { ...pos };
    
    const body = this.physics.getBodyAtPosition(pos.x, pos.y);
    
    if (body) {
      this.hoveredNode = body.label;
      this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'pointer';
    } else {
      this.hoveredNode = null;
      this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'crosshair';
    }
  }

  _onMouseUp(e) {
    if (!this.isDragging) return;
    
    const pos = this._getCanvasPos(e.clientX || this.dragEndPos.x, e.clientY || this.dragEndPos.y);
    const targetBody = this.physics.getBodyAtPosition(pos.x, pos.y);
    
    if (targetBody && targetBody.label !== this.dragStartNode) {
      this._tryCreateLink(this.dragStartNode, targetBody.label);
    }
    
    this.isDragging = false;
    this.dragStartNode = null;
    this.canvas.style.cursor = 'crosshair';
  }

  _tryCreateLink(fromNode, toNode) {
    if (!gameState.isNodeHackable(toNode)) {
      return;
    }
    
    const fromBody = this.physics.getNodeBody(fromNode);
    const toBody = this.physics.getNodeBody(toNode);
    
    if (!fromBody || !toBody) return;
    
    const dx = toBody.position.x - fromBody.position.x;
    const dy = toBody.position.y - fromBody.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const latency = this._calculateLatency(distance, 1);
    
    gameState.addLink(fromNode, toNode, latency);
    
    const impulseStrength = 0.005;
    this.physics.applyImpulse(toNode, dx * impulseStrength, dy * impulseStrength);
    this.physics.applyImpulse(fromNode, -dx * impulseStrength * 0.5, -dy * impulseStrength * 0.5);
    
    this.linkRenderer.addBurstEffect(
      { x: fromBody.position.x, y: fromBody.position.y },
      { x: toBody.position.x, y: toBody.position.y }
    );
    
    gameState.emit('linkCreated', { from: fromNode, to: toNode, latency });
  }

  _calculateLatency(distance, hopCount) {
    const baseLatency = 20;
    const speedFactor = 3;
    const hopPenalty = 15;
    
    return baseLatency + (distance / speedFactor) + (hopCount * hopPenalty);
  }

  _setupGameEvents() {
    gameState.on('levelLoaded', (levelData) => {
      this._loadLevel(levelData);
    });
    
    gameState.on('levelComplete', (result) => {
      gameState.phase = GamePhase.LEVEL_COMPLETE;
    });
    
    gameState.on('levelReset', () => {
      gameState.phase = GamePhase.PLAYING;
    });
  }

  _loadLevel(levelData) {
    this.physics.createNodes(levelData);
    gameState.phase = GamePhase.PLAYING;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._loop();
  }

  stop() {
    this.running = false;
  }

  _loop() {
    if (!this.running) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    this.frameCount++;
    this.fpsTime += deltaTime;
    if (this.fpsTime >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
      gameState.emit('fpsUpdate', this.fps);
    }
    
    this.update(deltaTime);
    this.render();
    
    requestAnimationFrame(() => this._loop());
  }

  update(deltaTime) {
    if (gameState.phase === GamePhase.PLAYING) {
      this.physics.update(deltaTime);
    }
    
    this.nodeRenderer.update(deltaTime);
    this.linkRenderer.update(deltaTime);
  }

  render() {
    const ctx = this.ctx;
    const { width, height } = this;
    
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    
    if (gameState.phase === GamePhase.MENU) {
      return;
    }
    
    this._drawBackground();
    this._drawGrid();
    this.linkRenderer.drawAll(gameState.links, this.physics);
    
    if (this.isDragging && this.dragStartNode) {
      const startBody = this.physics.getNodeBody(this.dragStartNode);
      if (startBody) {
        const targetValid = this.hoveredNode && 
          this.hoveredNode !== this.dragStartNode &&
          gameState.isNodeHackable(this.hoveredNode);
        
        this.linkRenderer.drawPreview(
          { x: startBody.position.x, y: startBody.position.y },
          this.dragEndPos,
          targetValid
        );
      }
    }
    
    this.nodeRenderer.drawAll(gameState.nodes, this.physics);
    this._drawAmbientParticles();
  }

  _drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.viewWidth / 2, this.viewHeight / 2, 0,
      this.viewWidth / 2, this.viewHeight / 2, Math.max(this.viewWidth, this.viewHeight) * 0.7
    );
    gradient.addColorStop(0, '#0f0f1a');
    gradient.addColorStop(1, '#050508');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  _drawGrid() {
    const ctx = this.ctx;
    const gridSize = 50;
    
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= this.viewWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.viewHeight);
      ctx.stroke();
    }
    
    for (let y = 0; y <= this.viewHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.viewWidth, y);
      ctx.stroke();
    }
  }

  _drawAmbientParticles() {
    const ctx = this.ctx;
    const time = performance.now() * 0.0001;
    
    for (let i = 0; i < 30; i++) {
      const seed = i * 0.123;
      const x = ((Math.sin(time + seed) * 0.5 + 0.5) * this.viewWidth + i * 37) % this.viewWidth;
      const y = ((Math.cos(time * 0.7 + seed * 2) * 0.5 + 0.5) * this.viewHeight + i * 23) % this.viewHeight;
      const size = 1 + Math.sin(time * 3 + i) * 0.5;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 255, ${0.2 + Math.sin(time + i) * 0.1})`;
      ctx.fill();
    }
  }

  getPhysics() {
    return this.physics;
  }
}

export default GameEngine;
