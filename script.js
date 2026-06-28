/* ============================================================
   HABIT TRACKER — Premium Digital Planner
   Vanilla JavaScript · LocalStorage · Firebase Realtime Database
   ============================================================ */

import {
  initFirebase,
  loadFromDatabase,
  saveToDatabase,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  firebaseIsReady,
  getCurrentUser,
  setRemoteUpdateHandler,
  setAuthChangeHandler,
  setSyncStatusHandler,
  enableRealtimeSync
} from './firebase-service.js';
import { isFirebaseConfigured } from './firebase-config.js';

(function () {
  'use strict';

  /* ---------- Constants ---------- */
  const STORAGE_KEY = 'habitTracker_v1';
  const DAILY_HABIT_COUNT = 30;
  const WEEKLY_HABIT_COUNT = 10;
  const WEEK_COUNT = 5;
  const CIRCLE_RADIUS = 34;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
  const RING_RADIUS = 52;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const WEEK_COLORS = ['week-1', 'week-2', 'week-3', 'week-4', 'week-5'];

  const DEFAULT_DAILY_NAMES = [
    'Morning meditation', 'Drink 8 glasses of water', 'Exercise 30 minutes',
    'Read for 20 minutes', 'Journal writing', 'Eat a healthy breakfast',
    'Take vitamins', 'Walk 10,000 steps', 'Stretch for 10 minutes',
    'No social media before noon', 'Practice gratitude', 'Make bed',
    'Deep work session', 'Review daily goals', 'Eat 5 servings of vegetables',
    'Call a friend or family', 'Learn something new', 'Practice a skill',
    'Tidy living space', 'Prepare tomorrow\'s outfit', 'Limit screen time',
    'Drink herbal tea', 'Practice mindfulness', 'Floss teeth',
    'Take a cold shower', 'Write tomorrow\'s plan', 'Listen to a podcast',
    'Creative time', 'Evening walk', 'Sleep by 10 PM'
  ];

  const DEFAULT_WEEKLY_NAMES = [
    'Meal prep Sunday', 'Deep clean one room', 'Review weekly goals',
    'Budget review', 'Long run or hike', 'Connect with mentor',
    'Plan next week', 'Declutter workspace', 'Family activity', 'Self-care ritual'
  ];

  const QUOTES = [
    { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
    { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
    { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
    { text: 'Your habits will determine your future.', author: 'Jack Canfield' },
    { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
    { text: 'The only bad workout is the one that didn\'t happen.', author: 'Unknown' },
    { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
    { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
    { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
    { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
    { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'Habits are the compound interest of self-improvement.', author: 'James Clear' },
    { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
    { text: 'First forget inspiration. Habit and persistence will get you to the finish.', author: 'Octavia Butler' },
    { text: 'The chains of habit are too weak to be felt until they are too strong to be broken.', author: 'Samuel Johnson' },
    { text: 'You\'ll never change your life until you change something you do daily.', author: 'Mike Murdock' },
    { text: 'Excellence is not a destination; it is a continuous journey that never ends.', author: 'Brian Tracy' },
    { text: 'The difference between who you are and who you want to be is what you do.', author: 'Unknown' },
    { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
    { text: 'Good habits are worth being fanatical about.', author: 'Seth Godin' },
    { text: 'Repetition is the mother of skill.', author: 'Tony Robbins' },
    { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
    { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb' },
    { text: 'Progress, not perfection.', author: 'Unknown' },
    { text: 'Your life does not get better by chance, it gets better by change.', author: 'Jim Rohn' },
    { text: 'Dream big. Start small. Act now.', author: 'Robin Sharma' },
    { text: 'Consistency is the key to achieving and maintaining momentum.', author: 'Darren Hardy' },
    { text: 'Make each day your masterpiece.', author: 'John Wooden' }
  ];

  /* ---------- State ---------- */
  let state = createDefaultState();
  let undoStack = [];
  let redoStack = [];
  let saveTimeout = null;
  let filterMode = 'all';
  let sortMode = 'default';
  let searchQuery = '';

  /* ---------- DOM References ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- Default State Factory ---------- */
  function createDefaultState() {
    const now = new Date();
    return {
      month: now.getMonth(),
      year: now.getFullYear(),
      theme: 'light',
      notes: ['', ''],
      journal: '',
      dailyHabits: DEFAULT_DAILY_NAMES.map((name, i) => ({
        id: 'd' + i,
        name,
        days: Array(31).fill(false)
      })),
      weeklyHabits: DEFAULT_WEEKLY_NAMES.map((name, i) => ({
        id: 'w' + i,
        name,
        weeks: Array(WEEK_COUNT).fill(false)
      }))
    };
  }

  /* ---------- Date Utilities ---------- */
  function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getTodayDayIndex() {
    const now = new Date();
    if (now.getMonth() === state.month && now.getFullYear() === state.year) {
      return now.getDate() - 1;
    }
    return -1;
  }

  function getWeekForDay(dayIndex) {
    return Math.floor(dayIndex / 7);
  }

  function getWeekDayRange(weekIndex, daysInMonth) {
    const start = weekIndex * 7;
    const end = Math.min(start + 7, daysInMonth);
    return { start, end };
  }

  function formatDate() {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatClock() {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning! Ready to build great habits today?';
    if (hour < 17) return 'Good afternoon! Keep the momentum going.';
    return 'Good evening! Reflect on today\'s wins.';
  }

  function getDailyQuoteIndex() {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today - new Date(today.getFullYear(), 0, 0)) / 86400000
    );
    return dayOfYear % QUOTES.length;
  }

  /* ---------- Undo / Redo ---------- */
  function pushUndo() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(undoStack.pop());
    saveState();
    renderAll();
    updateUndoRedoButtons();
    showToast('Undone');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    saveState();
    renderAll();
    updateUndoRedoButtons();
    showToast('Redone');
  }

  function updateUndoRedoButtons() {
    const undoBtn = $('#undoBtn');
    const redoBtn = $('#redoBtn');
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
  }

  /* ---------- LocalStorage & Firebase ---------- */
  /** RTDB often returns arrays as objects — normalize to real arrays */
  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => value[key]);
    }
    return null;
  }

  function normalizeBoolArray(value, length) {
    const arr = toArray(value);
    if (!arr) return Array(length).fill(false);
    return arr.map(Boolean).concat(Array(length).fill(false)).slice(0, length);
  }

  function normalizeDailyHabit(habit, index) {
    return {
      id: habit?.id || 'd' + index,
      name: typeof habit?.name === 'string' ? habit.name : 'Habit ' + (index + 1),
      days: normalizeBoolArray(habit?.days, 31)
    };
  }

  function normalizeWeeklyHabit(habit, index) {
    return {
      id: habit?.id || 'w' + index,
      name: typeof habit?.name === 'string' ? habit.name : 'Weekly habit ' + (index + 1),
      weeks: normalizeBoolArray(habit?.weeks, WEEK_COUNT)
    };
  }

  function normalizeCloudState(data) {
    if (!data || typeof data !== 'object') return null;

    const dailyRaw = toArray(data.dailyHabits);
    const weeklyRaw = toArray(data.weeklyHabits);
    const notesRaw = toArray(data.notes);

    const normalized = {
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0
    };

    if (typeof data.month === 'number') normalized.month = data.month;
    if (typeof data.year === 'number') normalized.year = data.year;
    if (data.theme === 'dark' || data.theme === 'light') normalized.theme = data.theme;
    if (typeof data.journal === 'string') normalized.journal = data.journal;
    if (notesRaw) normalized.notes = [notesRaw[0] || '', notesRaw[1] || ''];
    if (dailyRaw) normalized.dailyHabits = dailyRaw.map(normalizeDailyHabit);
    if (weeklyRaw) normalized.weeklyHabits = weeklyRaw.map(normalizeWeeklyHabit);

    return normalized;
  }

  function pickStateFields(data) {
    const normalized = normalizeCloudState(data) || {};
    const { updatedAt, ...fields } = normalized;
    return fields;
  }

  function applyRemoteState(data, skipCloudSave) {
    const normalized = normalizeCloudState(data);
    if (!normalized) return;

    const { updatedAt, ...fields } = normalized;
    state = { ...createDefaultState(), ...fields };
    ensureHabitCounts();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: updatedAt || Date.now() }));
    } catch (e) { /* ignore */ }
    populateMonthYearSelects();
    document.documentElement.setAttribute('data-theme', state.theme);
    renderAll();
    if (!skipCloudSave) showToast('Data synced from cloud');
  }

  function saveState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const payload = { ...state, updatedAt: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        flashAutosave('Saved');
      } catch (e) {
        showToast('Unable to save — storage may be full');
      }

      if (firebaseIsReady()) {
        await saveToDatabase(state);
      }
    }, 300);
  }

  function loadStateFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...createDefaultState(), ...pickStateFields(parsed) };
        ensureHabitCounts();
      }
    } catch (e) {
      state = createDefaultState();
    }
  }

  function getLocalUpdatedAt() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw).updatedAt || 0;
    } catch (e) { /* ignore */ }
    return 0;
  }

  function ensureHabitCounts() {
    if (!Array.isArray(state.dailyHabits)) state.dailyHabits = [];
    if (!Array.isArray(state.weeklyHabits)) state.weeklyHabits = [];
    if (!Array.isArray(state.notes)) state.notes = ['', ''];

    while (state.dailyHabits.length < DAILY_HABIT_COUNT) {
      const i = state.dailyHabits.length;
      state.dailyHabits.push({
        id: 'd' + i,
        name: 'New habit ' + (i + 1),
        days: Array(31).fill(false)
      });
    }
    while (state.weeklyHabits.length < WEEKLY_HABIT_COUNT) {
      const i = state.weeklyHabits.length;
      state.weeklyHabits.push({
        id: 'w' + i,
        name: 'New weekly habit ' + (i + 1),
        weeks: Array(WEEK_COUNT).fill(false)
      });
    }
    state.dailyHabits.forEach(h => {
      if (!h.days || h.days.length < 31) {
        h.days = [...(h.days || []), ...Array(31 - (h.days?.length || 0)).fill(false)].slice(0, 31);
      }
    });
    state.weeklyHabits.forEach(h => {
      if (!h.weeks || h.weeks.length < WEEK_COUNT) {
        h.weeks = [...(h.weeks || []), ...Array(WEEK_COUNT - (h.weeks?.length || 0)).fill(false)].slice(0, WEEK_COUNT);
      }
    });
  }

  function flashAutosave(message) {
    $$('.autosave-indicator').forEach(el => {
      el.classList.add('visible');
      el.textContent = message || 'Saved';
      setTimeout(() => el.classList.remove('visible'), 1500);
    });
  }

  /* ---------- Firebase UI ---------- */
  function updateSyncUI(status, message) {
    const dot = $('#syncStatusDot');
    const text = $('#syncStatusText');
    if (!dot || !text) return;

    dot.className = 'sync-status__dot sync-status__dot--' + status;
    text.textContent = message || status;

    if (status === 'synced') flashAutosave('Synced');
  }

  function updateAuthUI(user) {
    const authBtn = $('#authBtn');
    const userInfo = $('#authUserInfo');
    const signOutBtn = $('#authSignOutBtn');
    const authForm = $('#authForm');

    if (!authBtn) return;

    if (user && !user.isAnonymous) {
      authBtn.textContent = user.email || 'Account';
      if (userInfo) {
        userInfo.hidden = false;
        userInfo.textContent = 'Signed in as ' + (user.email || user.uid);
      }
      if (signOutBtn) signOutBtn.hidden = false;
      if (authForm) authForm.hidden = true;
    } else {
      authBtn.textContent = 'Sign In';
      if (userInfo) userInfo.hidden = true;
      if (signOutBtn) signOutBtn.hidden = true;
      if (authForm) authForm.hidden = false;
    }
  }

  function openAuthModal() {
    const modal = $('#authModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    $('#authEmail')?.focus();
  }

  function closeAuthModal() {
    const modal = $('#authModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    const err = $('#authError');
    if (err) err.hidden = true;
  }

  function showAuthError(msg) {
    const err = $('#authError');
    if (!err) return;
    err.textContent = msg;
    err.hidden = !msg;
  }

  async function handleAuthSignIn(e) {
    e.preventDefault();
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    showAuthError('');

    try {
      if (firebaseIsReady()) await saveToDatabase(state);
      const localBackup = JSON.parse(JSON.stringify(state));

      await signInWithEmail(email, password);
      closeAuthModal();
      showToast('Signed in — data will sync across devices');

      const cloudData = await loadFromDatabase();
      if (cloudData && normalizeCloudState(cloudData)?.updatedAt) {
        applyRemoteState(cloudData, true);
      } else {
        state = localBackup;
        ensureHabitCounts();
        await saveToDatabase(state);
        renderAll();
      }
      enableRealtimeSync();
    } catch (err) {
      showAuthError(getAuthErrorMessage(err));
    }
  }

  async function handleAuthSignUp() {
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    showAuthError('');

    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }

    try {
      await signUpWithEmail(email, password);
      await saveToDatabase(state);
      closeAuthModal();
      showToast('Account created — your data is now in the cloud');
      enableRealtimeSync();
    } catch (err) {
      showAuthError(getAuthErrorMessage(err));
    }
  }

  async function handleAuthSignOut() {
    try {
      await signOutUser();
      closeAuthModal();
      showToast('Signed out — using local anonymous session');
      enableRealtimeSync();
    } catch (err) {
      showAuthError(getAuthErrorMessage(err));
    }
  }

  function getAuthErrorMessage(err) {
    const code = err?.code || '';
    const messages = {
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'Email already in use. Try signing in.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/credential-already-in-use': 'This email is linked to another account.'
    };
    return messages[code] || err.message || 'Authentication failed.';
  }

  function bindAuthEvents() {
    $('#authBtn')?.addEventListener('click', openAuthModal);
    $('#authModalClose')?.addEventListener('click', closeAuthModal);
    $('#authModalBackdrop')?.addEventListener('click', closeAuthModal);
    $('#authForm')?.addEventListener('submit', handleAuthSignIn);
    $('#authSignUpBtn')?.addEventListener('click', handleAuthSignUp);
    $('#authSignOutBtn')?.addEventListener('click', handleAuthSignOut);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#authModal')?.hidden) closeAuthModal();
    });
  }

  /* ---------- Calculations ---------- */
  function getHabitProgress(habit, daysInMonth) {
    const completed = habit.days.slice(0, daysInMonth).filter(Boolean).length;
    const pct = daysInMonth > 0 ? Math.round((completed / daysInMonth) * 100) : 0;
    return { completed, remaining: daysInMonth - completed, pct };
  }

  function getWeeklyHabitProgress(habit) {
    const completed = habit.weeks.filter(Boolean).length;
    const pct = Math.round((completed / WEEK_COUNT) * 100);
    return { completed, remaining: WEEK_COUNT - completed, pct };
  }

  function getWeekProgress(weekIndex, daysInMonth) {
    const { start, end } = getWeekDayRange(weekIndex, daysInMonth);
    const dayCount = end - start;
    if (dayCount <= 0) return 0;

    let totalChecks = 0;
    let maxChecks = state.dailyHabits.length * dayCount;

    state.dailyHabits.forEach(h => {
      for (let d = start; d < end; d++) {
        if (h.days[d]) totalChecks++;
      }
    });

    return maxChecks > 0 ? Math.round((totalChecks / maxChecks) * 100) : 0;
  }

  function getDailySummaryForToday() {
    const todayIdx = getTodayDayIndex();
    if (todayIdx < 0) return { pct: 0, completed: 0, total: state.dailyHabits.length, streak: getCurrentStreak() };

    let completed = 0;
    state.dailyHabits.forEach(h => {
      if (h.days[todayIdx]) completed++;
    });

    const pct = Math.round((completed / state.dailyHabits.length) * 100);
    return { pct, completed, total: state.dailyHabits.length, streak: getCurrentStreak() };
  }

  function getMonthlyOverall(daysInMonth) {
    let totalChecks = 0;
    let maxChecks = state.dailyHabits.length * daysInMonth;

    state.dailyHabits.forEach(h => {
      for (let d = 0; d < daysInMonth; d++) {
        if (h.days[d]) totalChecks++;
      }
    });

    const pct = maxChecks > 0 ? Math.round((totalChecks / maxChecks) * 100) : 0;
    return { pct, completed: totalChecks, remaining: maxChecks - totalChecks };
  }

  function getBestWorstHabits(daysInMonth) {
    const ranked = state.dailyHabits.map(h => ({
      name: h.name,
      ...getHabitProgress(h, daysInMonth)
    })).sort((a, b) => b.pct - a.pct);

    return {
      best: ranked[0] || { name: '—', pct: 0 },
      worst: ranked[ranked.length - 1] || { name: '—', pct: 0 }
    };
  }

  function getLongestStreak(habit, daysInMonth) {
    let longest = 0;
    let current = 0;
    for (let d = 0; d < daysInMonth; d++) {
      if (habit.days[d]) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    return longest;
  }

  function getCurrentStreak() {
    const todayIdx = getTodayDayIndex();
    if (todayIdx < 0) return 0;

    let streak = 0;
    for (let d = todayIdx; d >= 0; d--) {
      const allDone = state.dailyHabits.every(h => h.days[d]);
      if (allDone) streak++;
      else break;
    }
    return streak;
  }

  function getLongestOverallStreak(daysInMonth) {
    let longest = 0;
    state.dailyHabits.forEach(h => {
      longest = Math.max(longest, getLongestStreak(h, daysInMonth));
    });
    return longest;
  }

  function getTopHabits(daysInMonth, limit = 10) {
    return state.dailyHabits
      .map(h => ({ name: h.name, id: h.id, ...getHabitProgress(h, daysInMonth) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, limit);
  }

  function getFilteredSortedHabits(habits, daysInMonth, type) {
    let list = habits.map((h, idx) => ({
      habit: h,
      idx,
      progress: type === 'daily' ? getHabitProgress(h, daysInMonth) : getWeeklyHabitProgress(h)
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.habit.name.toLowerCase().includes(q));
    }

    if (filterMode === 'completed') {
      list = list.filter(item => item.progress.pct === 100);
    } else if (filterMode === 'incomplete') {
      list = list.filter(item => item.progress.pct < 100);
    }

    if (sortMode === 'name') {
      list.sort((a, b) => a.habit.name.localeCompare(b.habit.name));
    } else if (sortMode === 'progress-desc') {
      list.sort((a, b) => b.progress.pct - a.progress.pct);
    } else if (sortMode === 'progress-asc') {
      list.sort((a, b) => a.progress.pct - b.progress.pct);
    }

    return list;
  }

  /* ---------- Render: Header ---------- */
  function renderHeader() {
    $('#headerMonth').textContent = MONTHS[state.month];
    $('#headerYear').textContent = state.year;
    $('#currentDate').textContent = formatDate();
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function populateMonthYearSelects() {
    const monthSelect = $('#monthSelect');
    const yearSelect = $('#yearSelect');

    monthSelect.innerHTML = MONTHS.map((m, i) =>
      `<option value="${i}"${i === state.month ? ' selected' : ''}>${m}</option>`
    ).join('');

    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === state.year) opt.selected = true;
      yearSelect.appendChild(opt);
    }
  }

  /* ---------- Render: Quote ---------- */
  function renderQuote() {
    const quote = QUOTES[getDailyQuoteIndex()];
    const textEl = $('.quote__text');
    const authorEl = $('.quote__author');
    if (!textEl) return;

    textEl.classList.add('fade-out');
    setTimeout(() => {
      textEl.textContent = `"${quote.text}"`;
      authorEl.textContent = `— ${quote.author}`;
      textEl.classList.remove('fade-out');
    }, 300);
  }

  /* ---------- Render: Assistant ---------- */
  function renderAssistant() {
    $('#assistantGreeting').textContent = getGreeting();
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const overall = getMonthlyOverall(daysInMonth);
    const tips = [
      `You're ${overall.pct}% through this month's habits.`,
      overall.pct < 50 ? 'Focus on consistency — small wins add up.' : 'Great progress! Keep the streak alive.',
      `Current streak: ${getCurrentStreak()} perfect day${getCurrentStreak() !== 1 ? 's' : ''}.`
    ];
    $('#assistantTips').innerHTML = tips.map(t => `<div class="assistant__tip">${t}</div>`).join('');
  }

  /* ---------- Render: Week Circles ---------- */
  function renderWeekCircles() {
    const container = $('#weekCircles');
    const daysInMonth = getDaysInMonth(state.month, state.year);

    container.innerHTML = '';
    for (let w = 0; w < WEEK_COUNT; w++) {
      const pct = getWeekProgress(w, daysInMonth);
      const offset = CIRCLE_CIRCUMFERENCE - (pct / 100) * CIRCLE_CIRCUMFERENCE;

      const div = document.createElement('div');
      div.className = 'week-circle';
      div.innerHTML = `
        <svg class="week-circle__svg" viewBox="0 0 80 80" role="img" aria-label="Week ${w + 1}: ${pct}% complete">
          <circle class="week-circle__bg" cx="40" cy="40" r="${CIRCLE_RADIUS}"/>
          <circle class="week-circle__fill week-circle__fill--w${w + 1}" cx="40" cy="40" r="${CIRCLE_RADIUS}"
            stroke-dasharray="${CIRCLE_CIRCUMFERENCE}" stroke-dashoffset="${CIRCLE_CIRCUMFERENCE}"
            data-target="${offset}"/>
        </svg>
        <span class="week-circle__label">Week ${w + 1}</span>
        <span class="week-circle__percent">${pct}%</span>
      `;
      container.appendChild(div);

      requestAnimationFrame(() => {
        const fill = div.querySelector('.week-circle__fill');
        fill.setAttribute('stroke-dashoffset', offset);
      });
    }
  }

  /* ---------- Render: Daily Tracker ---------- */
  function renderDailyTracker() {
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const head = $('#dailyTrackerHead');
    const body = $('#dailyTrackerBody');
    const todayIdx = getTodayDayIndex();

    $('#dailyTrackerMeta').textContent = `${daysInMonth} days · ${state.dailyHabits.length} habits`;

    let headerRow1 = '<tr><th class="col-habit" scope="col" rowspan="2">Habit</th>';
    let headerRow2 = '<tr>';

    for (let w = 0; w < WEEK_COUNT; w++) {
      const { start, end } = getWeekDayRange(w, daysInMonth);
      const span = end - start;
      if (span <= 0) continue;
      headerRow1 += `<th class="week-header ${WEEK_COLORS[w]}" colspan="${span}">Week ${w + 1}</th>`;
      for (let d = start; d < end; d++) {
        const isToday = d === todayIdx;
        headerRow2 += `<th scope="col"${isToday ? ' class="today-col"' : ''}>${d + 1}</th>`;
      }
    }
    headerRow1 += '</tr>';
    headerRow2 += '</tr>';
    head.innerHTML = headerRow1 + headerRow2;

    const filtered = getFilteredSortedHabits(state.dailyHabits, daysInMonth, 'daily');

    body.innerHTML = filtered.map(({ habit, idx }) => {
      const realIdx = state.dailyHabits.indexOf(habit);
      let row = `<tr data-habit-idx="${realIdx}">`;
      row += `<td class="col-habit"><input type="text" class="habit-name-input" value="${escapeHtml(habit.name)}" data-type="daily" data-idx="${realIdx}" aria-label="Habit name"></td>`;

      for (let d = 0; d < daysInMonth; d++) {
        const w = getWeekForDay(d);
        const checked = habit.days[d] ? 'checked' : '';
        row += `<td class="${WEEK_COLORS[w]}-soft">
          <input type="checkbox" class="habit-check" ${checked}
            data-type="daily" data-habit="${realIdx}" data-day="${d}"
            aria-label="${escapeHtml(habit.name)} day ${d + 1}">
        </td>`;
      }
      row += '</tr>';
      return row;
    }).join('');
  }

  /* ---------- Render: Weekly Tracker ---------- */
  function renderWeeklyTracker() {
    const head = $('#weeklyTrackerHead');
    const body = $('#weeklyTrackerBody');

    let completedWeeks = 0;
    state.weeklyHabits.forEach(h => {
      if (h.weeks.every(Boolean)) completedWeeks++;
    });

    $('#weeklyTrackerMeta').textContent = `${state.weeklyHabits.length} habits · ${completedWeeks} fully complete`;

    head.innerHTML = `<tr>
      <th class="col-habit" scope="col">Habit</th>
      ${WEEK_COLORS.map((c, i) => `<th class="week-header ${c}" scope="col">Week ${i + 1}</th>`).join('')}
    </tr>`;

    const filtered = getFilteredSortedHabits(state.weeklyHabits, 31, 'weekly');

    body.innerHTML = filtered.map(({ habit }) => {
      const realIdx = state.weeklyHabits.indexOf(habit);
      let row = `<tr data-weekly-idx="${realIdx}">`;
      row += `<td class="col-habit"><input type="text" class="habit-name-input" value="${escapeHtml(habit.name)}" data-type="weekly" data-idx="${realIdx}" aria-label="Weekly habit name"></td>`;

      for (let w = 0; w < WEEK_COUNT; w++) {
        const checked = habit.weeks[w] ? 'checked' : '';
        row += `<td>
          <input type="checkbox" class="habit-check" ${checked}
            data-type="weekly" data-habit="${realIdx}" data-week="${w}"
            aria-label="${escapeHtml(habit.name)} week ${w + 1}">
        </td>`;
      }
      row += '</tr>';
      return row;
    }).join('');
  }

  /* ---------- Render: Daily Summary ---------- */
  function renderDailySummary() {
    const summary = getDailySummaryForToday();
    const ringFill = $('#dailyProgressRing .progress-ring__fill');
    const offset = RING_CIRCUMFERENCE - (summary.pct / 100) * RING_CIRCUMFERENCE;

    ringFill.style.strokeDasharray = RING_CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE;
    requestAnimationFrame(() => {
      ringFill.style.strokeDashoffset = offset;
    });

    $('#ringPercent').textContent = summary.pct + '%';

    $('#dailySummaryStats').innerHTML = `
      <div class="stat-item">
        <div class="stat-item__label">Completed</div>
        <div class="stat-item__value">${summary.completed}/${summary.total}</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__label">Today's Streak</div>
        <div class="stat-item__value">${summary.streak} day${summary.streak !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__label">Daily Progress</div>
        <div class="stat-item__value">${summary.pct}%</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__label">Remaining</div>
        <div class="stat-item__value">${summary.total - summary.completed}</div>
      </div>
    `;
  }

  /* ---------- Render: Top 10 Habits ---------- */
  function renderTopHabits() {
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const top = getTopHabits(daysInMonth, 10);
    const list = $('#topHabitsList');

    list.innerHTML = top.map((h, i) => `
      <li class="top-habit" data-id="${h.id}">
        <span class="top-habit__rank">${i + 1}</span>
        <span class="top-habit__name">${escapeHtml(h.name)}</span>
        <div class="top-habit__bar-wrap">
          <div class="top-habit__bar">
            <div class="top-habit__bar-fill" style="width: ${h.pct}%"></div>
          </div>
          <span class="top-habit__pct">${h.pct}%</span>
        </div>
      </li>
    `).join('');
  }

  /* ---------- Render: Daily Progress Table ---------- */
  function renderDailyProgressTable() {
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const body = $('#dailyProgressBody');

    body.innerHTML = state.dailyHabits.map(h => {
      const { pct, completed, remaining } = getHabitProgress(h, daysInMonth);
      const pctClass = pct >= 70 ? 'pct-high' : pct < 30 ? 'pct-low' : '';
      return `<tr>
        <td title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</td>
        <td class="${pctClass}">${pct}%</td>
        <td>${completed}</td>
        <td>${remaining}</td>
      </tr>`;
    }).join('');
  }

  /* ---------- Render: Monthly Stats ---------- */
  function renderMonthlyStats() {
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const overall = getMonthlyOverall(daysInMonth);
    const { best, worst } = getBestWorstHabits(daysInMonth);
    const longestStreak = getLongestOverallStreak(daysInMonth);
    const currentStreak = getCurrentStreak();

    $('#monthlyStatsGrid').innerHTML = `
      <div class="monthly-stat monthly-stat--hero">
        <div class="monthly-stat__value">${overall.pct}%</div>
        <div class="monthly-stat__label">Overall Completion</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${overall.completed}</div>
        <div class="monthly-stat__label">Completed</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${overall.remaining}</div>
        <div class="monthly-stat__label">Remaining</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${escapeHtml(best.name)}</div>
        <div class="monthly-stat__label">Best Habit (${best.pct}%)</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${escapeHtml(worst.name)}</div>
        <div class="monthly-stat__label">Needs Focus (${worst.pct}%)</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${longestStreak}</div>
        <div class="monthly-stat__label">Longest Streak</div>
      </div>
      <div class="monthly-stat">
        <div class="monthly-stat__value">${currentStreak}</div>
        <div class="monthly-stat__label">Current Streak</div>
      </div>
    `;
  }

  /* ---------- Render: Sidebar Summaries ---------- */
  function renderSidebar() {
    const daysInMonth = getDaysInMonth(state.month, state.year);

    const dailyList = $('#sidebarDailyList');
    dailyList.innerHTML = state.dailyHabits.slice(0, 8).map(h => {
      const { pct } = getHabitProgress(h, daysInMonth);
      return `<li class="habit-list__item">
        <span class="habit-list__name">${escapeHtml(h.name)}</span>
        <span class="habit-list__pct">${pct}%</span>
      </li>`;
    }).join('');

    const weeklySummary = $('#sidebarWeeklySummary');
    let weekHtml = '';
    for (let w = 0; w < WEEK_COUNT; w++) {
      weekHtml += `<div class="mini-stat">
        <span class="mini-stat__label">Week ${w + 1}</span>
        <span class="mini-stat__value">${getWeekProgress(w, daysInMonth)}%</span>
      </div>`;
    }
    weeklySummary.innerHTML = weekHtml;

    const overall = getMonthlyOverall(daysInMonth);
    $('#sidebarMonthlySummary').innerHTML = `
      <div class="mini-stat">
        <span class="mini-stat__label">Overall</span>
        <span class="mini-stat__value">${overall.pct}%</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat__label">Checks</span>
        <span class="mini-stat__value">${overall.completed}</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat__label">Streak</span>
        <span class="mini-stat__value">${getCurrentStreak()} days</span>
      </div>
    `;
  }

  /* ---------- Render: Notes & Journal ---------- */
  function renderNotes() {
    $('#note1').value = state.notes[0] || '';
    $('#note2').value = state.notes[1] || '';
    $('#journal').value = state.journal || '';
    updateJournalCounts();
  }

  function updateJournalCounts() {
    const text = state.journal || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    $('#wordCount').textContent = words + ' word' + (words !== 1 ? 's' : '');
    $('#charCount').textContent = text.length + ' character' + (text.length !== 1 ? 's' : '');
  }

  /* ---------- Charts (Pure Canvas) ---------- */
  function getThemeColors() {
    const isDark = state.theme === 'dark';
    return {
      text: isDark ? '#B8A99A' : '#6B5E4F',
      grid: isDark ? '#3D352C' : '#E8DFD3',
      bar: isDark ? '#C4A882' : '#C4A882',
      barAlt: isDark ? '#7BAE7F' : '#7BAE7F',
      line: isDark ? '#7BAE7F' : '#7BAE7F',
      weekColors: ['#B8D4E8', '#F5C6D6', '#B8E8D4', '#F5E6B8', '#C6E0F5']
    };
  }

  function drawRoundedBar(ctx, x, y, width, height, radius) {
    if (height <= 0) return;
    const r = Math.min(radius, width / 2, height);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawWeeklyChart() {
    const canvas = $('#weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = 200;
    const colors = getThemeColors();
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const data = [];
    for (let i = 0; i < WEEK_COUNT; i++) data.push(getWeekProgress(i, daysInMonth));

    const pad = { top: 20, right: 16, bottom: 36, left: 40 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = (chartW / data.length) * 0.6;
    const gap = chartW / data.length;

    let progress = 0;
    const animate = () => {
      progress = Math.min(1, progress + 0.06);
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = colors.text;
      ctx.font = '10px DM Sans, sans-serif';
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + chartH - (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText((i * 25) + '%', pad.left - 6, y + 3);
      }

      data.forEach((val, i) => {
        const barH = (val / 100) * chartH * progress;
        const x = pad.left + gap * i + (gap - barW) / 2;
        const grad = ctx.createLinearGradient(x, pad.top + chartH - barH, x, pad.top + chartH);
        grad.addColorStop(0, colors.weekColors[i]);
        grad.addColorStop(1, colors.bar);
        ctx.fillStyle = grad;
        drawRoundedBar(ctx, x, pad.top + chartH - barH, barW, barH, 4);

        ctx.fillStyle = colors.text;
        ctx.font = '11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('W' + (i + 1), x + barW / 2, h - 10);
        if (progress > 0.5) {
          ctx.fillText(val + '%', x + barW / 2, pad.top + chartH - barH - 6);
        }
      });

      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  function drawMonthlyChart() {
    const canvas = $('#monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = 200;
    const colors = getThemeColors();
    const daysInMonth = getDaysInMonth(state.month, state.year);

    const dailyData = [];
    for (let d = 0; d < daysInMonth; d++) {
      let done = 0;
      state.dailyHabits.forEach(h => { if (h.days[d]) done++; });
      dailyData.push(Math.round((done / state.dailyHabits.length) * 100));
    }

    ctx.clearRect(0, 0, w, h);
    const pad = { top: 16, right: 12, bottom: 28, left: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.max(2, chartW / daysInMonth - 1);

    ctx.strokeStyle = colors.grid;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    dailyData.forEach((val, i) => {
      const barH = (val / 100) * chartH;
      const x = pad.left + i * (barW + 1);
      const grad = ctx.createLinearGradient(x, pad.top, x, pad.top + chartH);
      grad.addColorStop(0, colors.barAlt);
      grad.addColorStop(1, colors.bar);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, pad.top + chartH - barH, barW, barH);
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = colors.text;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Day of month', w / 2, h - 4);
  }

  function drawTrendChart() {
    const canvas = $('#trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = 180;
    const colors = getThemeColors();
    const daysInMonth = getDaysInMonth(state.month, state.year);

    const cumulative = [];
    let running = 0;
    let total = 0;
    for (let d = 0; d < daysInMonth; d++) {
      state.dailyHabits.forEach(h => {
        total++;
        if (h.days[d]) running++;
      });
      cumulative.push(total > 0 ? Math.round((running / total) * 100) : 0);
    }

    ctx.clearRect(0, 0, w, h);
    const pad = { top: 16, right: 12, bottom: 28, left: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    if (cumulative.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';

    cumulative.forEach((val, i) => {
      const x = pad.left + (i / (cumulative.length - 1)) * chartW;
      const y = pad.top + chartH - (val / 100) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = colors.line + '22';
    ctx.fill();

    ctx.fillStyle = colors.text;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cumulative progress trend', w / 2, h - 4);
  }

  function renderCharts() {
    drawWeeklyChart();
    drawMonthlyChart();
    drawTrendChart();
  }

  /* ---------- Render All ---------- */
  function renderAll() {
    renderHeader();
    renderQuote();
    renderAssistant();
    renderWeekCircles();
    renderDailyTracker();
    renderWeeklyTracker();
    renderDailySummary();
    renderTopHabits();
    renderDailyProgressTable();
    renderMonthlyStats();
    renderSidebar();
    renderNotes();
    renderCharts();
  }

  /* ---------- Event Handlers ---------- */
  function handleCheckboxChange(e) {
    const el = e.target;
    if (!el.classList.contains('habit-check')) return;

    pushUndo();
    const type = el.dataset.type;
    const habitIdx = parseInt(el.dataset.habit, 10);

    if (type === 'daily') {
      const day = parseInt(el.dataset.day, 10);
      state.dailyHabits[habitIdx].days[day] = el.checked;
    } else {
      const week = parseInt(el.dataset.week, 10);
      state.weeklyHabits[habitIdx].weeks[week] = el.checked;
    }

    saveState();
    updateAfterCheckChange();
  }

  function updateAfterCheckChange() {
    renderWeekCircles();
    renderDailySummary();
    renderTopHabits();
    renderDailyProgressTable();
    renderMonthlyStats();
    renderSidebar();
    renderAssistant();
    renderWeeklyTracker();
    renderCharts();
  }

  function handleHabitNameChange(e) {
    const el = e.target;
    if (!el.classList.contains('habit-name-input')) return;

    pushUndo();
    const idx = parseInt(el.dataset.idx, 10);
    if (el.dataset.type === 'daily') {
      state.dailyHabits[idx].name = el.value;
    } else {
      state.weeklyHabits[idx].name = el.value;
    }
    saveState();
    renderTopHabits();
    renderDailyProgressTable();
    renderSidebar();
  }

  function handleNotesInput() {
    state.notes[0] = $('#note1').value;
    state.notes[1] = $('#note2').value;
    saveState();
  }

  function handleJournalInput() {
    state.journal = $('#journal').value;
    updateJournalCounts();
    saveState();
  }

  function handleMonthYearChange() {
    pushUndo();
    state.month = parseInt($('#monthSelect').value, 10);
    state.year = parseInt($('#yearSelect').value, 10);
    saveState();
    renderAll();
  }

  function toggleTheme() {
    pushUndo();
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    saveState();
    renderCharts();
    showToast(state.theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
  }

  function resetMonth() {
    if (!confirm('Reset all checkboxes for this month? Habit names and notes will be kept.')) return;
    pushUndo();
    state.dailyHabits.forEach(h => { h.days = Array(31).fill(false); });
    state.weeklyHabits.forEach(h => { h.weeks = Array(WEEK_COUNT).fill(false); });
    saveState();
    renderAll();
    showToast('Month reset');
  }

  function clearAll() {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    pushUndo();
    state = createDefaultState();
    saveState();
    renderAll();
    showToast('All data cleared');
  }

  /* ---------- Export / Import ---------- */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `habit-tracker-${MONTHS[state.month]}-${state.year}.json`);
    showToast('JSON exported');
  }

  function exportCSV() {
    const daysInMonth = getDaysInMonth(state.month, state.year);
    let csv = 'Type,Habit Name';
    for (let d = 1; d <= daysInMonth; d++) csv += ',Day ' + d;
    csv += ',Progress %\n';

    state.dailyHabits.forEach(h => {
      const { pct } = getHabitProgress(h, daysInMonth);
      csv += 'Daily,"' + h.name.replace(/"/g, '""') + '"';
      for (let d = 0; d < daysInMonth; d++) csv += ',' + (h.days[d] ? 'Yes' : 'No');
      csv += ',' + pct + '\n';
    });

    csv += '\nType,Habit Name';
    for (let w = 1; w <= WEEK_COUNT; w++) csv += ',Week ' + w;
    csv += ',Progress %\n';

    state.weeklyHabits.forEach(h => {
      const { pct } = getWeeklyHabitProgress(h);
      csv += 'Weekly,"' + h.name.replace(/"/g, '""') + '"';
      for (let w = 0; w < WEEK_COUNT; w++) csv += ',' + (h.weeks[w] ? 'Yes' : 'No');
      csv += ',' + pct + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `habit-tracker-${MONTHS[state.month]}-${state.year}.csv`);
    showToast('CSV exported');
  }

  function exportPDF() {
    const printWindow = window.open('', '_blank');
    const daysInMonth = getDaysInMonth(state.month, state.year);
    const overall = getMonthlyOverall(daysInMonth);
    const { best, worst } = getBestWorstHabits(daysInMonth);

    let habitRows = state.dailyHabits.map(h => {
      const { pct, completed, remaining } = getHabitProgress(h, daysInMonth);
      return `<tr><td>${escapeHtml(h.name)}</td><td>${pct}%</td><td>${completed}</td><td>${remaining}</td></tr>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Habit Tracker - ${MONTHS[state.month]} ${state.year}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #2C2416; }
        h1 { font-size: 28px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #6B5E4F; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { border: 1px solid #E8DFD3; padding: 8px; text-align: left; }
        th { background: #FFF8F0; }
        .stats { display: flex; gap: 24px; margin: 16px 0; }
        .stat { padding: 12px 20px; background: #FFF8F0; border-radius: 8px; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 11px; color: #9A8B7A; text-transform: uppercase; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>${MONTHS[state.month]} ${state.year}</h1>
      <p>Habit Tracker Planner — Generated ${new Date().toLocaleString()}</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">${overall.pct}%</div><div class="stat-label">Overall</div></div>
        <div class="stat"><div class="stat-value">${overall.completed}</div><div class="stat-label">Completed</div></div>
        <div class="stat"><div class="stat-value">${getCurrentStreak()}</div><div class="stat-label">Streak</div></div>
        <div class="stat"><div class="stat-value">${escapeHtml(best.name)}</div><div class="stat-label">Best (${best.pct}%)</div></div>
        <div class="stat"><div class="stat-value">${escapeHtml(worst.name)}</div><div class="stat-label">Focus (${worst.pct}%)</div></div>
      </div>
      <h2>Notes</h2>
      <p><strong>Quick Notes:</strong> ${escapeHtml(state.notes[0] || '—')}</p>
      <p><strong>Priorities:</strong> ${escapeHtml(state.notes[1] || '—')}</p>
      <h2>Daily Habit Progress</h2>
      <table><thead><tr><th>Habit</th><th>Progress</th><th>Done</th><th>Left</th></tr></thead><tbody>${habitRows}</tbody></table>
      <h2>Reflection</h2>
      <p>${escapeHtml(state.journal || '—')}</p>
      </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
    showToast('PDF export ready — use Save as PDF in print dialog');
  }

  function exportJournal() {
    const blob = new Blob([state.journal || ''], { type: 'text/plain' });
    downloadBlob(blob, `journal-${MONTHS[state.month]}-${state.year}.txt`);
    showToast('Journal exported');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        pushUndo();
        const imported = normalizeCloudState(JSON.parse(e.target.result));
        if (!imported) throw new Error('Invalid data');
        const { updatedAt, ...fields } = imported;
        state = { ...createDefaultState(), ...fields };
        ensureHabitCounts();
        saveState();
        populateMonthYearSelects();
        renderAll();
        showToast('Data imported successfully');
      } catch (err) {
        showToast('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- Keyboard Navigation ---------- */
  function handleKeyboard(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }

    if (e.target.classList.contains('habit-check') && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      navigateCheckbox(e.target, e.key);
    }
  }

  function navigateCheckbox(current, key) {
    const td = current.closest('td');
    const tr = current.closest('tr');
    const table = current.closest('table');
    if (!td || !tr || !table) return;

    const rows = [...table.querySelectorAll('tbody tr')];
    const rowIdx = rows.indexOf(tr);
    const cells = [...tr.querySelectorAll('td:not(.col-habit)')];
    const colIdx = cells.indexOf(td);

    let newRow = rowIdx;
    let newCol = colIdx;

    if (key === 'ArrowRight') newCol++;
    if (key === 'ArrowLeft') newCol--;
    if (key === 'ArrowDown') newRow++;
    if (key === 'ArrowUp') newRow--;

    const targetRow = rows[newRow];
    if (!targetRow) return;
    const targetCells = [...targetRow.querySelectorAll('td:not(.col-habit)')];
    const targetCheck = targetCells[newCol]?.querySelector('.habit-check');
    if (targetCheck) targetCheck.focus();
  }

  /* ---------- Mobile Menu ---------- */
  function toggleMobileSidebar(side) {
    const left = $('#leftSidebar');
    const right = $('#rightSidebar');
    const overlay = $('#sidebarOverlay');
    const fab = $('#fabMenu');

    if (side === 'left') {
      left.classList.toggle('open');
      right.classList.remove('open');
    } else {
      right.classList.toggle('open');
      left.classList.remove('open');
    }

    const isOpen = left.classList.contains('open') || right.classList.contains('open');
    overlay.classList.toggle('visible', isOpen);
    overlay.setAttribute('aria-hidden', !isOpen);
    fab.setAttribute('aria-expanded', isOpen);
  }

  /* ---------- Utilities ---------- */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /* ---------- Bind Events ---------- */
  function bindEvents() {
    document.addEventListener('change', handleCheckboxChange);
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('habit-name-input')) {
        clearTimeout(e.target._debounce);
        e.target._debounce = setTimeout(() => handleHabitNameChange(e), 400);
      }
    });

    $('#note1').addEventListener('input', handleNotesInput);
    $('#note2').addEventListener('input', handleNotesInput);
    $('#journal').addEventListener('input', handleJournalInput);

    $('#monthSelect').addEventListener('change', handleMonthYearChange);
    $('#yearSelect').addEventListener('change', handleMonthYearChange);

    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#resetMonthBtn').addEventListener('click', resetMonth);
    $('#clearAllBtn').addEventListener('click', clearAll);
    $('#exportJournalBtn').addEventListener('click', exportJournal);

    $('#searchToggle').addEventListener('click', () => {
      const box = $('#searchBox');
      box.hidden = !box.hidden;
      if (!box.hidden) $('#habitSearch').focus();
    });

    $('#habitSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderDailyTracker();
      renderWeeklyTracker();
    });

    $$('.btn--filter').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.btn--filter').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        filterMode = btn.dataset.filter;
        renderDailyTracker();
        renderWeeklyTracker();
      });
    });

    $('#sortSelect').addEventListener('change', (e) => {
      sortMode = e.target.value;
      renderDailyTracker();
      renderWeeklyTracker();
    });

    const exportBtn = $('#exportMenuBtn');
    const exportMenu = $('#exportMenu');
    exportBtn.addEventListener('click', () => {
      const hidden = exportMenu.hidden;
      exportMenu.hidden = !hidden;
      exportBtn.setAttribute('aria-expanded', !hidden);
    });

    document.addEventListener('click', (e) => {
      if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
        exportMenu.hidden = true;
        exportBtn.setAttribute('aria-expanded', 'false');
      }
    });

    exportMenu.addEventListener('click', (e) => {
      const type = e.target.dataset?.export;
      if (!type) return;
      exportMenu.hidden = true;
      if (type === 'json') exportJSON();
      if (type === 'csv') exportCSV();
      if (type === 'pdf') exportPDF();
      if (type === 'print') window.print();
    });

    $('#importFile').addEventListener('change', (e) => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });

    $('#fabMenu').addEventListener('click', () => {
      const left = $('#leftSidebar');
      toggleMobileSidebar(left.classList.contains('open') ? 'right' : 'left');
    });

    $('#sidebarOverlay').addEventListener('click', () => {
      $('#leftSidebar').classList.remove('open');
      $('#rightSidebar').classList.remove('open');
      $('#sidebarOverlay').classList.remove('visible');
      $('#fabMenu').setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', handleKeyboard);

    window.addEventListener('resize', debounce(renderCharts, 250));
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function startClock() {
    const tick = () => {
      const clock = $('#liveClock');
      const date = $('#currentDate');
      if (clock) clock.textContent = formatClock();
      if (date) date.textContent = formatDate();
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Initialize ---------- */
  async function init() {
    try {
      loadStateFromLocal();
      populateMonthYearSelects();
      document.documentElement.setAttribute('data-theme', state.theme);
      bindEvents();
      bindAuthEvents();
      renderAll();
      updateUndoRedoButtons();
      startClock();

      if (!isFirebaseConfigured()) {
        updateSyncUI('offline', 'Local only');
        return;
      }

      setRemoteUpdateHandler((data) => applyRemoteState(data, true));
      setAuthChangeHandler(updateAuthUI);
      setSyncStatusHandler(updateSyncUI);

      const fbReady = await initFirebase();
      if (!fbReady) return;

      const user = getCurrentUser();
      if (user) updateAuthUI(user);

      const cloudData = await loadFromDatabase();
      const localUpdatedAt = getLocalUpdatedAt();

      if (cloudData) {
        const normalized = normalizeCloudState(cloudData);
        const cloudUpdatedAt = normalized?.updatedAt || 0;
        if (cloudUpdatedAt >= localUpdatedAt) {
          applyRemoteState(cloudData, true);
        } else {
          await saveToDatabase(state);
        }
      } else if (localUpdatedAt > 0) {
        await saveToDatabase(state);
      }

      enableRealtimeSync();
    } catch (err) {
      console.error('App init failed:', err);
      state = createDefaultState();
      ensureHabitCounts();
      populateMonthYearSelects();
      document.documentElement.setAttribute('data-theme', state.theme);
      renderAll();
      updateSyncUI('error', 'Recovered from error');
      showToast('App recovered — data reset to defaults');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
})();
