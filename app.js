/* ─────────────────────────────────────────────────────────────────────────────
   Learning Command Center — App.js
   Core logic: State, Timers, Kanban, Progress rings, Streaks, XP
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

// Global namespace (exposed for inline onclick handlers)
window.App = window.App || {};

/* ──────────────────────────────────────────────────────────────────────────
   STATE ENGINE — localStorage-backed
   ────────────────────────────────────────────────────────────────────────── */
const STATE_KEY = 'lcc_v1';

function defaultState() {
  const today = dateKey();
  return {
    startDate: today,            // ISO date string of Day 1
    currentViewDay: 1,           // which day's plan is shown
    xp: 0,
    streak: 0,
    lastCompletedDate: null,
    completedDays: {},           // { 'YYYY-MM-DD': true|false }
    dayData: {},                 // { 'YYYY-MM-DD': { tasks: { id: bool }, timers: { pillarId: seconds } } }
    kanban: {                    // { cardId: { title, sub, pillar, priority, col } }
      cards: {},
      nextId: 1,
    },
    badges: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(S));
}

let S = loadState();

/* ──────────────────────────────────────────────────────────────────────────
   DATE UTILITIES
   ────────────────────────────────────────────────────────────────────────── */
function dateKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

function todayKey() { return dateKey(); }

function dayNumberForDate(dateStr) {
  const start  = new Date(S.startDate);
  const target = new Date(dateStr);
  return Math.floor((target - start) / 86400000) + 1;
}

