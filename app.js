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
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function formatClosedAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getClosedTime(row) {
  if (!row.closed_at) return 0;
  return new Date(row.closed_at).getTime() || 0;
}

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function commaStringToArray(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
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

function badgeClass(type) {
  const cleaned = String(type || '').toLowerCase();

  if (cleaned === 'note') return 'badge badge-note';
  if (cleaned === 'task') return 'badge badge-task';
  if (cleaned === 'reminder') return 'badge badge-reminder';
  if (cleaned === 'follow-up') return 'badge badge-follow-up';
  return 'badge badge-default';
}

// ---------- LOOP LOGIC ----------
function getStoredLoopStatus(row) {
  const raw = String(row.loop_status || '').toLowerCase();

  if (raw === 'closed') return 'closed';
  if (raw === 'open' || row.is_open_loop === true) return 'open';
  return 'neutral';
}

function getEffectiveLoopStatus(row) {
  const stored = getStoredLoopStatus(row);

  if (stored === 'closed') return 'closed';
  if (stored === 'open') return 'open';
  if (safeArray(row.action_items).length > 0) return 'open';

  return 'neutral';
}

function hasOpenActionItems(row) {
  return getEffectiveLoopStatus(row) === 'open';
}

function detectOpenLoop(rawText) {
  const lower = String(rawText || '').toLowerCase();

  const openSignals = [
    'need to',
    'have to',
    'must',
    'remind me',
    'follow up',
    'call',
    'pay',
    'schedule',
    'book',
    'send',
    'text',
    'email',
    'transfer',
    'deposit',
    'finish',
    'complete',
    'submit',
    'renew',
    'review'
  ];

  const closedSignals = [
    'finished',
    'completed',
    'done',
    'paid',
    'called',
    'sent',
    'resolved'
  ];

  if (closedSignals.some(term => lower.includes(term))) {
    return {
      is_open_loop: false,
      loop_status: 'closed'
    };
  }

  if (openSignals.some(term => lower.includes(term))) {
    return {
      is_open_loop: true,
      loop_status: 'open'
    };
  }

  return {
    is_open_loop: false,
    loop_status: 'neutral'
  };
}

// ---------- SORTING ----------
function sortRowsForCurrentFilter(rows) {
  const copiedRows = [...rows];

  if (currentFilter === 'closed') {
    return copiedRows.sort((a, b) => getClosedTime(b) - getClosedTime(a));
  }

  return copiedRows.sort((a, b) => {
    const aTime = new Date(a.created_at).getTime() || 0;
    const bTime = new Date(b.created_at).getTime() || 0;
    return bTime - aTime;
  });
}

function getRecentlyClosedRows(rows) {
  return rows
    .filter(row => getEffectiveLoopStatus(row) === 'closed' && row.closed_at)
    .sort((a, b) => getClosedTime(b) - getClosedTime(a))
    .slice(0, 10);
}

// ---------- FILTERS ----------
function applyFilter(rows) {
  if (currentFilter === 'open') {
    return rows.filter(row => getEffectiveLoopStatus(row) === 'open');
  }

  if (currentFilter === 'closed') {
    return rows.filter(row => getEffectiveLoopStatus(row) === 'closed');
  }

  if (currentFilter === 'neutral') {
    return rows.filter(row => getEffectiveLoopStatus(row) === 'neutral');
  }

  return rows;
}

function setFilter(filter) {
  currentFilter = filter;
  updateFilterButtons();
  updateDashboardCardStates();
  renderApp();
}

window.setFilter = setFilter;

function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });
}

function updateDashboardCardStates() {
  dashboardCards.forEach(card => {
    card.classList.toggle('active', card.dataset.filter === currentFilter);
  });

  if (currentFilter === 'all') {
    const allCard = document.getElementById('cardAll');
    if (allCard) allCard.classList.add('active');
  }
}

function injectFilterBar() {
  if (document.getElementById('memoryFilterWrap')) return;
  if (!memoryList) return;

  const wrap = document.createElement('div');
  wrap.id = 'memoryFilterWrap';

  wrap.innerHTML = `
    <div class="filter-wrap">
      <button class="filter-btn active" data-filter="all" onclick="setFilter('all')">All</button>
      <button class="filter-btn" data-filter="open" onclick="setFilter('open')">Open</button>
      <button class="filter-btn" data-filter="closed" onclick="setFilter('closed')">Closed</button>
      <button class="filter-btn" data-filter="neutral" onclick="setFilter('neutral')">Neutral</button>
    </div>
    <div id="memoryListLabel" class="memory-list-label">Showing: All memories</div>
  `;

  memoryList.parentNode.insertBefore(wrap, memoryList);
}

