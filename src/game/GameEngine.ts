export type Role = 'none' | 'past' | 'future';

export interface GameUIState {
  timeLeft: number;
  p1Role: Role;
  p2Role: Role;
  isNearingSwap: boolean;
  isSwapping: boolean;
}

const CONSTANTS = {
  GRAVITY: 0.5,
  MAX_FALL: 12,
  PAST_SPEED: 3,
  PAST_JUMP: -9,
  FUTURE_SPEED: 4.5,
  FUTURE_JUMP: -10,
  CANVAS_WIDTH: 1000,
  CANVAS_HEIGHT: 500,
  SWAP_TIME: 20.0,
};

// Simple AABB Collision
function aabb(a: any, b: any) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class Keyboard {
  keys: { [key: string]: boolean } = {};
  pressedThisFrame: { [key: string]: boolean } = {};
  private _justPressed: { [key: string]: boolean } = {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      this._justPressed[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
  }

  update() {
    this.pressedThisFrame = { ...this._justPressed };
    this._justPressed = {};
  }

  isDown(key: string) {
    return !!this.keys[key];
  }

  isJustPressed(key: string) {
    return !!this.pressedThisFrame[key];
  }
}

class Entity {
  x: number; y: number; w: number; h: number;
  vx: number = 0; vy: number = 0;
  grounded: boolean = false;
  facingRight: boolean = true;
  animTime: number = 0;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }

  move(walls: any[]) {
    // X axis
    this.x += this.vx;
    if (this.vx > 0) this.facingRight = true;
    if (this.vx < 0) this.facingRight = false;
    this.animTime += Math.abs(this.vx) * 0.1;

    for (let w of walls) {
      if (!w.solid) continue;
      if (aabb(this, w)) {
        if (this.vx > 0) this.x = w.x - this.w;
        else if (this.vx < 0) this.x = w.x + w.w;
        this.vx = 0;
      }
    }

    // Y axis
    this.y += this.vy;
    this.grounded = false;
    for (let w of walls) {
      if (!w.solid) continue;
      if (aabb(this, w)) {
        if (this.vy > 0) {
          this.y = w.y - this.h;
          this.grounded = true;
        } else if (this.vy < 0) {
          this.y = w.y + w.h;
        }
        this.vy = 0;
      }
    }
  }
}

interface SpriteConfig {
  base: string;
  runPrefix: string;
  runWestStr: string;
  jumpPrefix: string;
  jumpFrames: number;
}

class CharacterSprite {
  idleEast: HTMLImageElement;
  idleWest: HTMLImageElement;
  runEast: HTMLImageElement[] = [];
  runWest: HTMLImageElement[] = [];
  jumpEast: HTMLImageElement[] = [];

  constructor(config: SpriteConfig) {
      const { base, runPrefix, runWestStr, jumpPrefix, jumpFrames } = config;
      this.idleEast = new Image(); this.idleEast.src = base + 'rotations/east.png';
      this.idleWest = new Image(); this.idleWest.src = base + 'rotations/west.png';
      for(let i=0; i<8; i++) {
          const imgE = new Image(); imgE.src = base + `${runPrefix}east/frame_00${i}.png`; this.runEast.push(imgE);
          const imgW = new Image(); imgW.src = base + `${runPrefix}${runWestStr}/frame_00${i}.png`; this.runWest.push(imgW);
      }
      for(let i=0; i<jumpFrames; i++) {
          const imgE = new Image(); imgE.src = base + `${jumpPrefix}east/frame_00${i}.png`; this.jumpEast.push(imgE);
      }
  }

  draw(ctx: CanvasRenderingContext2D, p: Entity, time: number) {
      const isMoving = Math.abs(p.vx) > 0.1;
      const isJumping = !p.grounded;
      const fps = 12;
      let img: HTMLImageElement | null = null;
      let scaleX = 1;

      if (isJumping) {
          const frame = Math.floor(time * fps) % this.jumpEast.length;
          img = this.jumpEast[frame] || this.jumpEast[0];
          if (!p.facingRight) scaleX = -1;
      } else if (isMoving) {
          const frame = Math.floor(time * fps) % 8;
          img = p.facingRight ? this.runEast[frame] : this.runWest[frame];
      } else {
          img = p.facingRight ? this.idleEast : this.idleWest;
      }

      if (!img || !img.complete) {
          ctx.fillStyle = '#6e767a';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          return;
      }

      ctx.save();
      ctx.translate(p.x + p.w * 0.5, p.y + p.h * 0.5);
      if (scaleX === -1) ctx.scale(-1, 1);
      
      const drawW = 104;
      const drawH = 104;
      // We position the character so its feet logically touch the bottom of the 40x40 bounding box.
      // 0,0 is the center of the bounding box (20 from the bottom).
      ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
      ctx.restore();
  }
}

