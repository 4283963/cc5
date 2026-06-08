import { NodeState } from './GameState.js';

const NODE_COLORS = {
  source: {
    base: '#00ffff',
    glow: 'rgba(0, 255, 255, 0.4)',
    inner: '#004444'
  },
  target: {
    base: '#ff0040',
    glow: 'rgba(255, 0, 64, 0.4)',
    inner: '#440011'
  },
  relay: {
    base: '#9d00ff',
    glow: 'rgba(157, 0, 255, 0.3)',
    inner: '#220033'
  },
  firewall: {
    base: '#ff6600',
    glow: 'rgba(255, 102, 0, 0.4)',
    inner: '#331100'
  },
  database: {
    base: '#ffff00',
    glow: 'rgba(255, 255, 0, 0.3)',
    inner: '#333300'
  },
  hacked: {
    base: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.5)',
    inner: '#003322'
  }
};

export class NodeRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.time = 0;
  }

  update(deltaTime) {
    this.time += deltaTime;
  }

  drawNode(nodeData, body) {
    const { ctx, time } = this;
    const { x, y } = body.position;
    const radius = body.circleRadius || 25;
    
    const isHacked = nodeData.state === NodeState.HACKED;
    const typeKey = isHacked ? 'hacked' : nodeData.type;
    const colors = NODE_COLORS[typeKey] || NODE_COLORS.relay;
    
    const pulseScale = 1 + Math.sin(time * 0.003) * 0.05;
    const glowRadius = radius * pulseScale * 2;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    const innerGradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    innerGradient.addColorStop(0, colors.inner);
    innerGradient.addColorStop(0.7, colors.base + '40');
    innerGradient.addColorStop(1, colors.base + '10');
    
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = innerGradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = colors.base;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.base;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    this._drawScanLine(x, y, radius * 0.85, time, colors.base);
    this._drawRingPulse(x, y, radius, time, colors.base);
    
    if (nodeData.label) {
      ctx.font = 'bold 11px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.base;
      ctx.shadowColor = colors.base;
      ctx.shadowBlur = 5;
      ctx.fillText(nodeData.label, x, y);
      ctx.shadowBlur = 0;
    }
    
    if (isHacked && nodeData.type === 'target') {
      this._drawSuccessEffect(x, y, radius, time);
    }
    
    if (nodeData.state === NodeState.HACKING) {
      this._drawHackingEffect(x, y, radius, time);
    }
  }

  _drawScanLine(x, y, radius, time, color) {
    const ctx = this.ctx;
    const scanY = y + Math.sin(time * 0.002) * radius * 0.8;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2);
    ctx.clip();
    
    const gradient = ctx.createLinearGradient(x, scanY - 10, x, scanY + 10);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, color + '40');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, scanY - 10, radius * 2, 20);
    ctx.restore();
  }

  _drawRingPulse(x, y, radius, time, color) {
    const ctx = this.ctx;
    const phase = (time * 0.001) % 1;
    const ringRadius = radius + phase * 20;
    const alpha = 1 - phase;
    
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = color + Math.floor(alpha * 80).toString(16).padStart(2, '0');
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _drawSuccessEffect(x, y, radius, time) {
    const ctx = this.ctx;
    
    for (let i = 0; i < 3; i++) {
      const angle = (time * 0.002 + i * Math.PI * 2 / 3) % (Math.PI * 2);
      const dist = radius * 0.6;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawHackingEffect(x, y, radius, time) {
    const ctx = this.ctx;
    const progress = (time * 0.003) % 1;
    
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawAll(nodes, physics) {
    nodes.forEach((nodeData, nodeId) => {
      const body = physics.getNodeBody(nodeId);
      if (body) {
        this.drawNode(nodeData, body);
      }
    });
  }
}

export default NodeRenderer;