function updateMemoryListLabel() {
  const label = document.getElementById('memoryListLabel');
  if (!label) return;

  if (currentFilter === 'all') {
    label.textContent = 'Showing: All memories';
  } else if (currentFilter === 'open') {
    label.textContent = 'Showing: Open memories';
  } else if (currentFilter === 'closed') {
    label.textContent = 'Showing: Closed memories, newest closed first';
  } else if (currentFilter === 'neutral') {
    label.textContent = 'Showing: Neutral memories';
  }
}

// ---------- DASHBOARD ----------
function injectCompletedTodayCard() {
  if (document.getElementById('completedTodayCount')) return;

  const closedCard = closedCount ? closedCount.closest('.dashboard-filter-card') : null;
  if (!closedCard || !closedCard.parentNode) return;

  const completedTodayCard = document.createElement('div');
  completedTodayCard.className = 'dashboard-filter-card';
  completedTodayCard.dataset.filter = 'closed';
  completedTodayCard.style.cursor = 'pointer';

  completedTodayCard.innerHTML = `
    <div class="stat-number" id="completedTodayCount">0</div>
    <div class="stat-label">Completed Today</div>
  `;

  completedTodayCard.addEventListener('click', () => {
    setFilter('closed');
  });

  closedCard.parentNode.insertBefore(completedTodayCard, closedCard.nextSibling);
}

function updateDashboard(rows) {
  injectCompletedTodayCard();

  const completedTodayCount = document.getElementById('completedTodayCount');

  const total = rows.length;
  const open = rows.filter(row => getEffectiveLoopStatus(row) === 'open').length;
  const closed = rows.filter(row => getEffectiveLoopStatus(row) === 'closed').length;
  const neutral = rows.filter(row => getEffectiveLoopStatus(row) === 'neutral').length;

  const completedToday = rows.filter(row => {
    return getEffectiveLoopStatus(row) === 'closed' && isToday(row.closed_at);
  }).length;

  if (totalMemoriesCount) totalMemoriesCount.textContent = total;
  if (openLoopsCount) openLoopsCount.textContent = open;
  if (neutralCount) neutralCount.textContent = neutral;
  if (closedCount) closedCount.textContent = closed;
  if (completedTodayCount) completedTodayCount.textContent = completedToday;
}