const pastSprite = new CharacterSprite({
  base: '/assets/thepast-character/mt_ngi_th_dn_thi/',
  runPrefix: 'animations/Running-f52097fe/',
  runWestStr: 'west-70f0c2d9',
  jumpPrefix: 'animations/Two-Footed_Jump-69c0519f/',
  jumpFrames: 7
});
const futureSprite = new CharacterSprite({
  base: '/assets/thefuture-character/mt_con_ngi_n/',
  runPrefix: 'animations/Running-396439f2/',
  runWestStr: 'west',
  jumpPrefix: 'animations/Jumping-aa0aca8c/',
  jumpFrames: 8
});

class Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  constructor(x: number, y: number, color: string, vx?: number, vy?: number) {
    this.x = x; this.y = y;
    this.vx = vx ?? (Math.random() - 0.5) * 150;
    this.vy = vy ?? (Math.random() - 0.5) * 150;
    this.maxLife = 0.2 + Math.random() * 0.3;
    this.life = this.maxLife;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1.0;
  }
}

class SoundManager {
  ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  jump() {
    this.playTone(300, 'square', 0.2, 0.05);
  }

  doubleJump() {
    this.playTone(500, 'sawtooth', 0.15, 0.05);
    setTimeout(() => this.playTone(700, 'sawtooth', 0.2, 0.05), 50);
  }

