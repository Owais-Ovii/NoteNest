/* ═══════════════════════════════════════════════════════
   main.js  —  NoteNest parent window manager
═══════════════════════════════════════════════════════ */
'use strict';

let zTop = 200;

const WIN = {
  notes:    { el: null, open: false, initX: 0, initY: 0, initW: 0, initH: 0, loaded: false },
  todo:     { el: null, open: false, initX: 0, initY: 0, initW: 0, initH: 0, loaded: false },
  calendar: { el: null, open: false, initX: 0, initY: 0, initW: 0, initH: 0, loaded: false },
  ai:       { el: null, open: false, initX: 0, initY: 0, initW: 0, initH: 0, loaded: false },
};

function calcLayout() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const margin = 20;            // gap from screen edges and between windows
  const notesWidth = Math.floor(W * 0.75) - margin * 1.5;
  const sideWidth = W - notesWidth - margin * 3;   // remaining space for right column
  const sideHeight = H - margin * 2;
  const halfHeight = Math.floor((sideHeight - margin) / 2);

  // Notes
  WIN.notes.initX = margin;
  WIN.notes.initY = margin;
  WIN.notes.initW = notesWidth;
  WIN.notes.initH = sideHeight;

  // Planner (top right)
  WIN.todo.initX = notesWidth + margin * 2;
  WIN.todo.initY = margin;
  WIN.todo.initW = sideWidth;
  WIN.todo.initH = halfHeight;

  // AI (bottom right)
  WIN.ai.initX = notesWidth + margin * 2;
  WIN.ai.initY = margin + halfHeight + margin;
  WIN.ai.initW = sideWidth;
  WIN.ai.initH = halfHeight;

  // Calendar (centered, not shown by default)
  WIN.calendar.initX = Math.floor((W - 400) / 2);
  WIN.calendar.initY = Math.floor((H - 435) / 2);
  WIN.calendar.initW = 400;
  WIN.calendar.initH = 435;
}

function initWindowRegistry() {
  calcLayout();

  for (const [id, w] of Object.entries(WIN)) {
    w.el = document.getElementById('win-' + id);
    if (!w.el) continue;

    // Apply initial size and position
    w.el.style.left = w.initX + 'px';
    w.el.style.top  = w.initY + 'px';
    w.el.style.width  = (w.initW || 380) + 'px';
    w.el.style.height = (w.initH || 500) + 'px';

    w.el.addEventListener('mousedown',  () => focusWin(w.el));
    w.el.addEventListener('touchstart', () => focusWin(w.el), { passive: true });
  }
}

// … rest of functions unchanged (focusWin, openWin, closeWin, etc.) …

function openWin(id) {
  const w = WIN[id];
  if (!w?.el) return;
  // Apply stored size/position if not already set
  if (!w.el.style.width)  w.el.style.width  = (w.initW || 380) + 'px';
  if (!w.el.style.height) w.el.style.height = (w.initH || 500) + 'px';
  w.el.style.display = 'flex';
  w.el.classList.remove('win--minimized');
  w.open = true;
  focusWin(w.el);
  setLaunchActive(id, true);

  if (!w.loaded) {
    const iframe = w.el.querySelector('.win-iframe');
    if (iframe && iframe.dataset.src) {
      iframe.src = iframe.dataset.src;
      w.loaded = true;
    }
  }
}

// … rest of the file stays the same …

window.addEventListener('DOMContentLoaded', () => {
  initWindowRegistry();
  initWindowDrag();
  initWindowResize();
  initLauncherDrag();

  // Open Notes, Planner, and AI by default (Calendar stays closed)
  setTimeout(() => {
    openWin('notes');
    openWin('todo');
    openWin('ai');
  }, 80);
});

function focusWin(el) {
  document.querySelectorAll('.win').forEach(w => w.classList.remove('win--focused'));
  el.style.zIndex = ++zTop;
  el.classList.add('win--focused');
}

function openWin(id) {
  const w = WIN[id];
  if (!w?.el) return;
  w.el.style.display = 'flex';
  w.el.classList.remove('win--minimized');
  w.open = true;
  focusWin(w.el);
  setLaunchActive(id, true);

  if (!w.loaded) {
    const iframe = w.el.querySelector('.win-iframe');
    if (iframe && iframe.dataset.src) {
      iframe.src = iframe.dataset.src;
      w.loaded = true;
    }
  }
}

function closeWin(id) {
  const w = WIN[id];
  if (!w?.el) return;
  w.el.style.display = 'none';
  w.open = false;
  setLaunchActive(id, false);
}

function minimiseWin(id) {
  const w = WIN[id];
  if (!w?.el) return;
  w.el.classList.toggle('win--minimized');
}

window.toggleWindow = function(id) {
  const w = WIN[id];
  if (!w?.el) return;
  if (!w.open) {
    openWin(id);
  } else if (w.el.classList.contains('win--minimized')) {
    w.el.classList.remove('win--minimized');
    focusWin(w.el);
  } else {
    closeWin(id);
  }
};

