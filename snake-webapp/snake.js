(() => {
  "use strict";

  const GRID = 20;                 // Anzahl Zellen pro Seite
  const FOODS_PER_LEVEL = 5;       // Futter bis zum nächsten Level
  const SPEEDUP_PER_LEVEL = 0.9;   // Faktor für Tick-Intervall je Level
  const MIN_TICK = 45;             // schnellstes Tick-Intervall in ms

  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
  };

  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const scoreEl = document.getElementById("score");
  const highscoreEl = document.getElementById("highscore");
  const levelEl = document.getElementById("level");
  const wrapToggle = document.getElementById("wrap-toggle");
  const speedSelect = document.getElementById("speed-select");

  const HS_KEY = "snake-highscore";

  const state = {
    snake: [],
    dir: DIRS.right,
    inputQueue: [],
    food: null,
    score: 0,
    level: 1,
    eaten: 0,
    highscore: loadHighscore(),
    running: false,
    paused: false,
    over: false,
    tickMs: 120,
    lastTick: 0,
    prevSnake: [],
  };

  // ---------- Persistenz ----------
  function loadHighscore() {
    try {
      return parseInt(localStorage.getItem(HS_KEY), 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveHighscore(value) {
    try {
      localStorage.setItem(HS_KEY, String(value));
    } catch {
      /* Speicher nicht verfügbar – ignorieren */
    }
  }

  // ---------- Spiellogik ----------
  function reset() {
    const mid = Math.floor(GRID / 2);
    state.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    state.prevSnake = state.snake.map((s) => ({ ...s }));
    state.dir = DIRS.right;
    state.inputQueue = [];
    state.score = 0;
    state.level = 1;
    state.eaten = 0;
    state.over = false;
    state.paused = false;
    state.tickMs = parseInt(speedSelect.value, 10);
    state.food = spawnFood();
    updateHud();
  }

  function spawnFood() {
    const occupied = new Set(state.snake.map((s) => s.y * GRID + s.x));
    const free = [];
    for (let i = 0; i < GRID * GRID; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    if (free.length === 0) return null;
    const idx = free[Math.floor(Math.random() * free.length)];
    return { x: idx % GRID, y: Math.floor(idx / GRID) };
  }

  function queueDirection(name) {
    const next = DIRS[name];
    if (!next) return;
    // Gegen die zuletzt geplante Richtung prüfen, damit schnelle
    // Tastenfolgen keine 180°-Wende erzeugen.
    const last = state.inputQueue.length
      ? state.inputQueue[state.inputQueue.length - 1]
      : state.dir;
    if (next === last) return;
    if (next.x === -last.x && next.y === -last.y) return;
    if (state.inputQueue.length < 3) state.inputQueue.push(next);
  }

  function step() {
    if (state.inputQueue.length) state.dir = state.inputQueue.shift();

    const head = state.snake[0];
    let nx = head.x + state.dir.x;
    let ny = head.y + state.dir.y;

    if (wrapToggle.checked) {
      nx = (nx + GRID) % GRID;
      ny = (ny + GRID) % GRID;
    } else if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      return gameOver();
    }

    const willEat = state.food && nx === state.food.x && ny === state.food.y;
    // Der Schwanz bewegt sich weiter, außer die Schlange frisst –
    // deshalb darf der Kopf auf das aktuelle Schwanzfeld ziehen.
    const body = willEat ? state.snake : state.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      return gameOver();
    }

    state.prevSnake = state.snake.map((s) => ({ ...s }));
    state.snake.unshift({ x: nx, y: ny });

    if (willEat) {
      state.eaten++;
      state.score += 10 * state.level;
      if (state.eaten % FOODS_PER_LEVEL === 0) {
        state.level++;
        state.tickMs = Math.max(MIN_TICK, Math.round(state.tickMs * SPEEDUP_PER_LEVEL));
      }
      state.food = spawnFood();
      if (!state.food) return win();
      updateHud();
    } else {
      state.snake.pop();
    }
  }

  function gameOver() {
    state.running = false;
    state.over = true;
    const newRecord = state.score > state.highscore;
    if (newRecord) {
      state.highscore = state.score;
      saveHighscore(state.highscore);
    }
    updateHud();
    showOverlay(
      "Game Over",
      newRecord
        ? `Neuer Rekord: ${state.score} Punkte!`
        : `Du hast ${state.score} Punkte erreicht.`,
      "Nochmal spielen"
    );
  }

  function win() {
    state.running = false;
    state.over = true;
    if (state.score > state.highscore) {
      state.highscore = state.score;
      saveHighscore(state.highscore);
    }
    updateHud();
    showOverlay("Gewonnen!", `Das ganze Feld ist voll – ${state.score} Punkte.`, "Nochmal spielen");
  }

  // ---------- Steuerung des Ablaufs ----------
  function start() {
    reset();
    hideOverlay();
    state.running = true;
    state.lastTick = performance.now();
  }

  function togglePause() {
    if (!state.running && !state.paused) return;
    state.paused = !state.paused;
    state.running = !state.paused;
    if (state.paused) {
      showOverlay("Pause", "Leertaste oder Button drücken zum Weiterspielen.", "Weiter");
    } else {
      hideOverlay();
      state.lastTick = performance.now();
    }
  }

  function onPrimaryAction() {
    if (state.paused) togglePause();
    else if (!state.running) start();
  }

  function showOverlay(title, text, btnLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = btnLabel;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    highscoreEl.textContent = state.highscore;
    levelEl.textContent = state.level;
  }

  // ---------- Rendering ----------
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.max(1, Math.round(rect.width * dpr));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(now) {
    resizeCanvas();
    const size = canvas.width;
    const cell = size / GRID;
    const colors = {
      board: cssVar("--board"),
      grid: cssVar("--grid"),
      snake: cssVar("--accent"),
      head: cssVar("--accent-strong"),
      food: cssVar("--food"),
    };

    ctx.fillStyle = colors.board;
    ctx.fillRect(0, 0, size, size);

    // Schachbrettmuster
    ctx.fillStyle = colors.grid;
    for (let y = 0; y < GRID; y++) {
      for (let x = (y % 2); x < GRID; x += 2) {
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    // Futter (leicht pulsierend)
    if (state.food) {
      const pulse = 0.8 + 0.08 * Math.sin(now / 160);
      const cx = (state.food.x + 0.5) * cell;
      const cy = (state.food.y + 0.5) * cell;
      ctx.fillStyle = colors.food;
      ctx.beginPath();
      ctx.arc(cx, cy, (cell / 2) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Schlange – zwischen den Ticks interpoliert für flüssige Bewegung
    const t = state.running ? Math.min(1, (now - state.lastTick) / state.tickMs) : 1;
    const pad = cell * 0.08;
    const len = state.snake.length;
    for (let i = len - 1; i >= 0; i--) {
      const cur = state.snake[i];
      const prev = state.prevSnake[i] || state.prevSnake[state.prevSnake.length - 1] || cur;
      let px = cur.x;
      let py = cur.y;
      // Nur interpolieren, wenn kein Sprung durch die Wand stattfindet
      if (Math.abs(cur.x - prev.x) <= 1 && Math.abs(cur.y - prev.y) <= 1) {
        px = prev.x + (cur.x - prev.x) * t;
        py = prev.y + (cur.y - prev.y) * t;
      }
      ctx.globalAlpha = i === 0 ? 1 : 0.55 + 0.45 * (1 - i / len);
      ctx.fillStyle = i === 0 ? colors.head : colors.snake;
      roundRect(px * cell + pad, py * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Augen
    if (len) {
      const h = state.snake[0];
      const hp = state.prevSnake[0] || h;
      let hx = h.x, hy = h.y;
      if (Math.abs(h.x - hp.x) <= 1 && Math.abs(h.y - hp.y) <= 1) {
        hx = hp.x + (h.x - hp.x) * t;
        hy = hp.y + (h.y - hp.y) * t;
      }
      const d = state.dir;
      const cx = (hx + 0.5) * cell;
      const cy = (hy + 0.5) * cell;
      const fwd = cell * 0.15;
      const side = cell * 0.18;
      ctx.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        const ex = cx + d.x * fwd + -d.y * side * s;
        const ey = cy + d.y * fwd + d.x * side * s;
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---------- Hauptschleife ----------
  function loop(now) {
    if (state.running) {
      while (state.running && now - state.lastTick >= state.tickMs) {
        state.lastTick += state.tickMs;
        step();
      }
    }
    draw(now);
    requestAnimationFrame(loop);
  }

  // ---------- Eingaben ----------
  document.addEventListener("keydown", (e) => {
    const dir = KEYMAP[e.code];
    if (dir) {
      e.preventDefault();
      if (state.running) queueDirection(dir);
      return;
    }
    if (e.code === "Space" || e.code === "KeyP") {
      e.preventDefault();
      if (state.running || state.paused) togglePause();
      else onPrimaryAction();
    } else if (e.code === "Enter" && !state.running) {
      e.preventDefault();
      onPrimaryAction();
    }
  });

  startBtn.addEventListener("click", onPrimaryAction);
  pauseBtn.addEventListener("click", () => {
    if (state.running || state.paused) togglePause();
    else onPrimaryAction();
  });

  document.querySelectorAll(".dpad [data-dir]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state.running) queueDirection(btn.dataset.dir);
    });
  });

  // Wischgesten auf dem Spielfeld
  let touchStart = null;
  const boardWrap = canvas.parentElement;
  boardWrap.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  boardWrap.addEventListener("touchmove", (e) => {
    if (!touchStart || !state.running) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? "right" : "left");
    else queueDirection(dy > 0 ? "down" : "up");
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  boardWrap.addEventListener("touchend", () => { touchStart = null; });

  // Pausieren, wenn der Tab in den Hintergrund geht
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running) togglePause();
  });

  // ---------- Init ----------
  reset();
  requestAnimationFrame(loop);
})();