// ---------- RENDER ----------
function renderList(rows, targetEl, emptyMessage) {
  if (!targetEl) return;

  if (!rows.length) {
    targetEl.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  targetEl.innerHTML = rows.map(row => {
    const actions = safeArray(row.action_items);
    const people = safeArray(row.people);
    const topics = safeArray(row.topics);
    const status = getEffectiveLoopStatus(row);

    const closedAtDisplay =
      status === 'closed' && row.closed_at
        ? `<div class="memory-closed-at">Closed on: ${escapeHtml(formatClosedAt(row.closed_at))}</div>`
        : '';

    const closedCardClass = status === 'closed' ? 'memory-card-closed' : '';

    const cardStyle =
      status === 'closed'
        ? 'style="opacity:0.45;background:#f1f5f9;border-color:#cbd5e1;box-shadow:none;"'
        : status === 'open'
          ? 'style="background:#fffaf5;border-color:#f97316;box-shadow:0 6px 18px rgba(249,115,22,0.16);"'
          : '';

    return `
      <article class="memory-card ${closedCardClass}" ${cardStyle}>
        <div class="memory-topline">
          <span class="${badgeClass(row.type)}">${escapeHtml(row.type || 'memory')}</span>
          <span class="memory-date">${escapeHtml(formatDate(row.created_at))}</span>
        </div>

        <div class="memory-content">${escapeHtml(row.content || '')}</div>

        <div class="memory-status-row">
          <span class="loop-badge loop-${status}">
            ${status === 'open' ? '🔴 Open' : status === 'closed' ? '🟢 Closed' : '⚪ Neutral'}
          </span>
        </div>

        ${closedAtDisplay}

        ${
          people.length || topics.length
            ? `
            <div class="meta-block">
              ${people.map(person => `<span class="meta-chip">@${escapeHtml(person)}</span>`).join('')}
              ${topics.map(topic => `<span class="meta-chip">#${escapeHtml(topic)}</span>`).join('')}
            </div>
            `
            : ''
        }

        ${
          actions.length
            ? `
            <div class="action-box" style="line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">
              <strong>Action items:</strong> ${actions.map(escapeHtml).join(', ')}
            </div>
            `
            : ''
        }

        <div class="card-actions">
          ${
            status === 'open'
              ? `<button class="card-close-btn" data-close-id="${escapeHtml(row.id)}">Mark Closed</button>`
              : ''
          }
          <button class="card-edit-btn" data-edit-id="${escapeHtml(row.id)}">Edit</button>
          <button class="card-delete-btn" data-delete-id="${escapeHtml(row.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join('');

  targetEl.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId = btn.getAttribute('data-edit-id');
      openEditor(rowId);
    });
  });

  targetEl.querySelectorAll('[data-close-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.getAttribute('data-close-id');
      await markAsClosed(rowId);
    });
  });

  targetEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.getAttribute('data-delete-id');
      await deleteMemory(rowId);
    });
  });
}

function renderRecentlyCompleted() {
  let section = document.getElementById('recentlyCompletedSection');

  if (!section) {
    section = document.createElement('section');
    section.id = 'recentlyCompletedSection';
    section.className = 'recently-completed-section';

    section.innerHTML = `
      <div class="section-header">
        <h2>Recently Completed</h2>
        <p>Your latest closed memories, sorted by completion time.</p>
      </div>
      <div id="recentlyCompletedList" class="card-list"></div>
    `;

    const allSection = document.querySelector('.all-section');

    if (allSection && allSection.parentNode) {
      allSection.parentNode.insertBefore(section, allSection);
    } else if (memoryList && memoryList.parentNode) {
      memoryList.parentNode.insertBefore(section, memoryList);
    }
  }

  const list = document.getElementById('recentlyCompletedList');
  if (!section || !list) return;

  const shouldShowRecentlyCompleted = currentFilter === 'all' || currentFilter === 'closed';
  section.style.display = shouldShowRecentlyCompleted ? 'block' : 'none';

  if (!shouldShowRecentlyCompleted) return;

  const recentlyClosedRows = getRecentlyClosedRows(allMemories);

  renderList(
    recentlyClosedRows,
    list,
    'No recently completed memories yet.'
  );
}

function renderApp() {
  const priorityRows = allMemories.filter(hasOpenActionItems);
  const filteredRows = sortRowsForCurrentFilter(applyFilter(allMemories));

  const prioritySection = document.querySelector('.priority-section');
  const shouldShowPriority = currentFilter === 'all' || currentFilter === 'open';

  updateDashboard(allMemories);

  if (prioritySection) {
    prioritySection.style.display = shouldShowPriority ? 'block' : 'none';
  }

  if (shouldShowPriority) {
    renderList(priorityRows, priorityList, 'No open action items found.');
  }

  renderRecentlyCompleted();

  renderList(filteredRows, memoryList, 'No memories found for this filter.');

  updateFilterButtons();
  updateDashboardCardStates();
  updateMemoryListLabel();
}

// ---------- EDIT ----------
function openEditor(rowId) {
  const row = allMemories.find(item => String(item.id) === String(rowId));
  if (!row) return;

  currentEditRow = row;

  if (editContent) editContent.value = row.content || '';
  if (editPeople) editPeople.value = safeArray(row.people).join(', ');
  if (editTopics) editTopics.value = safeArray(row.topics).join(', ');
  if (editActionItems) editActionItems.value = safeArray(row.action_items).join(', ');
  if (editType) editType.value = row.type || '';

  if (editModal) editModal.classList.remove('hidden');
}

function closeEditor() {
  if (editModal) editModal.classList.add('hidden');
  currentEditRow = null;
}

async function saveChanges() {
  if (!currentEditRow) return;

  const contentValue = editContent ? editContent.value.trim() : '';
  const loopFields = detectOpenLoop(contentValue);

  const payload = {
    content: contentValue,
    people: editPeople ? commaStringToArray(editPeople.value) : [],
    topics: editTopics ? commaStringToArray(editTopics.value) : [],
    action_items: editActionItems ? commaStringToArray(editActionItems.value) : [],
    type: editType ? editType.value.trim() : '',
    is_open_loop: loopFields.is_open_loop,
    loop_status: loopFields.loop_status
  };

  if (loopFields.loop_status === 'closed') {
    payload.closed_at = currentEditRow.closed_at || new Date().toISOString();
  }

  if (loopFields.loop_status !== 'closed') {
    payload.closed_at = null;
  }

  if (saveBtn) {
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
  }

  const { error } = await supabase
    .from('memories')
    .update(payload)
    .eq('id', currentEditRow.id);

  if (saveBtn) {
    saveBtn.textContent = 'Save changes';
    saveBtn.disabled = false;
  }

  if (error) {
    alert(`Could not save changes: ${error.message}`);
    return;
  }

  currentFilter = 'all';
  closeEditor();
  await loadMemories();
}

async function markAsClosed(rowId) {
  const row = allMemories.find(item => String(item.id) === String(rowId));
  if (!row) return;

  const { error } = await supabase
    .from('memories')
    .update({
      is_open_loop: false,
      loop_status: 'closed',
      closed_at: new Date().toISOString()
    })
    .eq('id', rowId);

  if (error) {
    alert(`Could not mark memory as closed: ${error.message}`);
    return;
  }

  await loadMemories();
}

// ---------- DELETE ----------
async function deleteMemory(rowId) {
  const row = allMemories.find(item => String(item.id) === String(rowId));
  const label = row?.content ? row.content.slice(0, 80) : 'this memory';

  const confirmed = window.confirm(`Delete this memory?\n\n${label}`);
  if (!confirmed) return;

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', rowId);

  if (error) {
    alert(`Could not delete memory: ${error.message}`);
    return;
  }

  currentFilter = 'all';
  await loadMemories();
}

// ---------- SAVE NEW MEMORY ----------
function extractActionItems(rawText) {
  return String(rawText || '')
    .split(/\.|,|and/i)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => {
      const lower = s.toLowerCase();
      return (
        lower.includes('pay') ||
        lower.includes('call') ||
        lower.includes('need') ||
        lower.includes('deposit') ||
        lower.includes('transfer') ||
        lower.includes('follow up') ||
        lower.includes('schedule') ||
        lower.includes('review') ||
        lower.includes('send') ||
        lower.includes('submit')
      );
    });
}

async function saveMemory() {
  if (!captureInput || !saveMemoryBtn) return;

  const rawText = captureInput.value.trim();
  if (!rawText) return;

  saveMemoryBtn.textContent = 'Saving...';
  saveMemoryBtn.disabled = true;

  let detectedType = typeSelect ? typeSelect.value : 'note';
  const actionItems = extractActionItems(rawText);

  if (actionItems.length > 0 && detectedType === 'note') {
    detectedType = 'task';
  }

  const loopFields = detectOpenLoop(rawText);

  const payload = {
    content: rawText,
    type: detectedType,
    action_items: actionItems,
    is_open_loop: loopFields.is_open_loop,
    loop_status: loopFields.loop_status
  };

  if (loopFields.loop_status === 'closed') {
    payload.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('memories')
    .insert([payload]);

  saveMemoryBtn.textContent = 'Save Memory';
  saveMemoryBtn.disabled = false;

  if (error) {
    alert(`Could not save memory: ${error.message}`);
    return;
  }

  captureInput.value = '';
  currentFilter = 'all';
  await loadMemories();
}

// ---------- SEARCH ----------
async function runAISearch(query) {
  try {
    const q = String(query || '').trim();

    if (!q) {
      await loadMemories();
      return;
    }

    const { data, error } = await supabase.functions.invoke('search-memory', {
      body: { query: q }
    });

    if (error) {
      console.error('AI search error:', error);
      return;
    }

    allMemories = Array.isArray(data) ? data : (data?.data || []);
    renderApp();
  } catch (err) {
    console.error('runAISearch failed:', err);
  }
}

// ---------- LOAD ----------
async function loadMemories() {
  if (priorityList) {
    priorityList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }
  if (memoryList) {
    memoryList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }

  const { data, error } = await supabase
    .from('memories')
    .select('id, created_at, content, people, topics, action_items, type, is_open_loop, loop_status, closed_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (priorityList) {
      priorityList.innerHTML = `<div class="empty-state">Error loading memories: ${escapeHtml(error.message)}</div>`;
    }
    if (memoryList) {
      memoryList.innerHTML = `<div class="empty-state">Please check your Supabase settings and table access.</div>`;
    }
    return;
  }

  allMemories = data || [];
  renderApp();
}

// ---------- EVENTS ----------
if (dashboardCards.length) {
  dashboardCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter || 'all';
      setFilter(filter);
    });
  });
}

if (searchInput) {
  searchInput.addEventListener('keydown', async event => {
    if (event.key === 'Enter') {
      await runAISearch(searchInput.value);
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    currentFilter = 'all';
    if (searchInput) searchInput.value = '';
    await loadMemories();
  });
}

if (saveMemoryBtn) {
  saveMemoryBtn.addEventListener('click', saveMemory);
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditor);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeEditor);
if (saveBtn) saveBtn.addEventListener('click', saveChanges);

// ---------- INIT ----------
injectFilterBar();
loadMemories();
