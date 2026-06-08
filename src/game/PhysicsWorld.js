import Matter from 'matter-js';
import { gameState, NodeState } from './GameState.js';

const { Engine, World, Bodies, Body, Composite, Events, Mouse, MouseConstraint, Constraint } = Matter;

const MAX_VELOCITY = 15;
const MAX_POSITION_OFFSET = 2000;
const WALL_THICKNESS = 100;
const CONSTRAINT_MAX_LENGTH_RATIO = 5;

export class PhysicsWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = Engine.create();
    this.world = this.engine.world;
    
    this.world.gravity.y = 0;
    
    this.nodeBodies = new Map();
    this.constraints = [];
    this.walls = [];
    this.isWorldBroken = false;
    
    this.bounds = {
      width: canvas.width,
      height: canvas.height
    };
    
    this._setupMouse();
    this._setupEvents();
    this._createWalls();
  }

  _setupMouse() {
    this.mouse = Mouse.create(this.canvas);
    
    const originalSetPosition = this.mouse.setPosition;
    this.mouse.setPosition = (position) => {
      const clampedPos = this._clampMousePosition(position);
      return originalSetPosition.call(this.mouse, clampedPos);
    };
    
    this.mouseConstraint = MouseConstraint.create(this.engine, {
      mouse: this.mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
        length: 0
      }
    });
    
    this.mouseConstraint.collisionFilter = {
      category: 0x0001,
      mask: 0xFFFFFFFF
    };
    
    World.add(this.world, this.mouseConstraint);
  }

  _clampMousePosition(position) {
    const padding = 20;
    return {
      x: Math.max(padding, Math.min(this.bounds.width - padding, position.x)),
      y: Math.max(padding, Math.min(this.bounds.height - padding, position.y))
    };
  }

  _setupEvents() {
    Events.on(this.engine, 'beforeUpdate', () => {
      this._beforeUpdate();
    });
    
    Events.on(this.engine, 'afterUpdate', () => {
      this._afterUpdate();
    });
  }

  _beforeUpdate() {
    if (this.isWorldBroken) {
      this._repairWorld();
      return;
    }
    
    this._constrainNodes();
    this._limitVelocities();
    this._clampConstraintLengths();
  }

  _afterUpdate() {
    this._sanityCheck();
  }

  _createWalls() {
    const { width, height } = this.bounds;
    const t = WALL_THICKNESS;
    
    const wallOptions = {
      isStatic: true,
      restitution: 0.5,
      friction: 0.1,
      collisionFilter: {
        category: 0x0002,
        mask: 0x0001
      }
    };
    
    const topWall = Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, wallOptions);
    const bottomWall = Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, wallOptions);
    const leftWall = Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, wallOptions);
    const rightWall = Bodies.rectangle(width + t / 2, height / 2, t, height + t * 2, wallOptions);
    
    this.walls = [topWall, bottomWall, leftWall, rightWall];
    World.add(this.world, this.walls);
  }

  _updateWalls() {
    const { width, height } = this.bounds;
    const t = WALL_THICKNESS;
    
    if (this.walls.length >= 4) {
      Body.setPosition(this.walls[0], { x: width / 2, y: -t / 2 });
      Body.setPosition(this.walls[1], { x: width / 2, y: height + t / 2 });
      Body.setPosition(this.walls[2], { x: -t / 2, y: height / 2 });
      Body.setPosition(this.walls[3], { x: width + t / 2, y: height / 2 });
    }
  }

  _constrainNodes() {
    const { width, height } = this.bounds;
    const padding = 30;
    
    this.nodeBodies.forEach((body, nodeId) => {
      if (body.isStatic) return;
      
      const radius = body.circleRadius || 20;
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      let px = body.position.x;
      let py = body.position.y;
      
      if (px < padding + radius) {
        px = padding + radius;
        vx = Math.abs(vx);
      }
      if (px > width - padding - radius) {
        px = width - padding - radius;
        vx = -Math.abs(vx);
      }
      if (py < padding + radius) {
        py = padding + radius;
        vy = Math.abs(vy);
      }
      if (py > height - padding - radius) {
        py = height - padding - radius;
        vy = -Math.abs(vy);
      }
      
      if (px !== body.position.x || py !== body.position.y) {
        Body.setPosition(body, { x: px, y: py });
      }
      if (vx !== body.velocity.x || vy !== body.velocity.y) {
        Body.setVelocity(body, { x: vx, y: vy });
      }
    });
  }

  _limitVelocities() {
    this.nodeBodies.forEach(body => {
      if (body.isStatic) return;
      
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      
      if (speed > MAX_VELOCITY) {
        const ratio = MAX_VELOCITY / speed;
        Body.setVelocity(body, {
          x: body.velocity.x * ratio,
          y: body.velocity.y * ratio
        });
      }
      
      if (body.angularVelocity > 0.1) {
        Body.setAngularVelocity(body, 0.1);
      } else if (body.angularVelocity < -0.1) {
        Body.setAngularVelocity(body, -0.1);
      }
    });
  }

  _clampConstraintLengths() {
    this.constraints.forEach(({ constraint, from, to }) => {
      if (!constraint.bodyA || !constraint.bodyB) return;
      
      const bodyA = constraint.bodyA;
      const bodyB = constraint.bodyB;
      
      const dx = bodyB.position.x - bodyA.position.x;
      const dy = bodyB.position.y - bodyA.position.y;
      const currentLength = Math.sqrt(dx * dx + dy * dy);
      
      const maxLength = constraint.length * CONSTRAINT_MAX_LENGTH_RATIO;
      
      if (currentLength > maxLength && currentLength > 0) {
        const ratio = maxLength / currentLength;
        const midX = (bodyA.position.x + bodyB.position.x) / 2;
        const midY = (bodyA.position.y + bodyB.position.y) / 2;
        
        const halfDx = (dx / 2) * ratio;
        const halfDy = (dy / 2) * ratio;
        
        if (!bodyA.isStatic) {
          Body.setPosition(bodyA, {
            x: midX - halfDx,
            y: midY - halfDy
          });
        }
        if (!bodyB.isStatic) {
          Body.setPosition(bodyB, {
            x: midX + halfDx,
            y: midY + halfDy
          });
        }
        
        const damping = 0.5;
        if (!bodyA.isStatic) {
          Body.setVelocity(bodyA, {
            x: bodyA.velocity.x * damping,
            y: bodyA.velocity.y * damping
          });
        }
        if (!bodyB.isStatic) {
          Body.setVelocity(bodyB, {
            x: bodyB.velocity.x * damping,
            y: bodyB.velocity.y * damping
          });
        }
      }
    });
  }

  _sanityCheck() {
    let hasNaN = false;
    
    this.nodeBodies.forEach((body, nodeId) => {
      if (this._isNaNOrInf(body.position.x) ||
          this._isNaNOrInf(body.position.y) ||
          this._isNaNOrInf(body.velocity.x) ||
          this._isNaNOrInf(body.velocity.y) ||
          Math.abs(body.position.x) > MAX_POSITION_OFFSET ||
          Math.abs(body.position.y) > MAX_POSITION_OFFSET) {
        hasNaN = true;
        console.warn(`[Physics] Sanity check failed for body ${nodeId}, repairing...`);
      }
    });
    
    if (hasNaN) {
      this.isWorldBroken = true;
    }
  }

  _isNaNOrInf(value) {
    return typeof value !== 'number' || isNaN(value) || !isFinite(value);
  }

  _repairWorld() {
    console.warn('[Physics] Repairing physics world...');
    
    this.nodeBodies.forEach((body, nodeId) => {
      const nodeData = gameState.nodes.get(nodeId);
      const radius = body.circleRadius || 25;
      
      let x, y;
      
      if (nodeData) {
        x = nodeData.x * this.bounds.width;
        y = nodeData.y * this.bounds.height;
      } else {
        x = this.bounds.width / 2;
        y = this.bounds.height / 2;
      }
      
      x = Math.max(radius + 30, Math.min(this.bounds.width - radius - 30, x));
      y = Math.max(radius + 30, Math.min(this.bounds.height - radius - 30, y));
      
      Body.setPosition(body, { x, y });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      Body.setAngle(body, 0);
    });
    
    Engine.clear(this.engine);
    
    this.isWorldBroken = false;
    console.log('[Physics] World repaired successfully');
  }

  createNodes(levelData) {
    this.clearNodes();
    
    const { width, height } = this.bounds;
    
    levelData.nodes.forEach(nodeConfig => {
      const x = nodeConfig.x * width;
      const y = nodeConfig.y * height;
      const radius = nodeConfig.radius;
      
      const body = Bodies.circle(x, y, radius, {
        restitution: 0.6,
        friction: 0.01,
        frictionAir: 0.05,
        density: 0.002,
        isStatic: nodeConfig.type === 'source',
        collisionFilter: {
          category: 0x0001,
          mask: 0x0003
        }
      });
      
      body.label = nodeConfig.id;
      body.nodeType = nodeConfig.type;
      
      this.nodeBodies.set(nodeConfig.id, body);
      World.add(this.world, body);
      
      const node = gameState.nodes.get(nodeConfig.id);
      if (node) {
        node.body = body;
      }
    });
    
    this._addSpringConstraints();
    
    this.isWorldBroken = false;
  }

  _addSpringConstraints() {
    const nodeIds = Array.from(this.nodeBodies.keys());
    
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const bodyA = this.nodeBodies.get(nodeIds[i]);
        const bodyB = this.nodeBodies.get(nodeIds[j]);
        
        const dx = bodyA.position.x - bodyB.position.x;
        const dy = bodyA.position.y - bodyB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 300 && distance > 10) {
          const constraint = Constraint.create({
            bodyA: bodyA,
            bodyB: bodyB,
            stiffness: 0.015,
            damping: 0.1,
            length: distance
          });
          
          this.constraints.push({
            constraint,
            from: nodeIds[i],
            to: nodeIds[j],
            visible: false
          });
          
          World.add(this.world, constraint);
        }
      }
    }
  }

  clearNodes() {
    this.nodeBodies.forEach(body => {
      World.remove(this.world, body);
    });
    this.nodeBodies.clear();
    
    this.constraints.forEach(c => {
      World.remove(this.world, c.constraint);
    });
    this.constraints = [];
  }

  getBodyAtPosition(x, y) {
    const clampedX = Math.max(0, Math.min(this.bounds.width, x));
    const clampedY = Math.max(0, Math.min(this.bounds.height, y));
    
    const bodies = Composite.allBodies(this.world);
    for (const body of bodies) {
      if (body.circleRadius && body.label && this.nodeBodies.has(body.label)) {
        const dx = body.position.x - clampedX;
        const dy = body.position.y - clampedY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= body.circleRadius) {
          return body;
        }
      }
    }
    return null;
  }

  getNodePosition(nodeId) {
    const body = this.nodeBodies.get(nodeId);
    if (body) {
      return { x: body.position.x, y: body.position.y };
    }
    return null;
  }

  getNodeBody(nodeId) {
    return this.nodeBodies.get(nodeId);
  }

  applyImpulse(nodeId, x, y) {
    const body = this.nodeBodies.get(nodeId);
    if (body && !body.isStatic) {
      const maxImpulse = 0.01;
      const magnitude = Math.sqrt(x * x + y * y);
      
      if (magnitude > maxImpulse) {
        const ratio = maxImpulse / magnitude;
        x *= ratio;
        y *= ratio;
      }
      
      Body.applyForce(body, body.position, { x, y });
    }
  }

  update(deltaTime) {
    if (this.isWorldBroken) {
      this._repairWorld();
      return;
    }
    
    const clampedDelta = Math.min(deltaTime, 33);
    
    Engine.update(this.engine, clampedDelta);
  }

  resize(width, height) {
    this.bounds.width = width;
    this.bounds.height = height;
    
    this.mouse.canvas = this.canvas;
    this._updateWalls();
    
    this.nodeBodies.forEach((body, nodeId) => {
      const nodeData = gameState.nodes.get(nodeId);
      if (nodeData) {
        const x = nodeData.x * width;
        const y = nodeData.y * height;
        Body.setPosition(body, { x, y });
      }
    });
    
    this.constraints.forEach(c => {
      World.remove(this.world, c.constraint);
    });
    this.constraints = [];
    this._addSpringConstraints();
  }

  getWorld() {
    return this.world;
  }

  getVisibleConstraints() {
    return this.constraints.filter(c => c.visible);
  }
}

export default PhysicsWorld;