function setLaunchActive(id, active) {
  const btn = document.getElementById('launch-' + id);
  if (btn) btn.classList.toggle('is-active', active);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-win-action]');
  if (!btn) return;
  const action = btn.dataset.winAction;
  const id     = btn.dataset.winId;
  if (action === 'close')    closeWin(id);
  if (action === 'minimise') minimiseWin(id);
  if (action === 'popout') {
    const win = WIN[id];
    if (!win?.el) return;
    const iframe = win.el.querySelector('.win-iframe');
    const src = iframe?.src || iframe?.dataset.src || '';
    if (src) window.open(src, '_blank');
  }
});

/* ── Window drag (rAF optimised) ── */
function initWindowDrag() {
  document.querySelectorAll('.win-bar').forEach(bar => {
    const win = bar.closest('.win');
    let active = false, ox = 0, oy = 0, lastX = 0, lastY = 0, rafId = null;

    function applyDrag() {
      win.style.left = clamp(lastX - ox, 0, window.innerWidth  - win.offsetWidth)  + 'px';
      win.style.top  = clamp(lastY - oy, 0, window.innerHeight - win.offsetHeight) + 'px';
      rafId = null;
    }

    function onStart(e) {
      if (e.target.closest('.win-bar__controls')) return;
      active = true;
      const r = win.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      ox = cx - r.left;
      oy = cy - r.top;
      lastX = cx;
      lastY = cy;
      focusWin(win);
      e.preventDefault();
    }

    function onMove(e) {
      if (!active) return;
      lastX = e.touches ? e.touches[0].clientX : e.clientX;
      lastY = e.touches ? e.touches[0].clientY : e.clientY;
      if (!rafId) rafId = requestAnimationFrame(applyDrag);
    }

    function onEnd() {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    bar.addEventListener('mousedown',  onStart);
    bar.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove',  onMove, { passive: true });
    document.addEventListener('touchmove',  onMove, { passive: false });
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchend',   onEnd);
  });
}

/* ── Window resize (rAF optimised) ── */
function initWindowResize() {
  document.querySelectorAll('.win-resizer').forEach(handle => {
    const win = handle.closest('.win');
    let active = false, startX = 0, startY = 0, startW = 0, startH = 0;
    let lastX = 0, lastY = 0, rafId = null;

    function applyResize() {
      win.style.width  = Math.max(280, startW + (lastX - startX)) + 'px';
      win.style.height = Math.max(200, startH + (lastY - startY)) + 'px';
      rafId = null;
    }

    handle.addEventListener('mousedown', e => {
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = win.offsetWidth;
      startH = win.offsetHeight;
      lastX = startX;
      lastY = startY;
      focusWin(win);
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!active) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(applyResize);
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    });
  });
}

/* ── Launcher drag ── */
function initLauncherDrag() {
  const launcher = document.getElementById('launcher');
  const handle   = launcher.querySelector('.launcher__handle');
  let active = false, ox = 0, oy = 0;

  function anchorFromFixed() {
    const r = launcher.getBoundingClientRect();
    launcher.style.left      = r.left + 'px';
    launcher.style.top       = r.top  + 'px';
    launcher.style.bottom    = 'auto';
    launcher.style.transform = 'none';
    return r;
  }

  function snapToEdge() {
    const r  = launcher.getBoundingClientRect();
    const W  = window.innerWidth, H = window.innerHeight;
    const mg = 60;
    let lx = r.left, ly = r.top;
    if (r.left   < mg)     lx = 10;
    if (r.right  > W - mg) lx = W - r.width  - 10;
    if (r.top    < mg)     ly = 10;
    if (r.bottom > H - mg) ly = H - r.height - 10;
    launcher.style.left = lx + 'px';
    launcher.style.top  = ly + 'px';
  }

  handle.addEventListener('mousedown', e => {
    active = true;
    const r = anchorFromFixed();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });
  handle.addEventListener('touchstart', e => {
    active = true;
    const r = anchorFromFixed();
    ox = e.touches[0].clientX - r.left;
    oy = e.touches[0].clientY - r.top;
  }, { passive: false });

  document.addEventListener('mousemove', e => {
    if (!active) return;
    launcher.style.left = clamp(e.clientX - ox, 0, window.innerWidth  - launcher.offsetWidth)  + 'px';
    launcher.style.top  = clamp(e.clientY - oy, 0, window.innerHeight - launcher.offsetHeight) + 'px';
  });
  document.addEventListener('touchmove', e => {
    if (!active) return;
    launcher.style.left = clamp(e.touches[0].clientX - ox, 0, window.innerWidth  - launcher.offsetWidth)  + 'px';
    launcher.style.top  = clamp(e.touches[0].clientY - oy, 0, window.innerHeight - launcher.offsetHeight) + 'px';
  }, { passive: false });

  document.addEventListener('mouseup',  () => { if (active) { active = false; snapToEdge(); } });
  document.addEventListener('touchend', () => { if (active) { active = false; snapToEdge(); } });
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

window.addEventListener('DOMContentLoaded', () => {
  initWindowRegistry();
  initWindowDrag();
  initWindowResize();
  initLauncherDrag();


  
  setTimeout(() => openWin('notes'),    80);
  setTimeout(() => openWin('todo'),    220);
  setTimeout(() => openWin('ai'),     360);   // if you have this
});