/* ═══════════════════════════════════════════════════════
   main.js  —  NoteNest application logic
   Responsibilities:
     1. Window manager  (open, close, minimise, focus, z-index)
     2. Window drag     (mouse + touch)
     3. Window resize   (corner handle)
     4. Launcher drag   (mouse + touch, edge-snap on release)
     5. Notes           (subject tabs, section rows, note cards)
     6. Planner         (filter pills, checkbox toggle, add task)
     7. Calendar        (render day grid)
     8. AI              (send message, suggestion chips)
═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────
   WINDOW MANAGER
───────────────────────────────────────────────────── */
let zTop = 200;

const WIN = {
  notes:    { el: null, open: false, initX: 80,  initY: 60  },
  todo:     { el: null, open: false, initX: -1,  initY: 60  },
  calendar: { el: null, open: false, initX: 80,  initY: -1  },
  ai:       { el: null, open: false, initX: -1,  initY: -1  },
};

function initWindowRegistry() {
  for (const [id, w] of Object.entries(WIN)) {
    w.el = document.getElementById('win-' + id);
    if (!w.el) continue;

    /* Calculate right/bottom-anchored positions after
       the element has a rendered size.                */
    const ew = w.el.offsetWidth  || 380;
    const eh = w.el.offsetHeight || 500;
    if (w.initX < 0) w.initX = Math.max(0, window.innerWidth  - ew - 80);
    if (w.initY < 0) w.initY = Math.max(0, window.innerHeight - eh - 80);

    w.el.style.left = w.initX + 'px';
    w.el.style.top  = w.initY + 'px';

    w.el.addEventListener('mousedown',  () => focusWin(w.el));
    w.el.addEventListener('touchstart', () => focusWin(w.el), { passive: true });
  }
}

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

/* Called by onclick attributes on launcher buttons */
function toggleWindow(id) {            /* exported to global scope */
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
}

function setLaunchActive(id, active) {
  const btn = document.getElementById('launch-' + id);
  if (btn) btn.classList.toggle('is-active', active);
}

/* Delegated handler for close / minimise chrome buttons */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-win-action]');
  if (!btn) return;
  const action = btn.dataset.winAction;
  const id     = btn.dataset.winId;
  if (action === 'close')    closeWin(id);
  if (action === 'minimise') minimiseWin(id);
});

/* ─────────────────────────────────────────────────────
   WINDOW DRAG
───────────────────────────────────────────────────── */
function initWindowDrag() {
  document.querySelectorAll('.win-bar').forEach(bar => {
    const win = bar.closest('.win');
    let active = false, ox = 0, oy = 0;

    function onStart(e) {
      if (e.target.closest('.win-bar__controls')) return;
      active = true;
      const r  = win.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      ox = cx - r.left;
      oy = cy - r.top;
      focusWin(win);
      e.preventDefault();
    }
    function onMove(e) {
      if (!active) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      win.style.left = clamp(cx - ox, 0, window.innerWidth  - win.offsetWidth)  + 'px';
      win.style.top  = clamp(cy - oy, 0, window.innerHeight - win.offsetHeight) + 'px';
    }
    function onEnd() { active = false; }

    bar.addEventListener('mousedown',  onStart);
    bar.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove',  onMove);
    document.addEventListener('touchmove',  onMove, { passive: false });
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchend',   onEnd);
  });
}

/* ─────────────────────────────────────────────────────
   WINDOW RESIZE
───────────────────────────────────────────────────── */
function initWindowResize() {
  document.querySelectorAll('.win-resizer').forEach(handle => {
    const win = handle.closest('.win');
    let active = false, sx = 0, sy = 0, sw = 0, sh = 0;

    handle.addEventListener('mousedown', e => {
      active = true;
      sx = e.clientX; sy = e.clientY;
      sw = win.offsetWidth; sh = win.offsetHeight;
      focusWin(win);
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!active) return;
      win.style.width  = Math.max(280, sw + (e.clientX - sx)) + 'px';
      win.style.height = Math.max(200, sh + (e.clientY - sy)) + 'px';
    });
    document.addEventListener('mouseup', () => { active = false; });
  });
}

/* ─────────────────────────────────────────────────────
   LAUNCHER DRAG
───────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────
   NOTES — Subject tabs
───────────────────────────────────────────────────── */
function initSubjectTabs() {
  document.querySelectorAll('.subject-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
    });
  });
}

/* ─────────────────────────────────────────────────────
   NOTES — Section rows + note cards
───────────────────────────────────────────────────── */
function initNoteList() {
  document.querySelectorAll('.section-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.section-row').forEach(r => r.classList.remove('is-active'));
      row.classList.add('is-active');
    });
  });
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.note-card').forEach(c => c.classList.remove('is-active'));
      card.classList.add('is-active');
    });
  });
  document.querySelector('.note-list__new')?.addEventListener('click', () => {
    document.querySelector('.note-editor__title').value   = '';
    document.querySelector('.note-editor__content').value = '';
    document.querySelector('.note-editor__title').focus();
  });
}

