const LINK_COLORS = {
  active: {
    main: '#ff0040',
    glow: 'rgba(255, 0, 64, 0.6)',
    particle: '#ff6680'
  },
  preview: {
    main: '#ff0040',
    glow: 'rgba(255, 0, 64, 0.4)',
    particle: '#ff6680'
  },
  success: {
    main: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.6)',
    particle: '#66ffaa'
  },
  hack: {
    main: '#00ffff',
    glow: 'rgba(0, 255, 255, 0.6)',
    particle: '#66ffff'
  }
};

export class LinkRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.time = 0;
    this.particles = [];
  }

  update(deltaTime) {
    this.time += deltaTime;
    
    this.particles = this.particles.filter(p => {
      p.progress += deltaTime * 0.001 * p.speed;
      return p.progress < 1;
    });
  }

  drawLink(fromPos, toPos, type = 'active', latency = 0) {
    const ctx = this.ctx;
    const colors = LINK_COLORS[type] || LINK_COLORS.active;
    
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1) return;
    
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 8;
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 15;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    this._drawDataFlow(fromPos, toPos, colors);
    
    if (latency > 0) {
      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;
      
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.main;
      ctx.shadowColor = colors.main;
      ctx.shadowBlur = 5;
      ctx.fillText(`${Math.round(latency)}ms`, midX, midY - 10);
      ctx.shadowBlur = 0;
    }
  }

  _drawDataFlow(fromPos, toPos, colors) {
    const ctx = this.ctx;
    const time = this.time * 0.002;
    
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    for (let i = 0; i < 3; i++) {
      const progress = ((time + i * 0.33) % 1);
      const px = fromPos.x + unitX * distance * progress;
      const py = fromPos.y + unitY * distance * progress;
      
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
      gradient.addColorStop(0, colors.particle);
      gradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  drawPreview(fromPos, toPos, valid = true) {
    const ctx = this.ctx;
    const color = valid ? LINK_COLORS.preview : { main: '#666666', glow: 'rgba(100, 100, 100, 0.3)' };
    
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1) return;
    
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    
    const segments = 10;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = fromPos.x + dx * t;
      const y = fromPos.y + dy * t;
      
      const jitter = valid ? Math.sin(t * 10 + this.time * 0.01) * 3 : 0;
      
      if (i === 1) {
        ctx.moveTo(x + jitter, y);
      } else {
        ctx.lineTo(x + jitter, y);
      }
    }
    
    ctx.strokeStyle = color.main;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.shadowColor = color.main;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  drawAll(links, physics) {
    links.forEach(link => {
      const fromBody = physics.getNodeBody(link.from);
      const toBody = physics.getNodeBody(link.to);
      
      if (fromBody && toBody) {
        this.drawLink(
          { x: fromBody.position.x, y: fromBody.position.y },
          { x: toBody.position.x, y: toBody.position.y },
          'hack',
          link.latency
        );
      }
    });
  }

  addBurstEffect(fromPos, toPos) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      this.particles.push({
        x: toPos.x,
        y: toPos.y,
        vx: Math.cos(angle) * (50 + Math.random() * 50),
        vy: Math.sin(angle) * (50 + Math.random() * 50),
        life: 1,
        color: '#00ff88'
      });
    }
  }
}

export default LinkRenderer;
