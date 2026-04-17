'use strict';

// ═══════════════════════════════════════════════════════════════════
// [1] CANVAS + POLYFILL
// ═══════════════════════════════════════════════════════════════════
const COLS = 20, ROWS = 20, CELL = 28;
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

// roundRect polyfill for Safari / older Chrome
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const R = Math.min(r, w / 2, h / 2);
    this.moveTo(x + R, y);
    this.lineTo(x + w - R, y);         this.quadraticCurveTo(x + w, y, x + w, y + R);
    this.lineTo(x + w, y + h - R);     this.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
    this.lineTo(x + R, y + h);         this.quadraticCurveTo(x, y + h, x, y + h - R);
    this.lineTo(x, y + R);             this.quadraticCurveTo(x, y, x + R, y);
    this.closePath(); return this;
  };
}

// ═══════════════════════════════════════════════════════════════════
// [2] THEMES  — canvas-level color data
// ═══════════════════════════════════════════════════════════════════
const THEMES = {
  neon: {
    levelColors: [
      { snake: '#39ff14', head: '#7fff00', glow: '#39ff1450' },
      { snake: '#ffe600', head: '#fff176', glow: '#ffe60050' },
      { snake: '#ff8c00', head: '#ffb347', glow: '#ff8c0050' },
      { snake: '#ff2d78', head: '#ff6eb4', glow: '#ff2d7850' },
    ],
    food: '#ff2d78', foodGlow: '#ff2d7880',
    bonus: '#ffe600', bonusGlow: '#ffe60080',
    puColors: { speed: '#ffe600', shield: '#00f5ff', ghost: '#bf5fff', shrink: '#39ff14' },
    wall: '#0d1030', wallStroke: '#2a2a6a',
    grid: 'rgba(255,255,255,0.025)',
    bg: 'rgba(5,5,16,0.97)',
    aiPath: 'rgba(0,245,255,0.14)',
  },
  inferno: {
    levelColors: [
      { snake: '#ff4500', head: '#ff6a00', glow: '#ff450050' },
      { snake: '#ff8c00', head: '#ffa533', glow: '#ff8c0050' },
      { snake: '#ffd700', head: '#ffed4a', glow: '#ffd70050' },
      { snake: '#ff2d78', head: '#ff6eb4', glow: '#ff2d7850' },
    ],
    food: '#ffd700', foodGlow: '#ffd70080',
    bonus: '#ff4500', bonusGlow: '#ff450080',
    puColors: { speed: '#ffd700', shield: '#ff8c00', ghost: '#ff4500', shrink: '#ff6347' },
    wall: '#1a0500', wallStroke: '#6a2500',
    grid: 'rgba(255,80,0,0.04)',
    bg: 'rgba(13,0,0,0.97)',
    aiPath: 'rgba(255,200,0,0.14)',
  },
  ocean: {
    levelColors: [
      { snake: '#00f5ff', head: '#7fffff', glow: '#00f5ff50' },
      { snake: '#00bfff', head: '#66d9ff', glow: '#00bfff50' },
      { snake: '#bf5fff', head: '#d48aff', glow: '#bf5fff50' },
      { snake: '#7fff00', head: '#b4ff4a', glow: '#7fff0050' },
    ],
    food: '#ff2d78', foodGlow: '#ff2d7880',
    bonus: '#ffe600', bonusGlow: '#ffe60080',
    puColors: { speed: '#ffe600', shield: '#00f5ff', ghost: '#bf5fff', shrink: '#7fff00' },
    wall: '#000a20', wallStroke: '#004466',
    grid: 'rgba(0,245,255,0.03)',
    bg: 'rgba(0,10,26,0.97)',
    aiPath: 'rgba(100,255,100,0.14)',
  },
};

let currentTheme = 'neon';
const T  = () => THEMES[currentTheme];
const LC = () => T().levelColors[Math.min(level - 1, 3)];

// ═══════════════════════════════════════════════════════════════════
// [3] MAPS
// ═══════════════════════════════════════════════════════════════════
function buildWallsMap() {
  const w = [];
  // 4 corner 2×2 blocks (inset by 2)
  [[2,2],[16,2],[2,16],[16,16]].forEach(([cx,cy]) => {
    for (let dx=0;dx<2;dx++) for (let dy=0;dy<2;dy++) w.push({x:cx+dx,y:cy+dy});
  });
  // Edge-center obstacles
  [[9,2],[10,2],[9,3],[10,3]].forEach(p => w.push(p));         // top
  [[9,16],[10,16],[9,17],[10,17]].forEach(p => w.push(p));     // bottom
  [[2,9],[2,10],[3,9],[3,10]].forEach(p => w.push(p));         // left
  [[16,9],[16,10],[17,9],[17,10]].forEach(p => w.push(p));     // right
  return w;
}