  pickup() {
    this.playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(1000, 'sine', 0.3, 0.1), 200);
  }

  swap() {
    this.playTone(400, 'sine', 0.5, 0.1);
    setTimeout(() => this.playTone(200, 'sine', 0.5, 0.1), 100);
  }
  win() {
    this.playTone(400, 'sine', 0.2, 0.1);
    setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 200);
    setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 400);
  }
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderCanvas: HTMLCanvasElement;
  renderCtx: CanvasRenderingContext2D;
  running: boolean = false;
  lastTime: number = 0;
  globalTime: number = 0;
  
  keyboard = new Keyboard();
  sound = new SoundManager();
  
  // Game State
  timeLeft = CONSTANTS.SWAP_TIME;
  p1ControlsPast = true;
  swapFlash = 0;
  isGameWon = false;

  // Level State Flags
  flags = {
    seedPlanted: false,
    batteryInRift: false,
    pastHasBattery: false,
    futureHasBattery: false,
    pastButtonDown: false,
    doorOpen: false,
  };

  pastPlayer: Entity;
  futurePlayer: Entity;
  futureDoubleJumped = false;

  // Level data
  pastWalls: any[] = [];
  futureWalls: any[] = [];

  pastParticles: Particle[] = [];
  futureParticles: Particle[] = [];

  emitPastParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
        this.pastParticles.push(new Particle(x, y, color));
    }
  }

  emitFutureParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
        this.futureParticles.push(new Particle(x, y, color));
    }
  }

  onUIUpdate?: (state: GameUIState) => void;

  levelId: number;

  portalImage: HTMLImageElement;
  batteryImage: HTMLImageElement;
  pastBgImage: HTMLImageElement;
  treeImage: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement, levelId: number = 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    
    this.renderCanvas = document.createElement('canvas');
    this.renderCanvas.width = this.canvas.width / 2.5; // pixelation factor
    this.renderCanvas.height = this.canvas.height / 2.5;
    this.renderCtx = this.renderCanvas.getContext('2d')!;
    this.renderCtx.imageSmoothingEnabled = false;

    this.portalImage = new Image();
    this.portalImage.src = '/portal.png';

    this.batteryImage = new Image();
    this.batteryImage.src = '/battery.png';

    this.pastBgImage = new Image();
    this.pastBgImage.src = '/pastbg.png';

    this.treeImage = new Image();
    this.treeImage.src = '/tree.png';

    this.levelId = levelId;
    
    // Players init
    this.pastPlayer = new Entity(50, 400, 40, 40);
    this.futurePlayer = new Entity(50, 400, 24, 48);

    this.initLevel();
  }

  initLevel() {
    this.pastParticles = [];
    this.futureParticles = [];
    this.flags = {
        seedPlanted: false,
        batteryInRift: false,
        pastHasBattery: false,
        futureHasBattery: false,
        pastButtonDown: false,
        doorOpen: false,
    };
    this.pastPlayer = new Entity(50, 400, 40, 40);
    this.futurePlayer = new Entity(50, 400, 24, 48);
    this.timeLeft = CONSTANTS.SWAP_TIME;
    this.isGameWon = false;

    if (this.levelId === 2) {
      this.pastWalls = [
        { x: 0, y: 450, w: 2000, h: 50, solid: true, color: '#6B4A34', type: 'dirt' },
        { x: -50, y: 0, w: 50, h: 500, solid: true, color: '#4A3222', type: 'stone' },
        { x: 300, y: 350, w: 200, h: 20, solid: true, color: '#5C4033', type: 'rockPlat' },
        { x: 900, y: 150, w: 50, h: 300, solid: true, color: '#444', type: 'stoneDoor' },
      ];
      this.futureWalls = [
        { x: 0, y: 450, w: 300, h: 50, solid: true, color: '#1B1B2F', outline: '#E94560', type: 'metal' },
        { x: 500, y: 450, w: 1500, h: 50, solid: true, color: '#1B1B2F', outline: '#E94560', type: 'metal' }, // Gap from 300 to 500
        { x: -50, y: 0, w: 50, h: 500, solid: true, color: '#1B1B2F', type: 'metal' },
        { x: 300, y: 350, w: 200, h: 20, solid: true, color: '#0F3460', outline: '#00D4FF', type: 'metal' },
        { x: 900, y: 150, w: 50, h: 300, solid: true, color: '#333', outline: '#FF0055', type: 'doorFrame' },
      ];
      return;
    }

    // Past Map (Level 1)
    this.pastWalls = [
      { x: 0, y: 450, w: 2000, h: 50, solid: true, color: '#6B4A34', type: 'dirt' },
      { x: -50, y: 0, w: 50, h: 500, solid: true, color: '#4A3222', type: 'stone' },
      { x: 400, y: 350, w: 100, h: 20, solid: true, color: '#5C4033', type: 'rockPlat' }, // small jump puzzle
      { x: 550, y: 250, w: 100, h: 20, solid: true, color: '#5C4033', type: 'rockPlat' },
      { x: 900, y: 150, w: 50, h: 300, solid: true, color: '#444', type: 'stoneDoor' }, // Big Door
    ];

    // Future Map (Level 1)
    this.futureWalls = [
      { x: 0, y: 450, w: 2000, h: 50, solid: true, color: '#1B1B2F', outline: '#E94560', type: 'metal' },
      { x: -50, y: 0, w: 50, h: 500, solid: true, color: '#1B1B2F', type: 'metal' },
      { x: 300, y: 200, w: 50, h: 250, solid: true, color: '#0F3460', outline: '#00D4FF', type: 'metal' }, // High Wall
      { x: 900, y: 150, w: 50, h: 300, solid: true, color: '#333', outline: '#FF0055', type: 'doorFrame' }, // Big Door
    ];
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  loop(currentTime: number) {
    if (!this.running) return;
    this.keyboard.update(); // Process inputs once per frame
    
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.globalTime += dt;

    // Cap dt to prevent massive jumps on lag
    this.update(Math.min(dt, 0.1));
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number) {
    this.pastParticles.forEach(p => p.update(dt));
    this.pastParticles = this.pastParticles.filter(p => p.life > 0);

    this.futureParticles.forEach(p => p.update(dt));
    this.futureParticles = this.futureParticles.filter(p => p.life > 0);

    if (this.isGameWon) {
        if (Math.random() < 0.1) {
            const colors = ['#FF0', '#F0F', '#0FF', '#0F0', '#F00'];
            const c = colors[Math.floor(Math.random()*colors.length)];
            const cx = this.pastPlayer.x + Math.random()*200 - 100;
            const cy = 200 + Math.random()*150;
            for(let i=0; i<30; i++) {
                const p = new Particle(cx, cy, c, (Math.random()-0.5)*300, (Math.random()-0.5)*300);
                p.maxLife = 1.0 + Math.random();
                p.life = p.maxLife;
                this.pastParticles.push(p);
            }
        }
        if (Math.random() < 0.1) {
            const colors = ['#FF0', '#F0F', '#0FF', '#0F0', '#F00'];
            const c = colors[Math.floor(Math.random()*colors.length)];
            const cx = this.futurePlayer.x + Math.random()*200 - 100;
            const cy = 200 + Math.random()*150;
            for(let i=0; i<30; i++) {
                const p = new Particle(cx, cy, c, (Math.random()-0.5)*300, (Math.random()-0.5)*300);
                p.maxLife = 1.0 + Math.random();
                p.life = p.maxLife;
                this.futureParticles.push(p);
            }
        }
        return;
    }

    // Timer Update
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = CONSTANTS.SWAP_TIME;
      this.p1ControlsPast = !this.p1ControlsPast;
      this.swapFlash = 1.0;
      this.sound.swap();
    }

    if (this.swapFlash > 0) this.swapFlash -= dt * 2;

    this.handleInput();
    this.updatePhysics();
    this.updateInteractions();

    if (this.onUIUpdate) {
      this.onUIUpdate({
        timeLeft: this.timeLeft,
        p1Role: this.p1ControlsPast ? 'past' : 'future',
        p2Role: this.p1ControlsPast ? 'future' : 'past',
        isNearingSwap: this.timeLeft <= 3.0,
        isSwapping: this.swapFlash > 0.5
      });
    }

    // Check Win
    if (this.pastPlayer.x > 950 && this.futurePlayer.x > 950) {
        if (!this.isGameWon) {
            this.isGameWon = true;
            this.sound.win();
        }
    }
  }

  handleInput() {
    // Define input schemes
    const keysP1 = { up: 'w', left: 'a', right: 'd', action: 'e' };
    const keysP2 = { up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter' };

    const pastKeys = this.p1ControlsPast ? keysP1 : keysP2;
    const futureKeys = !this.p1ControlsPast ? keysP1 : keysP2;

    // --- PAST PLAYER CONTROLS ---
    this.pastPlayer.vx = 0;
    let inputActive = false;
    if (this.keyboard.isDown(pastKeys.left)) { this.pastPlayer.vx = -CONSTANTS.PAST_SPEED; inputActive = true; }
    if (this.keyboard.isDown(pastKeys.right)) { this.pastPlayer.vx = CONSTANTS.PAST_SPEED; inputActive = true; }
    if (this.keyboard.isJustPressed(pastKeys.up) && this.pastPlayer.grounded) {
      this.pastPlayer.vy = CONSTANTS.PAST_JUMP;
      this.sound.jump();
      inputActive = true;
    }

    // --- FUTURE PLAYER CONTROLS ---
    this.futurePlayer.vx = 0;
    if (this.keyboard.isDown(futureKeys.left)) { this.futurePlayer.vx = -CONSTANTS.FUTURE_SPEED; inputActive = true; }
    if (this.keyboard.isDown(futureKeys.right)) { this.futurePlayer.vx = CONSTANTS.FUTURE_SPEED; inputActive = true; }
    
    if (this.keyboard.isJustPressed(futureKeys.up)) {
      inputActive = true;
      if (this.futurePlayer.grounded) {
        this.futurePlayer.vy = CONSTANTS.FUTURE_JUMP;
        this.futureDoubleJumped = false;
        this.sound.jump();
      } else if (!this.futureDoubleJumped) {
        this.futurePlayer.vy = CONSTANTS.FUTURE_JUMP;
        this.futureDoubleJumped = true;
        this.sound.doubleJump();
        this.emitFutureParticles(this.futurePlayer.x + this.futurePlayer.w/2, this.futurePlayer.y + this.futurePlayer.h, '#00D4FF', 10);
      }
    }

    if (inputActive || this.keyboard.isJustPressed(pastKeys.action) || this.keyboard.isJustPressed(futureKeys.action)) {
        this.sound.init(); // Initialize audio context on first interaction
    }
  }

  updatePhysics() {
    // Gravity
    this.pastPlayer.vy = Math.min(this.pastPlayer.vy + CONSTANTS.GRAVITY, CONSTANTS.MAX_FALL);
    this.futurePlayer.vy = Math.min(this.futurePlayer.vy + CONSTANTS.GRAVITY, CONSTANTS.MAX_FALL);

    // Dynamic walls for this frame
    let pWalls = [...this.pastWalls];
    let fWalls = [...this.futureWalls];

    if (this.flags.seedPlanted) {
        // Add trees
        fWalls.push({ x: 170, y: 380, w: 100, h: 20, solid: true, type: 'treePlat' });
        fWalls.push({ x: 100, y: 300, w: 100, h: 20, solid: true, type: 'treePlat' });
        fWalls.push({ x: 190, y: 200, w: 100, h: 20, solid: true, type: 'treePlat' });
    }

    if (!this.flags.doorOpen) {
        // Doors are solid unless opened
    } else {
        // Remove door solidness by filtering it out
        pWalls = pWalls.filter(w => w.x !== 900);
        fWalls = fWalls.filter(w => w.x !== 900);
    }

    this.pastPlayer.move(pWalls, (axis, v) => {
        if (axis === 'x' && Math.abs(v) > 0.5) {
            const px = v > 0 ? this.pastPlayer.x + this.pastPlayer.w : this.pastPlayer.x;
            const py = this.pastPlayer.y + this.pastPlayer.h / 2;
            this.emitPastParticles(px, py, '#8a9399', 4);
        } else if (axis === 'y' && v > 5) {
            this.emitPastParticles(this.pastPlayer.x + this.pastPlayer.w / 2, this.pastPlayer.y + this.pastPlayer.h, '#6B4A34', 8);
        }
    });

    this.futurePlayer.move(fWalls, (axis, v) => {
        if (axis === 'y' && v > 5) {
            this.emitFutureParticles(this.futurePlayer.x + this.futurePlayer.w / 2, this.futurePlayer.y + this.futurePlayer.h, '#E94560', 6);
        }
    });

    // Acid Pool Logic (Future)
    const acidY = this.flags.pastButtonDown ? 500 : 440; // lower acid if button pressed
    const acidZone = { x: 550, y: acidY, w: 250, h: 100 };
    if (aabb(this.futurePlayer, acidZone)) {
        // Hurt/Respawn future player
        this.futurePlayer.x = 450;
        this.futurePlayer.y = 350;
    }
  }

  updateInteractions() {
    const keysP1 = { action: 'e' };
    const keysP2 = { action: 'Enter' };
    const pastAction = this.p1ControlsPast ? keysP1.action : keysP2.action;
    const futureAction = !this.p1ControlsPast ? keysP1.action : keysP2.action;

    const isPastActionPressed = this.keyboard.isJustPressed(pastAction);
    const isFutureActionPressed = this.keyboard.isJustPressed(futureAction);

    // --- PAST INTERACTIONS ---
    const soilZone = { x: 220, y: 440, w: 60, h: 10 };
    if (!this.flags.seedPlanted && aabb(this.pastPlayer, soilZone) && isPastActionPressed) {
        this.flags.seedPlanted = true;
    }

    const buttonZone = { x: 600, y: 440, w: 50, h: 10 };
    this.flags.pastButtonDown = aabb(this.pastPlayer, buttonZone);

    const pastDoorSwitch = { x: 800, y: 400, w: 40, h: 50 };
    if (this.flags.batteryInRift && !this.flags.pastHasBattery && !this.flags.doorOpen) {
        const pastBatteryDrop = { x: 450, y: 420, w: 30, h: 30 };
        if (aabb(this.pastPlayer, pastBatteryDrop) && isPastActionPressed) {
            this.flags.pastHasBattery = true;
            this.sound.pickup();
        }
    }

    if (this.flags.pastHasBattery && aabb(this.pastPlayer, pastDoorSwitch) && isPastActionPressed) {
        this.flags.pastHasBattery = false;
        this.flags.doorOpen = true;
        this.sound.pickup();
    }

    // --- FUTURE INTERACTIONS ---
    const batteryItem = { x: 380, y: 220, w: 30, h: 30 }; // back to 380 so it's not inside metal wall
    if (!this.flags.futureHasBattery && !this.flags.batteryInRift && aabb(this.futurePlayer, batteryItem) && isFutureActionPressed) {
        this.flags.futureHasBattery = true;
        this.sound.pickup();
    }

    const timeRift = { x: 450, y: 200, w: 40, h: 80 }; // Rift floating in air
    if (this.flags.futureHasBattery && aabb(this.futurePlayer, timeRift) && isFutureActionPressed) {
        this.flags.futureHasBattery = false;
        this.flags.batteryInRift = true; // Sends to past
        this.sound.pickup();
    }
  }

  // ============== RENDERING HELPERS ==============

  drawBattery(x: number, y: number, w: number, h: number) {
    if (this.batteryImage && this.batteryImage.complete && this.batteryImage.naturalWidth > 0) {
        this.ctx.drawImage(this.batteryImage, x - w/2, y - 5, w * 2, h * 1.5);
    } else {
        this.ctx.fillStyle = '#0F0';
        this.ctx.fillRect(x, y + 4, w, h - 8);
        this.ctx.fillStyle = '#FFF';
        this.ctx.fillRect(x + w/2 - 4, y, 8, 4);
        this.ctx.fillRect(x + w/2 - 4, y + h - 4, 8, 4);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x + w/2 - 6, y + h/2 - 2, 12, 4); // minus
        this.ctx.fillRect(x + w/2 - 2, y + h/2 - 6, 4, 12); // plus
    }
  }

  drawTree(x: number, y: number, isGhost: boolean) {
    this.ctx.save();
    this.ctx.translate(x, y);
    if (isGhost) {
      this.ctx.globalAlpha = 0.3;
    }
    
    if (this.treeImage && this.treeImage.complete && this.treeImage.naturalWidth > 0) {
        // Draw the image instead of shapes. Adjust size parameters as appropriate.
        const width = 120; // estimate
        const height = 280; // estimate
        // Center the tree approximately based on traditional drawing coords
        this.ctx.drawImage(this.treeImage, -10, -30, width, height);
    } else {
        // Trunk
        this.ctx.fillStyle = isGhost ? 'rgba(0,255,100,0.5)' : '#5C4033';
        this.ctx.fillRect(40, 20, 20, 250); // Trunk goes down to ground

        // Leaves
        const leafColor = isGhost ? 'rgba(0,255,100,0.5)' : '#228B22';
        const leafOutline = isGhost ? '#0F0' : '#006400';

        // Draw blocky pixel-style leaves instead of smooth circles
        // 3 main clusters
        const clusters = [
            { cx: 20, cy: 10, r: 25 },
            { cx: 50, cy: 0, r: 35 },
            { cx: 80, cy: 10, r: 25 },
        ];
        
        for (let c of clusters) {
            // Draw a blocky shape approximating a circle
            this.ctx.fillStyle = leafOutline;
            this.ctx.fillRect(c.cx - c.r - 4, c.cy - c.r + 4, c.r * 2 + 8, c.r * 2 - 8);
            this.ctx.fillRect(c.cx - c.r + 4, c.cy - c.r - 4, c.r * 2 - 8, c.r * 2 + 8);
            
            this.ctx.fillStyle = leafColor;
            this.ctx.fillRect(c.cx - c.r, c.cy - c.r + 8, c.r * 2, c.r * 2 - 16);
            this.ctx.fillRect(c.cx - c.r + 8, c.cy - c.r, c.r * 2 - 16, c.r * 2);
        }
    }

    this.ctx.restore();
  }

  drawPastGolem(p: Entity) {
    pastSprite.draw(this.ctx, p, this.globalTime);
  }

  drawFutureCyber(p: Entity) {
    futureSprite.draw(this.ctx, p, this.globalTime);
  }

  draw() {
    this.ctx.imageSmoothingEnabled = false;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Camera setup for split screen
    const pastViewport = { x: 0, y: 0, w: w/2, h: h };
    const futureViewport = { x: w/2, y: 0, w: w/2, h: h };

    // Prevent camera viewing out of bounds to the left
    let pastCamX = Math.max(0, this.pastPlayer.x - w/4 + this.pastPlayer.w/2);
    let futureCamX = Math.max(0, this.futurePlayer.x - w/4 + this.futurePlayer.w/2);

    // --- DRAW PAST ---
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(pastViewport.x, pastViewport.y, pastViewport.w, pastViewport.h);
    this.ctx.clip();
    this.ctx.translate(-pastCamX, 0);
    this.drawPast(pastCamX);
    this.ctx.restore();

    // --- DRAW FUTURE ---
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(futureViewport.x, futureViewport.y, futureViewport.w, futureViewport.h);
    this.ctx.clip();
    this.ctx.translate(w/2 - futureCamX, 0);
    this.drawFuture();
    this.ctx.restore();

    // UI Overlays
    this.drawMiddleDivider();
    if (this.isGameWon) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        this.ctx.fillRect(0,0,w,h);
        this.ctx.fillStyle = '#0FF';
        this.ctx.shadowColor = '#0FF';
        this.ctx.shadowBlur = 20;
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 48px sans-serif';
        this.ctx.fillText("MISSION ACCOMPLISHED!", w/2, h/2 - 20);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '24px sans-serif';
        this.ctx.fillText("Hai dòng thời gian đã được kết nối.", w/2, h/2 + 30);
    }
    
    // Draw particles on top of everything, applying viewports
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(pastViewport.x, pastViewport.y, pastViewport.w, pastViewport.h);
    this.ctx.clip();
    this.ctx.translate(-pastCamX, 0);
    for (let p of this.pastParticles) {
        p.draw(this.ctx);
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(futureViewport.x, futureViewport.y, futureViewport.w, futureViewport.h);
    this.ctx.clip();
    this.ctx.translate(w/2 - futureCamX, 0);
    for (let p of this.futureParticles) {
        p.draw(this.ctx);
    }
    this.ctx.restore();
  }

  drawPortal(x: number, y: number, color1: string, color2: string) {
    this.ctx.save();
    this.ctx.translate(x, y);
    
    // Portal bobbing scale effect
    const scale = 1 + Math.sin(this.globalTime * 5) * 0.1;
    this.ctx.scale(scale, scale);

    // Glow effect
    this.ctx.shadowColor = color2;
    this.ctx.shadowBlur = 15;

    // Rotate portal
    this.ctx.rotate(this.globalTime * 2); // Rotate continuously

    // Draw the portal image if loaded
    if (this.portalImage && this.portalImage.complete && this.portalImage.naturalWidth > 0) {
        // Assume the portal image is fairly large and scale it down depending on the size
        const w = 80;
        const h = 80;
        this.ctx.drawImage(this.portalImage, -w/2, -h/2, w, h);
    } else {
        // Fallback drawing if image fails/hasn't loaded
        this.ctx.fillStyle = color1;
        this.ctx.fillRect(-12, -24, 24, 48);
        this.ctx.fillStyle = color2;
        this.ctx.fillRect(-6, -16, 12, 32);
    }
    
    this.ctx.restore();
  }

  drawMiddleDivider() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(this.canvas.width/2 - 2, 0, 4, this.canvas.height);


    if (this.swapFlash > 0) {
        this.ctx.fillStyle = `rgba(255, 0, 0, ${this.swapFlash * 0.5})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  drawPast(camX: number) {
    // Backdrop Sky: 
    if (this.pastBgImage && this.pastBgImage.complete && this.pastBgImage.naturalWidth > 0) {
        // Draw image covering the whole background
        this.ctx.drawImage(this.pastBgImage, camX * 0.5, -50, 2000, 550);
    } else {
        // Solid background for a more pixelated/retro feel
        this.ctx.fillStyle = '#FF9933';
        this.ctx.fillRect(0, 0, 2000, 500);
    }

    // Background hints for the future
    if (!this.flags.seedPlanted) {
        this.drawTree(170, 380, true);
        this.drawTree(100, 300, true);
        this.drawTree(190, 200, true);
    } else {
        this.drawTree(170, 380, false);
        this.drawTree(100, 300, false);
        this.drawTree(190, 200, false);
    }

    // Walls
    for (let w of this.pastWalls) {
        if (w.x === 900 && this.flags.doorOpen) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)'; // opened door ghost
            this.ctx.fillRect(w.x, w.y, w.w, w.h);
        } else {
            if (w.type === 'dirt') {
                this.ctx.fillStyle = '#6B4A34';
                this.ctx.fillRect(w.x, w.y, w.w, w.h);
                // Grass layer
                this.ctx.fillStyle = '#2E8B57';
                this.ctx.fillRect(w.x, w.y, w.w, 6);
            } else if (w.type === 'rockPlat') {
                this.ctx.fillStyle = '#5C4033';
                this.ctx.fillRect(w.x, w.y, w.w, w.h);
                this.ctx.fillStyle = '#4A3222';
                this.ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
            } else if (w.type === 'stoneDoor') {
                // Draw bricks for door
                this.ctx.fillStyle = '#555';
                this.ctx.fillRect(w.x, w.y, w.w, w.h);
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                for(let i=0; i<w.h; i+=20) {
                    this.ctx.strokeRect(w.x, w.y + i, w.w, 20);
                }
            } else {
                 this.ctx.fillStyle = w.color;
                 this.ctx.fillRect(w.x, w.y, w.w, w.h);
            }
        }
    }

    // Soil
    if (!this.flags.seedPlanted) {
        this.ctx.fillStyle = '#8B5A2B';
        this.ctx.beginPath();
        this.ctx.ellipse(250, 445, 30, 10, 0, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText("Soil", 240, 435);
    }

    // Button
    if (this.flags.pastButtonDown) {
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(602, 446, 46, 4);
    } else {
        this.ctx.fillStyle = '#AAA';
        this.ctx.fillRect(600, 440, 50, 10);
    }
    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.fillText("PRESS", 608, 458 + (this.flags.pastButtonDown ? 4 : 0));

    // Battery Drop / Hold
    if (this.flags.batteryInRift && !this.flags.pastHasBattery && !this.flags.doorOpen) {
        const floatY = Math.sin(this.globalTime * 3) * 5;
        this.drawBattery(450, 420 + floatY, 20, 30);
    }

    // Door Receptacle
    if (!this.flags.doorOpen) {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(800, 400, 40, 50);
        this.ctx.strokeStyle = '#0FF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(810, 415, 20, 30);
        this.ctx.fillStyle = '#0FF';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText("PWR", 808, 395);
    } else {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(800, 400, 40, 50);
        this.drawBattery(810, 415, 20, 30);
    }
    
    // Level Completion Portal (Past)
    if (this.flags.doorOpen) {
        this.ctx.fillStyle = '#FFF';
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 4;
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText("EXIT", 955, 360);
        this.ctx.shadowBlur = 0;
        this.drawPortal(970, 410, 'rgba(255, 200, 0, 0.4)', '#FF8C00');
    }

    // Player
    this.drawPastGolem(this.pastPlayer);
    
    // Player indicator
    this.drawIndicator(this.pastPlayer, this.p1ControlsPast ? '#FF3333' : '#00FFFF');
    
    if (this.flags.pastHasBattery) {
        this.drawBattery(this.pastPlayer.x + 10, this.pastPlayer.y - 40, 20, 30);
    }

    // Tutorial text
    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.ctx.font = '16px monospace';
    this.ctx.fillText("Gieo hạt ->", 200, 400);
    this.ctx.fillText("Hứng Năng Lượng ->", 400, 380);
    this.ctx.fillText("Đạp Công Tắc ->", 550, 380);
  }

  drawFuture() {
    // Backdrop Sky: Cyberpunk City Solid
    this.ctx.fillStyle = '#090979';
    this.ctx.fillRect(0, 0, 2000, 500);

    // Grid backdrop
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    for(let i=0; i<2000; i+=100) {
        this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, 500); this.ctx.stroke();
    }
    for(let i=0; i<500; i+=100) {
        this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(2000, i); this.ctx.stroke();
    }

    // Walls
    for (let w of this.futureWalls) {
         if (w.x === 900 && this.flags.doorOpen) {
            this.ctx.fillStyle = 'rgba(0,255,255,0.1)';
            this.ctx.fillRect(w.x, w.y, w.w, w.h); 
        } else if (w.type === 'treePlat') {
             // Let it be drawn as futuristic platform since tree trunks cover it, or just a metal grate
        } else {
            this.ctx.fillStyle = w.color;
            this.ctx.fillRect(w.x, w.y, w.w, w.h);
            if (w.outline) {
                this.ctx.strokeStyle = w.outline;
                this.ctx.lineWidth = 2;
                this.ctx.shadowColor = w.outline;
                this.ctx.shadowBlur = 8;
                this.ctx.strokeRect(w.x, w.y, w.w, w.h);
                this.ctx.shadowBlur = 0;
            }
        }
    }

    // Trees (Break through metal)
    if (this.flags.seedPlanted) {
        this.drawTree(170, 380, false);
        this.drawTree(100, 300, false);
        this.drawTree(190, 200, false);
    }

    // Acid Pool
    const acidY = this.flags.pastButtonDown ? 500 : 440;
    
    // Animate Waves
    if (!this.flags.pastButtonDown) {
        this.ctx.fillStyle = 'rgba(50, 255, 50, 0.8)';
        this.ctx.beginPath();
        this.ctx.moveTo(550, 500);
        this.ctx.lineTo(550, acidY);
        for(let i=550; i<=800; i+=10) {
            const wave = Math.sin(i * 0.05 + this.globalTime * 5) * 5;
            this.ctx.lineTo(i, acidY + wave);
        }
        this.ctx.lineTo(800, 500);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText("ACID - DEADLY", 610, 430);
    } else {
        this.ctx.fillStyle = 'rgba(50, 200, 50, 0.2)';
        this.ctx.fillRect(550, acidY, 250, 500 - acidY);
        this.ctx.fillStyle = '#0F0';
        this.ctx.fillText("ACID DRAINED", 620, 480);
    }

    // Safe platforms over acid
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(600, 380, 40, 10);
    this.ctx.fillRect(700, 320, 40, 10);
    this.ctx.strokeStyle = '#0FF';
    this.ctx.strokeRect(600, 380, 40, 10);
    this.ctx.strokeRect(700, 320, 40, 10);

    // Battery Item
    if (!this.flags.futureHasBattery && !this.flags.batteryInRift) {
        const floatY = Math.sin(this.globalTime * 3) * 5;
        this.drawBattery(380, 220 + floatY, 20, 30);
    }

    // Time Rift
    this.ctx.save();
    this.ctx.translate(470, 240);
    this.ctx.rotate(this.globalTime);
    const riftScale = 1 + Math.sin(this.globalTime * 5) * 0.05;
    this.ctx.scale(riftScale, riftScale);
    
    // Outer glow
    this.ctx.fillStyle = 'rgba(138, 43, 226, 0.3)';
    this.ctx.shadowColor = '#E0B0FF';
    this.ctx.shadowBlur = 20;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 25, 45, 0, 0, Math.PI*2);
    this.ctx.fill();
    
    // Inner swirl
    this.ctx.strokeStyle = '#FFF';
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 15, 35, 0, 0, Math.PI*2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 5, 25, Math.PI/2, 0, Math.PI*2);
    this.ctx.stroke();
    
    this.ctx.restore();

    this.ctx.fillStyle = '#FFF';
    this.ctx.shadowColor = '#E0B0FF';
    this.ctx.shadowBlur = 10;
    this.ctx.fillText("TIME RIFT", 442, 185);
    this.ctx.shadowBlur = 0;

    // Level Completion Portal (Future)
    if (this.flags.doorOpen) {
        this.ctx.fillStyle = '#FFF';
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 4;
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText("EXIT", 955, 360);
        this.ctx.shadowBlur = 0;
        this.drawPortal(970, 410, 'rgba(0, 255, 255, 0.4)', '#00BFFF');
    }

    // Player
    this.drawFutureCyber(this.futurePlayer);
    
    // Player indicator
    this.drawIndicator(this.futurePlayer, !this.p1ControlsPast ? '#FF3333' : '#00FFFF');

    if (this.flags.futureHasBattery) {
        this.drawBattery(this.futurePlayer.x + 2, this.futurePlayer.y - 35, 20, 30);
    }
  }

  drawIndicator(entity: Entity, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(entity.x + entity.w/2 - 8, entity.y - 10);
    this.ctx.lineTo(entity.x + entity.w/2 + 8, entity.y - 10);
    this.ctx.lineTo(entity.x + entity.w/2, entity.y - 2);
    this.ctx.fill();
    
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(color === '#FF3333' ? 'P1' : 'P2', entity.x + entity.w/2, entity.y - 15);
    this.ctx.textAlign = 'left';
  }
}