/* ─────────────────────────────────────────────────────
   PLANNER — Filter pills
───────────────────────────────────────────────────── */
function initFilterPills() {
  document.querySelectorAll('.todo-filter').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.todo-filter').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
    });
  });
}

/* ─────────────────────────────────────────────────────
   PLANNER — Checkbox toggle
───────────────────────────────────────────────────── */
function initTaskChecks() {
  document.querySelectorAll('.task-check').forEach(check => {
    check.addEventListener('click', e => {
      e.stopPropagation();
      check.closest('.task-row').classList.toggle('is-done');
    });
  });
}

/* ─────────────────────────────────────────────────────
   PLANNER — Add task
───────────────────────────────────────────────────── */
function initTodoAdd() {
  const input  = document.querySelector('.todo-input');
  const submit = document.querySelector('.todo-submit');
  if (!input || !submit) return;

  function addTask() {
    const text = input.value.trim();
    if (!text) return;

    const row = document.createElement('div');
    row.className = 'list-row task-row';
    row.innerHTML = `
      <div class="priority-dot priority-dot--low"></div>
      <div class="task-check"><i class="ri-check-line"></i></div>
      <div class="task-row__body">
        <div class="task-row__text">${escHtml(text)}</div>
        <div class="task-row__due">
          <i class="ri-calendar-line"></i>
          <span class="label-micro">Today</span>
        </div>
      </div>`;
    row.querySelector('.task-check').addEventListener('click', e => {
      e.stopPropagation();
      row.classList.toggle('is-done');
    });

    const list = document.querySelector('.todo-list');
    list.appendChild(row);
    input.value = '';
    list.scrollTop = list.scrollHeight;
  }

  submit.addEventListener('click', addTask);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
}

/* ─────────────────────────────────────────────────────
   CALENDAR — Render day grid
───────────────────────────────────────────────────── */
function renderCalendar() {
  const today = new Date(2026, 3, 18);   /* April 18 2026 */
  const y = today.getFullYear(), m = today.getMonth();
  const firstDay    = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();
  const eventDays   = new Set([16, 24, 30]);
  const grid        = document.getElementById('cal-days');
  if (!grid) return;

  grid.innerHTML = '';

  /* Filler cells from the previous month */
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(makeDay(prevMonthDays - firstDay + i + 1, true, false, false));
  }
  /* Current month days */
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(makeDay(d, false, d === today.getDate(), eventDays.has(d)));
  }
}

function makeDay(num, otherMonth, isToday, hasEvent) {
  const div = document.createElement('div');
  div.className = 'cal-day'
    + (otherMonth ? ' is-other-month' : '')
    + (isToday    ? ' is-today'       : '');
  div.innerHTML =
    `<span class="cal-day__num">${num}</span>` +
    (hasEvent ? '<div class="cal-day__dot"></div>' : '');
  div.addEventListener('click', () => {
    document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('is-selected'));
    div.classList.add('is-selected');
  });
  return div;
}

/* ─────────────────────────────────────────────────────
   AI — Send message
───────────────────────────────────────────────────── */
function initAiInput() {
  const input  = document.getElementById('ai-input');
  const submit = document.getElementById('ai-send');
  if (!input || !submit) return;

  submit.addEventListener('click', sendAiMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
  });

  document.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent.trim();
      sendAiMessage();
    });
  });
}

const AI_REPLIES = [
  'Based on your Chemistry notes, the key distinction here lies in the timing of bond formation and breaking during the reaction.',
  'Your Organic section has several related notes on this topic — would you like me to cross-reference them?',
  'I can generate five practice questions from your current note. Shall I add them as a new note?',
  'This term appears across three of your subjects. Here is how each context defines it differently.',
  'Looking at your Thermodynamics notes, the concept you\'re asking about connects directly to what you wrote on April 15.',
];

function sendAiMessage() {
  const input = document.getElementById('ai-input');
  const msgs  = document.getElementById('ai-messages');
  const text  = input.value.trim();
  if (!text) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  appendAiMsg(msgs, text, 'user', now);
  input.value = '';

  setTimeout(() => {
    const reply = AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)];
    appendAiMsg(msgs, reply, 'assistant', now);
    msgs.scrollTop = msgs.scrollHeight;
  }, 650);

  msgs.scrollTop = msgs.scrollHeight;
}

function appendAiMsg(container, text, role, time) {
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg--${role}`;
  div.innerHTML =
    `<div class="ai-bubble">${escHtml(text)}</div>` +
    `<div class="label-micro">${time}</div>`;
  container.appendChild(div);
}

/* ─────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────── */
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

function escHtml(s) {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/* ─────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initWindowRegistry();
  initWindowDrag();
  initWindowResize();
  initLauncherDrag();
  initSubjectTabs();
  initNoteList();
  initFilterPills();
  initTaskChecks();
  initTodoAdd();
  initAiInput();
  renderCalendar();

  /* Open Notes and Planner by default with a brief stagger */
  setTimeout(() => openWin('notes'),    80);
  setTimeout(() => openWin('todo'),    220);
});