function buildMazeMap() {
  const walls = [];
  // Horizontal dividers at y=5 and y=14  — gap at x=8..11
  for (let x = 1; x <= 7;  x++) { walls.push({x,y:5}); walls.push({x,y:14}); }
  for (let x = 12; x <= 18; x++) { walls.push({x,y:5}); walls.push({x,y:14}); }
  // Vertical dividers at x=5 and x=14 — gap at y=8..11
  for (let y = 1; y <= 7;  y++) { walls.push({x:5,y}); walls.push({x:14,y}); }
  for (let y = 12; y <= 18; y++) { walls.push({x:5,y}); walls.push({x:14,y}); }
  // Guarantee snake spawn zone clear
  return walls.filter(({x,y}) => !(x >= 7 && x <= 12 && y >= 8 && y <= 12));
}

const MAPS = {
  classic: { name:'Classic', desc:'Open field',        wrap:false, walls:[] },
  walls:   { name:'Walls',   desc:'Obstacle blocks',   wrap:false, walls:buildWallsMap() },
  wrap:    { name:'Wrap',    desc:'Pass through edges', wrap:true,  walls:[] },
  maze:    { name:'Maze',    desc:'Navigate corridors', wrap:false, walls:buildMazeMap() },
};

let currentMap = 'classic';
let wallSet    = new Set();   // Set of "x,y" strings for O(1) lookup

function updateWallSet() {
  wallSet = new Set((MAPS[currentMap].walls || []).map(({x,y}) => `${x},${y}`));
}

function setMap(name) {
  if (!MAPS[name] || (gameState === 'playing')) return;
  currentMap = name;
  updateWallSet();
  document.querySelectorAll('.map-tab').forEach(b => b.classList.toggle('active', b.dataset.map === name));
}

// ═══════════════════════════════════════════════════════════════════
// [4] SOUND — Web Audio API (synthesized, no files needed)
// ═══════════════════════════════════════════════════════════════════
let _ac = null;
let soundMuted = false;

function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  return _ac;
}

function beep({ freq=440, type='sine', duration=0.1, gain=0.25, slide=null } = {}) {
  if (soundMuted) return;
  try {
    const a = getAC();
    const o = a.createOscillator();
    const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + duration);
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
    o.start(); o.stop(a.currentTime + duration + 0.01);
  } catch (_) {}
}

const SFX = {
  eat:     () => beep({ freq:440, slide:880, duration:0.08, gain:0.2 }),
  bonus:   () => {
    beep({ freq:660, slide:1320, duration:0.1, gain:0.22 });
    setTimeout(() => beep({ freq:1000, duration:0.09, gain:0.18 }), 110);
  },
  powerup: () => [600,800,1000].forEach((f,i) => setTimeout(() => beep({ freq:f, duration:0.08, gain:0.2 }), i*75)),
  levelup: () => [261,329,392,523].forEach((f,i) => setTimeout(() => beep({ freq:f, type:'triangle', duration:0.15, gain:0.18 }), i*100)),
  death:   () => beep({ freq:280, type:'sawtooth', slide:55, duration:0.5, gain:0.3 }),
  shield:  () => beep({ freq:800, type:'square', slide:300, duration:0.18, gain:0.2 }),
};

// ═══════════════════════════════════════════════════════════════════
// [5] DOM REFS
// ═══════════════════════════════════════════════════════════════════
const scoreEl        = document.getElementById('score');
const highScoreEl    = document.getElementById('high-score');
const levelEl        = document.getElementById('level');
const startScreen    = document.getElementById('start-screen');
const pauseScreen    = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl   = document.getElementById('final-score');
const finalBestEl    = document.getElementById('final-best');
const finalLevelEl   = document.getElementById('final-level');
const newRecordBadge = document.getElementById('new-record-badge');
const startBtn       = document.getElementById('start-btn');
const resumeBtn      = document.getElementById('resume-btn');
const restartBtn     = document.getElementById('restart-btn');
const aiBadge        = document.getElementById('ai-badge');
const aiToggleBtn    = document.getElementById('ai-toggle-btn');
const muteBtn        = document.getElementById('mute-btn');
const playerNameInput= document.getElementById('player-name');
const powerupStatus  = document.getElementById('powerup-status');

