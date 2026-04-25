import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://whotwmofqunhxxbrdvpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_muNMrMjZDHYxT616JNJZHQ_YErEnvUS';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- DOM ----------
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const priorityList = document.getElementById('priorityList');
const memoryList = document.getElementById('memoryList');

const totalMemoriesCount = document.getElementById('totalMemoriesCount');
const openLoopsCount = document.getElementById('openLoopsCount');
const neutralCount = document.getElementById('neutralCount');
const closedCount = document.getElementById('closedCount');

const captureInput = document.getElementById('captureInput');
const saveMemoryBtn = document.getElementById('saveMemoryBtn');
const typeSelect = document.getElementById('typeSelect');

const editModal = document.getElementById('editModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveBtn = document.getElementById('saveBtn');

const editContent = document.getElementById('editContent');
const editPeople = document.getElementById('editPeople');
const editTopics = document.getElementById('editTopics');
const editActionItems = document.getElementById('editActionItems');
const editType = document.getElementById('editType');

const dashboardCards = document.querySelectorAll('.dashboard-filter-card');

// ---------- STATE ----------
let allMemories = [];
let currentEditRow = null;
let currentFilter = 'all';

// ---------- HELPERS ----------
function safeArray(value) {
  return Array.isArray(value) ? value : value ? [String(value)] : [];
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function formatClosedAt(value) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : '';
}

function getClosedTime(row) {
  return row.closed_at ? new Date(row.closed_at).getTime() : 0;
}

function commaStringToArray(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ---------- LOOP ----------
function getEffectiveLoopStatus(row) {
  if (row.loop_status === 'closed') return 'closed';
  if (row.loop_status === 'open' || row.is_open_loop) return 'open';
  if (safeArray(row.action_items).length > 0) return 'open';
  return 'neutral';
}

function hasOpenActionItems(row) {
  return getEffectiveLoopStatus(row) === 'open';
}

// ---------- SORT ----------
function sortRows(rows) {
  if (currentFilter === 'closed') {
    return [...rows].sort((a, b) => getClosedTime(b) - getClosedTime(a));
  }
  return [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getRecentlyClosedRows() {
  return allMemories
    .filter(r => getEffectiveLoopStatus(r) === 'closed' && r.closed_at)
    .sort((a, b) => getClosedTime(b) - getClosedTime(a))
    .slice(0, 10);
}

// ---------- FILTER ----------
function applyFilter(rows) {
  if (currentFilter === 'open') return rows.filter(r => getEffectiveLoopStatus(r) === 'open');
  if (currentFilter === 'closed') return rows.filter(r => getEffectiveLoopStatus(r) === 'closed');
  if (currentFilter === 'neutral') return rows.filter(r => getEffectiveLoopStatus(r) === 'neutral');
  return rows;
}

window.setFilter = function (filter) {
  currentFilter = filter;
  renderApp();
};

// ---------- RENDER ----------
function renderList(rows, targetEl, emptyMessage) {
  if (!targetEl) return;

  if (!rows.length) {
    targetEl.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  targetEl.innerHTML = rows.map(row => {
    const status = getEffectiveLoopStatus(row);

    return `
      <div class="memory-card ${status === 'closed' ? 'memory-card-closed' : ''}">
        <div>${escapeHtml(row.content)}</div>
        <div>${status === 'closed' ? '🟢 Closed' : status === 'open' ? '🔴 Open' : '⚪ Neutral'}</div>
        ${status === 'closed' && row.closed_at ? `<div>Closed on: ${formatClosedAt(row.closed_at)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderRecentlyCompleted() {
  let section = document.getElementById('recentlyCompletedSection');

  if (!section) {
    section = document.createElement('div');
    section.id = 'recentlyCompletedSection';

    section.innerHTML = `
      <h2>Recently Completed</h2>
      <div id="recentlyCompletedList"></div>
    `;

    memoryList.parentNode.insertBefore(section, memoryList);
  }

  const list = document.getElementById('recentlyCompletedList');

  if (!list) return;

  const rows = getRecentlyClosedRows();
  renderList(rows, list, 'No recently completed memories');
}

function renderApp() {
  renderRecentlyCompleted();

  const filtered = sortRows(applyFilter(allMemories));
  renderList(filtered, memoryList, 'No memories found');
}

// ---------- LOAD ----------
async function loadMemories() {
  const { data } = await supabase
    .from('memories')
    .select('*');

  allMemories = data || [];
  renderApp();
}

// ---------- INIT ----------
loadMemories();