function computeCurrentDay() {
  return dayNumberForDate(todayKey());
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/* ──────────────────────────────────────────────────────────────────────────
   TOAST
   ────────────────────────────────────────────────────────────────────────── */
function toast(msg, icon = '✅') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ──────────────────────────────────────────────────────────────────────────
   XP & BADGES
   ────────────────────────────────────────────────────────────────────────── */
const BADGES_DEF = [
  { id: 'first_task',   icon: '🌱', name: 'First Step',    check: () => S.xp >= 10 },
  { id: 'day1_done',    icon: '🏆', name: 'Day 1 Hero',    check: () => S.completedDays && Object.keys(S.completedDays).length >= 1 },
  { id: 'streak3',      icon: '🔥', name: '3-Day Streak',  check: () => S.streak >= 3 },
  { id: 'streak7',      icon: '⚡', name: 'Week Warrior',  check: () => S.streak >= 7 },
  { id: 'xp100',        icon: '💎', name: '100 XP',        check: () => S.xp >= 100 },
  { id: 'xp500',        icon: '👑', name: '500 XP',        check: () => S.xp >= 500 },
  { id: 'all5pillars',  icon: '🌟', name: 'All 5 Active',  check: () => {
    const td = S.dayData[todayKey()];
    if (!td) return false;
    return PILLARS.every(p => (td.timers || {})[p.id] > 0);
  }},
  { id: 'day30',        icon: '🎓', name: '30-Day Grad',   check: () => computeCurrentDay() >= 30 },
];

function XP_PER_LEVEL(lvl) { return Math.floor(100 * Math.pow(1.3, lvl - 1)); }

function xpLevel() {
  let lvl = 1, rem = S.xp;
  while (rem >= XP_PER_LEVEL(lvl)) { rem -= XP_PER_LEVEL(lvl); lvl++; }
  return { level: lvl, xpInLevel: rem, xpNeeded: XP_PER_LEVEL(lvl) };
}

function addXP(pts) {
  S.xp += pts;
  checkBadges();
  saveState();
  renderTopbar();
  renderXP();
}

function checkBadges() {
  BADGES_DEF.forEach(b => {
    if (!S.badges.includes(b.id) && b.check()) {
      S.badges.push(b.id);
      toast(`Badge unlocked: ${b.icon} ${b.name}`, '🎉');
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   TOPBAR RENDER
   ────────────────────────────────────────────────────────────────────────── */
function renderTopbar() {
  document.getElementById('day-number').textContent  = computeCurrentDay();
  document.getElementById('streak-count').textContent = S.streak;
  document.getElementById('xp-count').textContent    = S.xp;
  document.getElementById('topbar-date').textContent  = formatDate();

  // Hours focused today
  const td = S.dayData[todayKey()] || {};
  const timers = td.timers || {};
  const totalSec = PILLARS.reduce((sum, p) => sum + (timers[p.id] || 0), 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  document.getElementById('hours-done').textContent = `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   PILLAR CARD RENDERING (Dashboard)
   ────────────────────────────────────────────────────────────────────────── */
function renderPillarCards() {
  const grid = document.getElementById('pillars-grid');
  grid.innerHTML = '';
  const today = todayKey();
  const td    = S.dayData[today] || {};
  const dayN  = computeCurrentDay();

  PILLARS.forEach(p => {
    const curr  = (CURRICULUM[p.id] || [])[dayN - 1] || { topic: 'Free study day', tasks: [] };
    const tasks = td.tasks || {};
    const done  = curr.tasks.filter((_, i) => tasks[`${today}_${p.id}_${i}`]).length;
    const total = curr.tasks.length || 1;
    const pct   = Math.round((done / total) * 100);
    const timerSec = (td.timers || {})[p.id] || 0;

    const timerKey = `timer_${p.id}`;
    const isRunning = App.timer.active === p.id;

    const card = document.createElement('div');
    card.className = 'pillar-card';
    card.setAttribute('data-pillar', p.id);
    card.setAttribute('id', `pillar-card-${p.id}`);
    card.style.setProperty('--pc', p.color);

    // Circumference = 2π × 22 = 138.23
    const C      = 138.23;
    const offset = C - (pct / 100) * C;

    card.innerHTML = `
      <div class="pillar-card-top">
        <div class="pillar-icon-wrap" style="--pc:${p.color}">${p.icon}</div>
        <div class="ring-container" title="${pct}% complete">
          <svg class="ring-svg" viewBox="0 0 52 52">
            <circle class="ring-bg" cx="26" cy="26" r="22"/>
            <circle class="ring-fg" id="ring-${p.id}" cx="26" cy="26" r="22"
              style="stroke:${p.color}; stroke-dashoffset:${offset};"/>
          </svg>
          <div class="ring-pct" style="color:${p.color}">${pct}%</div>
        </div>
      </div>
      <div class="pillar-name">${p.icon} ${p.name}</div>
      <div class="pillar-topic">${curr.topic}</div>
      <div class="pillar-hours">⏰ ${p.dailyHours}h/day · ${done}/${total} tasks</div>
      <div class="pillar-timer">
        <div class="timer-display" id="timer-disp-${p.id}">${formatTimer(isRunning ? App.timer.remaining : timerSec)}</div>
        <div class="timer-controls">
          <button class="timer-btn" id="timer-start-${p.id}" onclick="App.timer.toggle('${p.id}')" title="${isRunning ? 'Pause' : 'Start'} Pomodoro">
            ${isRunning ? '⏸' : '▶'}
          </button>
          <button class="timer-btn" onclick="App.timer.reset('${p.id}')" title="Reset timer">↺</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  renderOverallProgress();
}

function renderOverallProgress() {
  const today = todayKey();
  const td    = S.dayData[today] || {};
  const dayN  = computeCurrentDay();
  const tasks = td.tasks || {};

  let totalTasks = 0, doneTasks = 0;
  PILLARS.forEach(p => {
    const curr = (CURRICULUM[p.id] || [])[dayN - 1] || { tasks: [] };
    totalTasks += curr.tasks.length;
    doneTasks  += curr.tasks.filter((_, i) => tasks[`${today}_${p.id}_${i}`]).length;
  });

  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  document.getElementById('pct-overall').textContent            = `${pct}%`;
  document.getElementById('tasks-done-count').textContent       = `${doneTasks}/${totalTasks}`;
  document.getElementById('progress-bar-overall').style.width   = `${pct}%`;
  document.getElementById('progress-bar-overall').setAttribute('aria-valuenow', pct);

  const timers  = td.timers || {};
  const totalSec = PILLARS.reduce((sum, p) => sum + (timers[p.id] || 0), 0);
  const h  = Math.floor(totalSec / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);
  document.getElementById('time-spent').textContent = `${h}h ${m}m`;
  document.getElementById('overall-sub').textContent = pct === 0
    ? 'Start your first session to track progress'
    : pct === 100 ? '🎉 Day complete! Amazing work!' : `${pct}% through today's plan`;
}

/* ──────────────────────────────────────────────────────────────────────────
   POMODORO TIMER
   ────────────────────────────────────────────────────────────────────────── */
const POMODORO_SECS = 25 * 60;

function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

App.timer = (() => {
  let active    = null;
  let remaining = POMODORO_SECS;
  let interval  = null;
  let elapsed   = 0;

  function toggle(pillarId) {
    if (active === pillarId) {
      pause();
    } else {
      if (active) pause();
      start(pillarId);
    }
  }

  function start(pillarId) {
    active    = pillarId;
    remaining = POMODORO_SECS;
    elapsed   = 0;
    interval  = setInterval(tick, 1000);
    updateBtn(pillarId, '⏸');
    toast(`${PILLARS.find(p=>p.id===pillarId).icon} Pomodoro started for ${PILLARS.find(p=>p.id===pillarId).name}!`, '⏱️');
  }

  function pause() {
    clearInterval(interval);
    const pillarId = active;
    active = null;
    updateBtn(pillarId, '▶');
  }

  function reset(pillarId) {
    if (active === pillarId) pause();
    remaining = POMODORO_SECS;
    const disp = document.getElementById(`timer-disp-${pillarId}`);
    if (disp) disp.textContent = formatTimer(POMODORO_SECS);
  }

  function tick() {
    remaining--;
    elapsed++;

    // Persist timer seconds to state every 10 seconds
    if (elapsed % 10 === 0) {
      const today = todayKey();
      if (!S.dayData[today]) S.dayData[today] = {};
      if (!S.dayData[today].timers) S.dayData[today].timers = {};
      S.dayData[today].timers[active] = (S.dayData[today].timers[active] || 0) + 10;
      saveState();
      renderTopbar();
    }

    const disp = document.getElementById(`timer-disp-${active}`);
    if (disp) disp.textContent = formatTimer(remaining);

    if (remaining <= 0) {
      // Session done!
      const pillar = PILLARS.find(p => p.id === active);
      const today  = todayKey();
      if (!S.dayData[today]) S.dayData[today] = {};
      if (!S.dayData[today].timers) S.dayData[today].timers = {};
      
      const loggedSeconds = (remaining < 0 ? elapsed : elapsed);
      S.dayData[today].timers[active] = (S.dayData[today].timers[active] || 0) + loggedSeconds;
      
      // Async Notion Sync: Log Session Hours
      syncNotion('log_session', {
        pillar: active,
        hours: parseFloat((loggedSeconds / 3600).toFixed(2)),
        day: computeCurrentDay()
      });

      addXP(50);
      pause();
      toast(`🎉 Pomodoro complete! +50 XP for ${pillar.icon} ${pillar.name}`, '⭐');
      renderPillarCards();
    }
  }

  function updateBtn(pillarId, symbol) {
    const btn = document.getElementById(`timer-start-${pillarId}`);
    if (btn) btn.textContent = symbol;
  }

  return { toggle, start, pause, reset, get active() { return active; }, get remaining() { return remaining; } };
})();

/* ──────────────────────────────────────────────────────────────────────────
   TODAY'S PLAN — Schedule Rendering
   ────────────────────────────────────────────────────────────────────────── */
const SCHEDULE_CONFIG = [
  { pillar: 'articulation', start: '09:00', duration: '1h 00m' },
  { pillar: 'databricks',   start: '10:15', duration: '2h 00m' },
  { pillar: 'mean',         start: '12:30', duration: '2h 00m' },
  { pillar: 'ai',           start: '14:45', duration: '1h 30m' },
  { pillar: 'project',      start: '16:30', duration: '1h 30m' },
];

function renderSchedule(dayN) {
  const grid  = document.getElementById('schedule-grid');
  const today = addDays(S.startDate, dayN - 1);
  const td    = S.dayData[today] || {};
  const tasks = td.tasks || {};

  document.getElementById('plan-day-label').textContent  = `Day ${dayN}`;
  document.getElementById('plan-date-label').textContent = formatDate(new Date(today + 'T12:00:00'));

  grid.innerHTML = '';

  SCHEDULE_CONFIG.forEach(sc => {
    const p    = PILLARS.find(x => x.id === sc.pillar);
    const curr = (CURRICULUM[sc.pillar] || [])[dayN - 1] || { topic: 'Free study day', tasks: [] };

    const tasksHtml = curr.tasks.map((t, i) => {
      const key  = `${today}_${sc.pillar}_${i}`;
      const done = !!tasks[key];
      return `
        <li class="sc-task ${done ? 'done' : ''}" onclick="App.plan.toggleTask('${today}','${sc.pillar}',${i}, this)" id="sctask-${sc.pillar}-${i}">
          <div class="sc-task-check">${done ? '✓' : ''}</div>
          <span class="sc-task-text">${t}</span>
        </li>`;
    }).join('');

    const allDone = curr.tasks.length > 0 && curr.tasks.every((_, i) => !!tasks[`${today}_${sc.pillar}_${i}`]);

    const block = document.createElement('div');
    block.className = 'schedule-block';
    block.innerHTML = `
      <div class="schedule-time">
        <div class="schedule-time-text">${sc.start}</div>
        <div class="schedule-break-text">${sc.duration}</div>
      </div>
      <div class="schedule-card ${allDone ? 'completed' : ''}" style="--pc:${p.color}" data-pillar="${sc.pillar}">
        <div class="sc-top">
          <span class="sc-pillar-badge" style="--pc:${p.color}">${p.icon} ${p.name}</span>
          <span class="sc-duration">${sc.duration}</span>
        </div>
        <div class="sc-topic">${curr.topic}</div>
        <ul class="sc-tasks">${tasksHtml}</ul>
      </div>`;
    grid.appendChild(block);
  });
}

App.plan = (() => {
  let viewDay = S.currentViewDay || computeCurrentDay();

  function init() {
    document.getElementById('plan-prev').addEventListener('click', () => { if (viewDay > 1) { viewDay--; S.currentViewDay = viewDay; saveState(); renderSchedule(viewDay); }});
    document.getElementById('plan-next').addEventListener('click', () => { if (viewDay < 30) { viewDay++; S.currentViewDay = viewDay; saveState(); renderSchedule(viewDay); }});
    renderSchedule(viewDay);
  }

  function toggleTask(dateStr, pillarId, idx, elLi) {
    if (!S.dayData[dateStr]) S.dayData[dateStr] = {};
    if (!S.dayData[dateStr].tasks) S.dayData[dateStr].tasks = {};
    const key     = `${dateStr}_${pillarId}_${idx}`;
    const wasTrue = S.dayData[dateStr].tasks[key];
    S.dayData[dateStr].tasks[key] = !wasTrue;
    if (!wasTrue) addXP(10);
    
    // Async Notion Sync: Mark Task status in Curriculum
    syncNotion('mark_task_done', { 
      pillar: pillarId, 
      day: computeCurrentDay(), 
      status: !wasTrue ? 'Completed' : 'In Progress' 
    });

    saveState();
    // Update UI
    elLi.classList.toggle('done', !wasTrue);
    const chk = elLi.querySelector('.sc-task-check');
    chk.textContent = !wasTrue ? '✓' : '';
    // Update parent card
    const card = elLi.closest('.schedule-card');
    const allItems = card.querySelectorAll('.sc-task');
    const allDone  = Array.from(allItems).every(li => li.classList.contains('done'));
    card.classList.toggle('completed', allDone);
    renderOverallProgress();
    renderPillarCards();
  }

  return { init, toggleTask };
})();

/* ──────────────────────────────────────────────────────────────────────────
   KANBAN BOARD
   ────────────────────────────────────────────────────────────────────────── */
App.kanban = (() => {
  let activePillar = 'all';
  let draggedId    = null;
  let defaultCol   = 'todo';

  function init() {
    // Build pillar filter tabs
    const tabBar = document.getElementById('kanban-pillar-tabs');
    PILLARS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'kp-tab';
      btn.setAttribute('data-kpillar', p.id);
      btn.style.setProperty('--pc', p.color);
      btn.textContent = `${p.icon} ${p.name}`;
      btn.addEventListener('click', () => filterByPillar(p.id, btn));
      tabBar.appendChild(btn);
    });

    // "All" tab
    tabBar.querySelector('[data-kpillar="all"]').addEventListener('click', (e) => filterByPillar('all', e.target));

    // Add card button
    document.getElementById('open-add-card').addEventListener('click', () => openAdd('todo'));
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveCard);

    // Seed default cards from Day 1 curriculum if empty
    if (Object.keys(S.kanban.cards).length === 0) seedDefault();

    renderBoard();
  }

  function seedDefault() {
    const dayN = computeCurrentDay();
    PILLARS.forEach((p, pi) => {
      const curr = (CURRICULUM[p.id] || [])[dayN - 1] || { topic: '', tasks: [] };
      curr.tasks.slice(0, 3).forEach((t, i) => {
        addCard({ title: t, sub: curr.topic, pillar: p.id, priority: i === 0 ? 'high' : 'med', col: 'todo' });
      });
    });
  }

  function addCard(def) {
    const id = `card_${S.kanban.nextId++}`;
    S.kanban.cards[id] = { ...def };
    saveState();
    return id;
  }

  function filterByPillar(pillarId, btn) {
    activePillar = pillarId;
    document.querySelectorAll('.kp-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBoard();
  }

  function renderBoard() {
    const cols = ['todo', 'inprogress', 'done'];
    cols.forEach(col => {
      const container = document.getElementById(`cards-${col}`);
      container.innerHTML = '';
      const matching = Object.entries(S.kanban.cards)
        .filter(([, c]) => c.col === col && (activePillar === 'all' || c.pillar === activePillar));
      matching.forEach(([id, card]) => container.appendChild(buildCardEl(id, card)));
      document.getElementById(`count-${col}`).textContent = matching.length;
    });
  }

  function buildCardEl(id, card) {
    const p = PILLARS.find(x => x.id === card.pillar) || PILLARS[0];
    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.id = `kcard-${id}`;
    div.setAttribute('draggable', 'true');
    div.style.setProperty('--pc', p.color);
    div.innerHTML = `
      <div class="kc-priority ${card.priority}">${card.priority === 'high' ? '🔴 High' : card.priority === 'med' ? '🔵 Med' : '🟢 Low'}</div>
      <div class="kc-title">${card.title}</div>
      ${card.sub ? `<div class="kc-sub">${p.icon} ${card.sub}</div>` : ''}
      <div class="kc-footer">
        <div class="kc-day">${p.name}</div>
        ${card.col !== 'done' ? `<div class="kc-check" onclick="App.kanban.markDone('${id}', this)" title="Mark done">✓</div>` : ''}
      </div>`;
    div.addEventListener('dragstart', () => { draggedId = id; div.classList.add('dragging'); });
    div.addEventListener('dragend',   () => { div.classList.remove('dragging'); renderBoard(); });
    return div;
  }

  function onDrop(event, col) {
    event.preventDefault();
    if (!draggedId) return;
    S.kanban.cards[draggedId].col = col;
    if (col === 'done') addXP(15);
    draggedId = null;
    saveState();
    renderBoard();
    renderOverallProgress();
  }

  function markDone(id, el) {
    S.kanban.cards[id].col = 'done';
    addXP(15);
    saveState();
    renderBoard();
    toast('Task moved to Done! +15 XP', '✅');
  }

  function openAdd(col) {
    defaultCol = col || 'todo';
    document.getElementById('modal-task-col').value = defaultCol;
    document.getElementById('modal-task-title').value = '';
    document.getElementById('modal-task-sub').value   = '';
    document.getElementById('modal-title').textContent = 'Add Task to Kanban';
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-task-title').focus();
  }

  function saveCard() {
    const title    = document.getElementById('modal-task-title').value.trim();
    const sub      = document.getElementById('modal-task-sub').value.trim();
    const pillar   = document.getElementById('modal-task-pillar').value;
    const priority = document.getElementById('modal-task-priority').value;
    const col      = document.getElementById('modal-task-col').value;
    if (!title) { toast('Please enter a task title', '⚠️'); return; }
    addCard({ title, sub, pillar, priority, col });
    closeModal();
    renderBoard();
    toast('Task added!', '✅');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  return { init, onDrop, markDone, openAdd, saveCard };
})();

/* ──────────────────────────────────────────────────────────────────────────
   PROGRESS TAB
   ────────────────────────────────────────────────────────────────────────── */
function renderProgressTab() {
  renderStreakGrid();
  renderPillarProgress();
  renderXP();
}

function renderStreakGrid() {
  const grid = document.getElementById('streak-grid');
  grid.innerHTML = '';
  const today = todayKey();
  for (let i = 29; i >= 0; i--) {
    const d   = addDays(todayKey(), -i);
    const div = document.createElement('div');
    div.className = 'streak-day';
    if (d === today) div.classList.add('today');
    if (S.completedDays[d]) div.classList.add('done', 'full');
    else if (S.dayData[d] && Object.keys(S.dayData[d].tasks || {}).some(k => S.dayData[d].tasks[k])) div.classList.add('done');
    div.title = d;
    grid.appendChild(div);
  }
}

function renderPillarProgress() {
  const list = document.getElementById('pillar-progress-list');
  const dayN = computeCurrentDay();
  const today= todayKey();
  const td   = S.dayData[today] || {};
  const tasks= td.tasks || {};

  document.getElementById('prog-day').textContent = dayN;
  list.innerHTML = '';

  PILLARS.forEach(p => {
    const curr  = (CURRICULUM[p.id] || [])[dayN - 1] || { tasks: [] };
    const done  = curr.tasks.filter((_, i) => !!tasks[`${today}_${p.id}_${i}`]).length;
    const total = curr.tasks.length || 1;
    const pct   = Math.round((done / total) * 100);

    const div = document.createElement('div');
    div.className = 'pp-item';
    div.style.setProperty('--pc', p.color);
    div.innerHTML = `
      <div class="pp-header">
        <div class="pp-name">${p.icon} ${p.name}</div>
        <div class="pp-stats">${done}/${total} tasks · ${pct}%</div>
      </div>
      <div class="pp-bar-wrap"><div class="pp-bar" style="width:${pct}%; background:${p.color}; box-shadow: 0 0 8px ${p.color};"></div></div>`;
    list.appendChild(div);
  });
}

function renderXP() {
  const { level, xpInLevel, xpNeeded } = xpLevel();
  document.getElementById('xp-level').textContent      = level;
  document.getElementById('xp-to-next').textContent    = xpNeeded - xpInLevel;
  document.getElementById('xp-total-display').textContent = `${S.xp} XP`;
  document.getElementById('xp-lvl-from').textContent   = level;
  document.getElementById('xp-lvl-to').textContent     = level + 1;
  document.getElementById('xp-bar-fill').style.width   = `${Math.round((xpInLevel / xpNeeded) * 100)}%`;

  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';
  BADGES_DEF.forEach(b => {
    const earned = S.badges.includes(b.id);
    const div = document.createElement('div');
    div.className = `badge ${earned ? 'earned' : ''}`;
    div.title = earned ? `${b.name} — Earned!` : `${b.name} — Not yet earned`;
    div.innerHTML = `<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div>`;
    grid.appendChild(div);
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   RESOURCES
   ────────────────────────────────────────────────────────────────────────── */
const RESOURCES = [
  // Articulation
  { pillar: 'articulation', title: 'Toastmasters International', desc: 'World\'s largest public speaking organization. Find a club near you or attend online.', url: 'https://www.toastmasters.org', label: 'Visit →' },
  { pillar: 'articulation', title: 'Speeko — Public Speaking App', desc: 'Guided daily speaking exercises on your phone. Great for building speaking habits.', url: 'https://speeko.co', label: 'Visit →' },
  { pillar: 'articulation', title: 'TED Talks — Communication Playlist', desc: '20 best TED talks on communication, confidence and storytelling.', url: 'https://www.ted.com/topics/communication', label: 'Watch →' },
  // Databricks
  { pillar: 'databricks', title: 'Databricks Academy', desc: 'Official free training: Apache Spark, Delta Lake, MLflow, and certification prep.', url: 'https://www.databricks.com/learn/training', label: 'Learn →' },
  { pillar: 'databricks', title: 'Databricks Community Edition', desc: 'Free cloud Databricks workspace — perfect for all exercises in this curriculum.', url: 'https://community.cloud.databricks.com', label: 'Sign Up →' },
  { pillar: 'databricks', title: 'Delta Lake Documentation', desc: 'Official Delta Lake docs: ACID transactions, Time Travel, OPTIMIZE, and ZORDER.', url: 'https://docs.delta.io', label: 'Read →' },
  // MEAN
  { pillar: 'mean', title: 'MongoDB University', desc: 'Free official courses on MongoDB CRUD, aggregation, Mongoose, and more.', url: 'https://university.mongodb.com', label: 'Enroll →' },
  { pillar: 'mean', title: 'Angular Official Docs', desc: 'Official Angular docs with tutorials on components, routing, forms, and NgRx.', url: 'https://angular.dev', label: 'Read →' },
  { pillar: 'mean', title: 'Node.js Best Practices', desc: 'goldbergyoni\'s comprehensive Node.js best practices guide on GitHub.', url: 'https://github.com/goldbergyoni/nodebestpractices', label: 'Read →' },
  // AI
  { pillar: 'ai', title: 'DeepLearning.AI Short Courses', desc: 'Free 1-2 hour courses on RAG, Agents, Prompt Engineering, LangChain and more.', url: 'https://www.deeplearning.ai/short-courses/', label: 'Learn →' },
  { pillar: 'ai', title: 'LangChain Documentation', desc: 'Official docs for building LLM applications, agents, and RAG pipelines.', url: 'https://python.langchain.com/docs/', label: 'Read →' },
  { pillar: 'ai', title: 'Hugging Face — Model Hub', desc: 'Access 300,000+ open source AI models: LLMs, embeddings, vision, and more.', url: 'https://huggingface.co', label: 'Explore →' },
  // Project
  { pillar: 'project', title: 'Product Hunt', desc: 'Launch your project here to get early users and feedback from the tech community.', url: 'https://www.producthunt.com', label: 'Visit →' },
  { pillar: 'project', title: 'Render — Free Hosting', desc: 'Deploy Node.js apps, PostgreSQL, Redis for free. Perfect for side projects.', url: 'https://render.com', label: 'Deploy →' },
  { pillar: 'project', title: 'Vercel — Frontend Hosting', desc: 'One-click deployment for your Angular/React frontend with CI/CD from GitHub.', url: 'https://vercel.com', label: 'Deploy →' },
];

function renderResources() {
  const grid = document.getElementById('resources-grid');
  grid.innerHTML = '';
  RESOURCES.forEach(r => {
    const p = PILLARS.find(x => x.id === r.pillar);
    const div = document.createElement('div');
    div.className = 'resource-card';
    div.style.setProperty('--pc', p.color);
    div.innerHTML = `
      <div class="res-tag" style="--pc:${p.color}">${p.icon} ${p.name}</div>
      <div class="res-title">${r.title}</div>
      <div class="res-desc">${r.desc}</div>
      <a class="res-link" href="${r.url}" target="_blank" rel="noopener" style="color:${p.color}">${r.label}</a>`;
    grid.appendChild(div);
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   MARK DAY COMPLETE
   ────────────────────────────────────────────────────────────────────────── */
function markDayComplete() {
  const today = todayKey();
  S.completedDays[today] = true;

  // Streak logic
  const yesterday = addDays(today, -1);
  if (S.lastCompletedDate === yesterday) {
    S.streak++;
  } else if (S.lastCompletedDate !== today) {
    S.streak = 1;
  }
  S.lastCompletedDate = today;
  addXP(100);
  
  // Async Notion Sync: Mark all of today's pillars as Completed
  syncNotion('complete_day', { day: computeCurrentDay() });

  saveState();
  renderTopbar();
  renderStreakGrid();
  toast('🎉 Day marked complete! +100 XP. Streak: ' + S.streak + '🔥', '🏆');
}

/* ──────────────────────────────────────────────────────────────────────────
   NAV TABS
   ────────────────────────────────────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      document.querySelectorAll('.nav-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tabId}`).classList.add('active');

      // Lazy render on tab open
      if (tabId === 'progress')   renderProgressTab();
      if (tabId === 'plan')       App.plan.init();
      if (tabId === 'resources')  renderResources();
    });
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   NOTION SYNC API BRIDGE
   ────────────────────────────────────────────────────────────────────────── */
async function syncNotion(action, payload) {
  try {
    const idsRes = await fetch('./notion/notion-ids.json');
    if (!idsRes.ok) return; // Silent skip if DB ids not generated locally yet
    const ids = await idsRes.json();
    
    await fetch('/api/notion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, ids })
    });
  } catch (err) {
    console.debug('Dashboard Notion Sync Skipped/Failed', err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   BOOTSTRAP
   ────────────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderTopbar();
  renderPillarCards();
  renderResources();
  App.plan.init();
  App.kanban.init();
  checkBadges();

  document.getElementById('mark-day-complete-btn').addEventListener('click', markDayComplete);

  // Close modal on overlay click
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') App.kanban.saveCard === undefined || document.getElementById('modal-overlay').classList.remove('open');
  });

  // Keyboard: Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('modal-overlay').classList.remove('open');
  });

  // Auto-save timer every 30s
  setInterval(() => { saveState(); }, 30000);

  // Real-time clock for topbar date
  setInterval(() => { document.getElementById('topbar-date').textContent = formatDate(); }, 60000);
});