// ═══════════════════════════════════════════════════════════════════
// [6] GAME STATE
// ═══════════════════════════════════════════════════════════════════
let snake, dir, nextDir, food, bonusFood;
let boardPUs  = [];   // [{x,y,type,born}] — power-ups on the board
let activePU  = {};   // {type: {endTime, timerId}}
let score, highScore = 0, level;
let gameState = 'idle';   // 'idle' | 'playing' | 'paused' | 'over'
let loopTimer = null, rafId = null;
let flashOverlay = 0;
let particles = [];
let aiMode = false, aiPath = [];
let bonusTimer = null, bonusTimeLeft = 0;

highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
highScoreEl.textContent = highScore;

// ═══════════════════════════════════════════════════════════════════
// [7] LEADERBOARD  (localStorage, top 10)
// ═══════════════════════════════════════════════════════════════════
function loadLB() {
  try { return JSON.parse(localStorage.getItem('snakeLB') || '[]'); } catch { return []; }
}
function saveLB(arr) { localStorage.setItem('snakeLB', JSON.stringify(arr)); }

function addToLB(name, sc, lv) {
  const lb = loadLB();
  lb.push({ name: name || 'Anonymous', score: sc, level: lv });
  lb.sort((a,b) => b.score - a.score);
  saveLB(lb.slice(0, 10));
}

