import Matter from 'matter-js';
import { gameState, NodeState } from './GameState.js';

const { Engine, World, Bodies, Body, Composite, Events, Mouse, MouseConstraint, Constraint } = Matter;

export class PhysicsWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = Engine.create();
    this.world = this.engine.world;
    
    this.world.gravity.y = 0;
    
    this.nodeBodies = new Map();
    this.constraints = [];
    
    this.bounds = {
      width: canvas.width,
      height: canvas.height
    };
    
    this._setupMouse();
    this._setupEvents();
  }

  _setupMouse() {
    this.mouse = Mouse.create(this.canvas);
    this.mouseConstraint = MouseConstraint.create(this.engine, {
      mouse: this.mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    });
    
    this.mouseConstraint.collisionFilter = {
      category: 0x0001,
      mask: 0xFFFFFFFF
    };
    
    World.add(this.world, this.mouseConstraint);
  }

  _setupEvents() {
    Events.on(this.engine, 'beforeUpdate', () => {
      this._constrainNodes();
    });
  }

  _constrainNodes() {
    const { width, height } = this.bounds;
    const padding = 50;
    
    this.nodeBodies.forEach(body => {
      if (body.position.x < padding) {
        Body.setVelocity(body, { x: Math.abs(body.velocity.x), y: body.velocity.y });
      }
      if (body.position.x > width - padding) {
        Body.setVelocity(body, { x: -Math.abs(body.velocity.x), y: body.velocity.y });
      }
      if (body.position.y < padding) {
        Body.setVelocity(body, { x: body.velocity.x, y: Math.abs(body.velocity.y) });
      }
      if (body.position.y > height - padding) {
        Body.setVelocity(body, { x: body.velocity.x, y: -Math.abs(body.velocity.y) });
      }
    });
  }

  createNodes(levelData) {
    this.clearNodes();
    
    const { width, height } = this.bounds;
    
    levelData.nodes.forEach(nodeConfig => {
      const x = nodeConfig.x * width;
      const y = nodeConfig.y * height;
      const radius = nodeConfig.radius;
      
      const body = Bodies.circle(x, y, radius, {
        restitution: 0.8,
        friction: 0.01,
        frictionAir: 0.02,
        density: 0.001,
        isStatic: nodeConfig.type === 'source',
        collisionFilter: {
          category: 0x0001,
          mask: 0xFFFFFFFF
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
        
        if (distance < 250) {
          const constraint = Constraint.create({
            bodyA: bodyA,
            bodyB: bodyB,
            stiffness: 0.02,
            damping: 0.05,
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
    const bodies = Composite.allBodies(this.world);
    for (const body of bodies) {
      if (body.circleRadius) {
        const dx = body.position.x - x;
        const dy = body.position.y - y;
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
    if (body) {
      Body.applyForce(body, body.position, { x, y });
    }
  }

  update(deltaTime) {
    Engine.update(this.engine, deltaTime);
  }

  resize(width, height) {
    this.bounds.width = width;
    this.bounds.height = height;
    
    this.mouse.canvas = this.canvas;
  }

  getWorld() {
    return this.world;
  }

  getVisibleConstraints() {
    return this.constraints.filter(c => c.visible);
  }
}

export default PhysicsWorld;