function renderLB(containerId, highlightScore=-1) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const lb  = loadLB();
  const max = containerId === 'leaderboard-list' ? 5 : 10;
  if (!lb.length) { el.innerHTML = '<span class="no-scores">No scores yet</span>'; return; }
  const medals = ['🥇','🥈','🥉'];
  let firstHighlight = true;
  el.innerHTML = lb.slice(0, max).map((e, i) => {
    const isMe = highlightScore >= 0 && e.score === highlightScore && firstHighlight;
    if (isMe) firstHighlight = false;
    return `<div class="lb-entry${isMe ? ' me' : ''}">
      <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-score">${e.score}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// [8] FOOD SPAWNING
// ═══════════════════════════════════════════════════════════════════
const rnd = n => Math.floor(Math.random() * n);

function isFree(x, y) {
  if (wallSet.has(`${x},${y}`)) return false;
  if (snake && snake.some(s => s.x===x && s.y===y)) return false;
  if (food && food.x===x && food.y===y) return false;
  if (bonusFood && bonusFood.x===x && bonusFood.y===y) return false;
  if (boardPUs.some(p => p.x===x && p.y===y)) return false;
  return true;
}

function spawnFood() {
  let p, i = 0;
  do { p = { x:rnd(COLS), y:rnd(ROWS) }; } while (!isFree(p.x, p.y) && ++i < 400);
  return p;
}

function maybeSpawnBonus() {
  if (!bonusFood && Math.random() < 0.3) {
    let p, i=0;
    do { p = { x:rnd(COLS), y:rnd(ROWS) }; } while (!isFree(p.x, p.y) && ++i < 400);
    bonusFood = p;
    bonusTimeLeft = 7000;
    clearTimeout(bonusTimer);
    bonusTimer = setTimeout(() => { bonusFood = null; }, 7000);
  }
}

const PU_TYPES = ['speed','shield','ghost','shrink'];

function maybeSpawnBoardPU() {
  if (boardPUs.length < 2 && Math.random() < 0.2) {
    let p, i=0;
    do { p = { x:rnd(COLS), y:rnd(ROWS) }; } while (!isFree(p.x, p.y) && ++i < 400);
    const pu = { x:p.x, y:p.y, type:PU_TYPES[rnd(4)], born:Date.now() };
    boardPUs.push(pu);
    setTimeout(() => { boardPUs = boardPUs.filter(q => q !== pu); }, 10000);
  }
}

// ═══════════════════════════════════════════════════════════════════
// [9] POWER-UP EFFECTS
// ═══════════════════════════════════════════════════════════════════
const PU_CFG = {
  speed:  { label:'⚡ Speed Boost', duration:6000, color:'#ffe600' },
  shield: { label:'🛡️ Shield',      duration:8000, color:'#00f5ff' },
  ghost:  { label:'👻 Ghost Mode',  duration:6000, color:'#bf5fff' },
  shrink: { label:'✂️ Shrink',      duration:0,    color:'#39ff14' },
};

function activatePU(type) {
  SFX.powerup();
  if (type === 'shrink') {
    snake = snake.slice(0, Math.max(3, Math.ceil(snake.length / 2)));
    spawnParticles(snake[0].x, snake[0].y, '#39ff14', 15);
    return;
  }
  const cfg = PU_CFG[type];
  if (activePU[type]) clearTimeout(activePU[type].timerId);
  activePU[type] = {
    endTime: Date.now() + cfg.duration,
    timerId: setTimeout(() => { delete activePU[type]; updatePUStatus(); }, cfg.duration),
  };
  updatePUStatus();
}

function isPUActive(type) { return !!activePU[type]; }

function consumeShield() {
  if (!activePU['shield']) return false;
  clearTimeout(activePU['shield'].timerId);
  delete activePU['shield'];
  SFX.shield();
  spawnParticles(snake[0].x, snake[0].y, '#00f5ff', 12);
  updatePUStatus();
  return true;
}

function clearAllPUs() {
  Object.values(activePU).forEach(p => clearTimeout(p.timerId));
  activePU = {};
  updatePUStatus();
}

function updatePUStatus() {
  const entries = Object.entries(activePU);
  if (!entries.length) {
    powerupStatus.innerHTML = '<span class="no-powers">None active</span>';
    return;
  }
  powerupStatus.innerHTML = entries.map(([type, { endTime }]) => {
    const cfg = PU_CFG[type];
    const pct = Math.max(0, (endTime - Date.now()) / cfg.duration * 100);
    return `<div class="powerup-item">
      <span class="pu-icon-sm">${cfg.label.split(' ')[0]}</span>
      <div class="pu-info">
        <span class="pu-label">${cfg.label.slice(2)}</span>
        <div class="pu-bar-track">
          <div class="pu-bar-fill" style="width:${pct}%;background:${cfg.color}"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// [10] AI — BFS PATHFINDING  (the core algorithm)
// ═══════════════════════════════════════════════════════════════════

/**
 * BFS from snake head to `target`.
 * Returns the first Direction {x,y} to take, or null if unreachable.
 * Also populates `aiPath` array for visual overlay.
 */
function bfsTo(target) {
  if (!target) return null;
  const wrap = MAPS[currentMap].wrap;

  // Obstacles = everything except the tail (which will have moved away)
  const blocked = new Set();
  snake.slice(0, -1).forEach(s => blocked.add(`${s.x},${s.y}`));
  wallSet.forEach(k => blocked.add(k));

  const head = snake[0];
  const queue   = [{ x:head.x, y:head.y, parent:null, dir:null }];
  const visited = new Set([`${head.x},${head.y}`]);
  const DIRS    = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

  while (queue.length > 0) {
    const curr = queue.shift();

    for (const d of DIRS) {
      let nx = curr.x + d.x;
      let ny = curr.y + d.y;

      if (wrap) {
        nx = ((nx % COLS) + COLS) % COLS;
        ny = ((ny % ROWS) + ROWS) % ROWS;
      } else {
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      }

      const key = `${nx},${ny}`;
      if (visited.has(key) || blocked.has(key)) continue;

      const node = { x:nx, y:ny, parent:curr, dir:d };

      if (nx === target.x && ny === target.y) {
        // Trace back to find first step from head
        let step = node;
        while (step.parent && step.parent.parent !== null) step = step.parent;

        // Build visual path (limit to 18 steps)
        aiPath = [];
        let c = node;
        while (c.parent !== null && aiPath.length < 18) {
          aiPath.unshift({ x:c.x, y:c.y });
          c = c.parent;
        }
        return step.dir;
      }

      visited.add(key);
      queue.push(node);
    }
  }

  aiPath = [];
  return null;   // no path found
}

/**
 * Fallback: find any safe direction (preferring non-reversals).
 */
function getSafeDir() {
  const wrap = MAPS[currentMap].wrap;
  const DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  const safe = DIRS.filter(d => {
    let nx = snake[0].x + d.x, ny = snake[0].y + d.y;
    if (wrap) {
      nx = ((nx%COLS)+COLS)%COLS; ny = ((ny%ROWS)+ROWS)%ROWS;
    } else {
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
    }
    return !snake.some(s=>s.x===nx&&s.y===ny) && !wallSet.has(`${nx},${ny}`);
  });
  const noRev = safe.filter(d => !(d.x===-dir.x && d.y===-dir.y));
  const opts  = noRev.length ? noRev : safe;
  return opts.length ? opts[rnd(opts.length)] : null;
}

function getAIDir() {
  let d = bfsTo(food);
  if (!d && bonusFood) d = bfsTo(bonusFood);
  if (!d) { aiPath = []; d = getSafeDir(); }
  if (d && d.x===-dir.x && d.y===-dir.y) d = getSafeDir();
  return d || dir;
}

// ═══════════════════════════════════════════════════════════════════
// [11] RENDER LOOP — requestAnimationFrame (60fps, always on)
// ═══════════════════════════════════════════════════════════════════
function startRenderLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
  rafId = requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════════
// [12] TICK LOOP — setTimeout (drives snake movement speed)
// ═══════════════════════════════════════════════════════════════════
function getSpeed() {
  const base = [180, 140, 110, 90][Math.min(level - 1, 3)];
  return isPUActive('speed') ? Math.max(55, Math.floor(base * 0.5)) : base;
}

function startTickLoop() {
  clearTimeout(loopTimer);
  loopTimer = setTimeout(() => {
    tick();
    if (gameState === 'playing') startTickLoop();
  }, getSpeed());
}

// ═══════════════════════════════════════════════════════════════════
// [13] TICK — core game logic per move
// ═══════════════════════════════════════════════════════════════════
function tick() {
  if (aiMode) nextDir = getAIDir();
  dir = { ...nextDir };

  const wrapMap = MAPS[currentMap].wrap;
  const ghost   = isPUActive('ghost') || wrapMap;

  let nx = snake[0].x + dir.x;
  let ny = snake[0].y + dir.y;

  // ── Boundary collision ──
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    if (ghost) {
      nx = ((nx % COLS) + COLS) % COLS;
      ny = ((ny % ROWS) + ROWS) % ROWS;
    } else if (consumeShield()) {
      return; // survive, but skip this tick's movement
    } else {
      endGame(); return;
    }
  }

  // ── Map wall collision ──
  if (wallSet.has(`${nx},${ny}`)) {
    if (isPUActive('ghost')) {
      // ghost passes through walls too
    } else if (consumeShield()) {
      return;
    } else {
      endGame(); return;
    }
  }

  // ── Self collision ──
  if (snake.some(s => s.x===nx && s.y===ny)) {
    if (consumeShield()) return;
    endGame(); return;
  }

  const head = { x:nx, y:ny };
  snake.unshift(head);
  let grew = false;

  // ── Eat normal food ──
  if (head.x===food.x && head.y===food.y) {
    score++;
    grew = true;
    spawnParticles(food.x, food.y, T().food, 14);
    SFX.eat();
    food = spawnFood();
    maybeSpawnBonus();
    maybeSpawnBoardPU();
    updateLevel();
    animateScorePop();
  }

  // ── Eat bonus food ──
  if (bonusFood && head.x===bonusFood.x && head.y===bonusFood.y) {
    score += 3;
    grew = true;
    spawnParticles(bonusFood.x, bonusFood.y, T().bonus, 22);
    SFX.bonus();
    clearTimeout(bonusTimer); bonusFood = null;
    updateLevel();
    animateScorePop();
  }

  // ── Collect board power-up ──
  const pIdx = boardPUs.findIndex(p => p.x===head.x && p.y===head.y);
  if (pIdx !== -1) {
    const pu = boardPUs.splice(pIdx, 1)[0];
    activatePU(pu.type);
  }

  if (!grew) snake.pop();

  updateUI();
  updateParticles();
}

function updateLevel() {
  const prev = level;
  if      (score >= 30) level = 4;
  else if (score >= 20) level = 3;
  else if (score >= 10) level = 2;
  else                  level = 1;
  if (level > prev) SFX.levelup();
}

// ═══════════════════════════════════════════════════════════════════
// [14] END GAME
// ═══════════════════════════════════════════════════════════════════
function endGame() {
  gameState = 'over';
  clearTimeout(loopTimer);
  SFX.death();

  // Smooth red flash
  flashOverlay = 1.0;
  const fade = () => {
    flashOverlay = Math.max(0, flashOverlay - 0.13);
    if (flashOverlay > 0) requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);

  const isNewRecord = score > highScore;
  if (isNewRecord) { highScore = score; localStorage.setItem('snakeHighScore', highScore); }

  const name = playerNameInput?.value?.trim() || 'Anonymous';
  addToLB(name, score, level);

  setTimeout(() => {
    finalScoreEl.textContent = score;
    finalBestEl.textContent  = Math.max(score, highScore);
    finalLevelEl.textContent = level;
    newRecordBadge.classList.toggle('hidden', !isNewRecord);
    renderLB('gameover-lb-list', score);
    renderLB('leaderboard-list', score);
    showScreen(gameOverScreen);
  }, 520);
}

// ═══════════════════════════════════════════════════════════════════
// [15] DRAW — called 60fps by RAF loop
// ═══════════════════════════════════════════════════════════════════
function draw() {
  const theme = T();
  const now   = Date.now();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth   = 0.5;
  for (let x=0; x<=COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); ctx.stroke(); }
  for (let y=0; y<=ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); ctx.stroke(); }

  // AI path highlight
  if (aiMode && aiPath.length > 0) {
    ctx.fillStyle = theme.aiPath;
    aiPath.forEach(({x,y}) => ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2));
  }

  // Walls
  if (wallSet.size > 0) {
    MAPS[currentMap].walls.forEach(({x,y}) => {
      ctx.fillStyle   = theme.wall;
      ctx.strokeStyle = theme.wallStroke;
      ctx.lineWidth   = 1;
      ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
      ctx.strokeRect(x*CELL+0.5, y*CELL+0.5, CELL-1, CELL-1);
    });
  }

  // Particles
  drawParticles();

  // Board power-ups
  boardPUs.forEach(pu => drawBoardPU(pu, now));

  // Bonus food
  if (bonusFood) {
    drawFood(bonusFood.x, bonusFood.y, theme.bonus, theme.bonusGlow, now, true);
    drawBonusRing(bonusFood.x, bonusFood.y);
  }

  // Normal food
  if (food) drawFood(food.x, food.y, theme.food, theme.foodGlow, now, false);

  // Snake
  if (snake && snake.length > 0) {
    const cols = LC();
    const ghostActive = isPUActive('ghost');

    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const alpha  = 1 - (i / snake.length) * 0.5;
      const pad    = isHead ? 1 : 3;

      ctx.save();
      ctx.shadowColor = ghostActive ? '#bf5fff80' : cols.glow;
      ctx.shadowBlur  = isHead ? 24 : 12;

      let color = isHead ? cols.head : cols.snake;
      if (ghostActive) {
        color = isHead ? '#d48aff' : '#bf5fff';
        ctx.globalAlpha = Math.max(0.35, 0.75 - i * 0.04);
      } else {
        ctx.globalAlpha = alpha;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2, isHead ? 8 : 6);
      ctx.fill();
      ctx.restore();

      if (isHead) drawEyes(seg);

      // Shield halo on head
      if (isHead && isPUActive('shield')) {
        ctx.save();
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur  = 16;
        ctx.globalAlpha = 0.65 + Math.sin(now / 200) * 0.35;
        ctx.beginPath();
        ctx.arc(seg.x*CELL + CELL/2, seg.y*CELL + CELL/2, CELL/2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // Death flash overlay
  if (flashOverlay > 0) {
    ctx.save();
    ctx.globalAlpha = flashOverlay * 0.4;
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

// ─── Draw Helpers ────────────────────────────────────────────────
function drawEyes(head) {
  const cx = head.x*CELL + CELL/2, cy = head.y*CELL + CELL/2;
  const off = 5;
  let e1, e2;
  if      (dir.x=== 1) { e1={x:cx+4,y:cy-off}; e2={x:cx+4,y:cy+off}; }
  else if (dir.x===-1) { e1={x:cx-4,y:cy-off}; e2={x:cx-4,y:cy+off}; }
  else if (dir.y===-1) { e1={x:cx-off,y:cy-4}; e2={x:cx+off,y:cy-4}; }
  else                 { e1={x:cx-off,y:cy+4}; e2={x:cx+off,y:cy+4}; }
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  [e1,e2].forEach(e => { ctx.beginPath(); ctx.arc(e.x,e.y,3,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  [e1,e2].forEach(e => { ctx.beginPath(); ctx.arc(e.x+1,e.y-1,1,0,Math.PI*2); ctx.fill(); });
}

function drawFood(gx, gy, color, glowColor, time, isBig) {
  const cx = gx*CELL + CELL/2, cy = gy*CELL + CELL/2;
  const pulse = Math.sin(time / 400 * Math.PI) * 0.1 + 1;
  const r = (isBig ? 9 : 7) * pulse;

  ctx.save();
  ctx.shadowColor = glowColor; ctx.shadowBlur = 22;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*2.2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, color + '88');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r*2.2, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = color; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(cx - r*0.28, cy - r*0.28, r*0.3, 0, Math.PI*2); ctx.fill();

  if (isBig) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = `bold ${Math.round(r*1.3)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy+1);
  }
  ctx.restore();
}

function drawBonusRing(gx, gy) {
  const cx = gx*CELL+CELL/2, cy = gy*CELL+CELL/2;
  const frac = bonusTimeLeft > 0 ? bonusTimeLeft / 7000 : 1;
  ctx.save();
  ctx.strokeStyle = T().bonus; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL/2-1, -Math.PI/2, -Math.PI/2 + Math.PI*2*frac);
  ctx.stroke();
  ctx.restore();
}

function drawBoardPU(pu, now) {
  const color = T().puColors[pu.type] || '#ffffff';
  const icons = { speed:'⚡', shield:'🛡', ghost:'👻', shrink:'✂' };
  const cx = pu.x*CELL + CELL/2, cy = pu.y*CELL + CELL/2;
  const pulse = Math.sin(now/500*Math.PI + pu.x) * 0.1 + 1;
  const r = 9 * pulse;
  const age = (now - pu.born) / 10000;

  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 18;

  ctx.fillStyle = color + '44';
  ctx.beginPath(); ctx.arc(cx, cy, r*1.6, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = color; ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.font = `bold ${Math.floor(r*1.2)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icons[pu.type], cx, cy+1);

  // Countdown ring
  const timeLeft = Math.max(0, 1 - age);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(cx, cy, r+5, -Math.PI/2, -Math.PI/2 + Math.PI*2*timeLeft);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// [16] PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════
function spawnParticles(gx, gy, color, n) {
  for (let i=0; i<n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.5 + 1;
    particles.push({
      x: gx*CELL+CELL/2, y: gy*CELL+CELL/2,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      life: 1, color, size: Math.random()*3+2,
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0.05);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.9; p.vy *= 0.9;
    p.life -= 0.055; p.size *= 0.96;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ═══════════════════════════════════════════════════════════════════
// [17] UI HELPERS
// ═══════════════════════════════════════════════════════════════════
function showScreen(el) {
  [startScreen, pauseScreen, gameOverScreen].forEach(s => s?.classList.add('hidden'));
  el?.classList.remove('hidden');
}

function updateUI() {
  scoreEl.textContent     = score;
  highScoreEl.textContent = Math.max(score, highScore);
  levelEl.textContent     = level;
}

function animateScorePop() {
  scoreEl.classList.remove('pop');
  void scoreEl.offsetWidth; // reflow
  scoreEl.classList.add('pop');
  setTimeout(() => scoreEl.classList.remove('pop'), 220);
}

// ═══════════════════════════════════════════════════════════════════
// [18] THEME & MAP SWITCHING
// ═══════════════════════════════════════════════════════════════════
function setTheme(name) {
  if (!THEMES[name]) return;
  currentTheme = name;
  document.body.className = `theme-${name}`;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
}

// ═══════════════════════════════════════════════════════════════════
// [19] INPUT  — keyboard + touch
// ═══════════════════════════════════════════════════════════════════
const DIR_MAP = {
  ArrowUp:{x:0,y:-1},    w:{x:0,y:-1},  W:{x:0,y:-1},
  ArrowDown:{x:0,y:1},   s:{x:0,y:1},   S:{x:0,y:1},
  ArrowLeft:{x:-1,y:0},  a:{x:-1,y:0},  A:{x:-1,y:0},
  ArrowRight:{x:1,y:0},  d:{x:1,y:0},   D:{x:1,y:0},
};

document.addEventListener('keydown', e => {
  const key = e.key;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(key)) e.preventDefault();

  // When not playing: space / arrow / WASD starts game
  if (gameState === 'idle' || gameState === 'over') {
    if (key === ' ' || DIR_MAP[key]) { startGame(); return; }
    if (key === 'a' || key === 'A')  { toggleAI(); return; }
    if (key === 'm' || key === 'M')  { toggleMute(); return; }
    return;
  }

  if (key === ' ' || key === 'p' || key === 'P') { togglePause(); return; }
  if (key === 'm' || key === 'M') { toggleMute(); return; }

  // AI mode hotkey only when paused
  if (gameState === 'paused' && (key === 'a' || key === 'A')) { toggleAI(); return; }

  if (gameState !== 'playing' || aiMode) return;

  const nd = DIR_MAP[key];
  if (!nd) return;
  if (nd.x === -dir.x && nd.y === -dir.y) return; // no 180°
  nextDir = nd;
});

let touchStart = null;
canvas.addEventListener('touchstart', e => {
  touchStart = { x:e.touches[0].clientX, y:e.touches[0].clientY };
}, { passive:true });

canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

  if (gameState === 'idle' || gameState === 'over') { startGame(); return; }
  if (gameState === 'paused') { togglePause(); return; }
  if (aiMode) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    const nd = dx>0 ? {x:1,y:0} : {x:-1,y:0};
    if (nd.x !== -dir.x) nextDir = nd;
  } else {
    const nd = dy>0 ? {x:0,y:1} : {x:0,y:-1};
    if (nd.y !== -dir.y) nextDir = nd;
  }
}, { passive:true });

// ═══════════════════════════════════════════════════════════════════
// [20] GAME TRANSITIONS
// ═══════════════════════════════════════════════════════════════════
function initGame() {
  snake     = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  dir       = {x:1,y:0};
  nextDir   = {x:1,y:0};
  updateWallSet();
  food      = spawnFood();
  bonusFood = null; boardPUs = []; aiPath = [];
  clearAllPUs();
  score = 0; level = 1; particles = [];
  clearTimeout(bonusTimer); bonusTimer = null;
  updateUI(); updatePUStatus(); renderLB('leaderboard-list');
}

function startGame() {
  initGame();
  gameState = 'playing';
  showScreen(null);
  startRenderLoop();
  startTickLoop();
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    clearTimeout(loopTimer);
    showScreen(pauseScreen);
  } else if (gameState === 'paused') {
    gameState = 'playing';
    showScreen(null);
    startTickLoop();
  }
}

function toggleAI() {
  aiMode = !aiMode;
  aiBadge.classList.toggle('hidden', !aiMode);
  aiToggleBtn.classList.toggle('active', aiMode);
  aiToggleBtn.title = aiMode ? '🤖 AI ON — click to disable' : 'Toggle AI (A key)';
}

function toggleMute() {
  soundMuted = !soundMuted;
  muteBtn.textContent = soundMuted ? '🔇' : '🔊';
  muteBtn.classList.toggle('active', soundMuted);
}

// ═══════════════════════════════════════════════════════════════════
// [21] EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════
startBtn.addEventListener('click',   startGame);
resumeBtn.addEventListener('click',  togglePause);
restartBtn.addEventListener('click', startGame);
aiToggleBtn.addEventListener('click', toggleAI);
muteBtn.addEventListener('click',    toggleMute);

document.getElementById('theme-switcher').addEventListener('click', e => {
  const btn = e.target.closest('.theme-btn');
  if (btn) setTheme(btn.dataset.theme);
});

document.getElementById('map-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.map-tab');
  if (btn) setMap(btn.dataset.map);
});

// ═══════════════════════════════════════════════════════════════════
// [22] PERIODIC TIMERS
// ═══════════════════════════════════════════════════════════════════
// Bonus food countdown
setInterval(() => { if (bonusFood && bonusTimeLeft > 0) bonusTimeLeft -= 100; }, 100);

// Power-up status bar refresh
setInterval(() => { if (gameState === 'playing' && Object.keys(activePU).length) updatePUStatus(); }, 200);

// ═══════════════════════════════════════════════════════════════════
// [23] BACKGROUND CSS PARTICLES (decorative floating dots)
// ═══════════════════════════════════════════════════════════════════
(function spawnBgParticles() {
  const container = document.getElementById('particles');
  const colors = ['#39ff14','#00f5ff','#bf5fff','#ff2d78','#ffe600'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size  = Math.random() * 4 + 2;
    const color = colors[rnd(colors.length)];
    Object.assign(p.style, {
      width:`${size}px`, height:`${size}px`,
      background:color, boxShadow:`0 0 ${size*2}px ${color}`,
      left:`${Math.random()*100}%`,
      animationDelay:`${Math.random()*14}s`,
      animationDuration:`${Math.random()*12+8}s`,
    });
    container.appendChild(p);
  }
})();

// ═══════════════════════════════════════════════════════════════════
// [24] BOOT
// ═══════════════════════════════════════════════════════════════════
setMap('classic');
setTheme('neon');
startRenderLoop();
showScreen(startScreen);
renderLB('leaderboard-list');
