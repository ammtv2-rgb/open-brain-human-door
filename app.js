import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://whotwmofqunhxxbrdvpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_muNMrMjZDHYxT616JNJZHQ_YErEnvUS';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const priorityList = document.getElementById('priorityList');
const memoryList = document.getElementById('memoryList');
const openLoopsCount = document.getElementById('openLoopsCount');
const shownCount = document.getElementById('shownCount');

const editModal = document.getElementById('editModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveBtn = document.getElementById('saveBtn');

const editContent = document.getElementById('editContent');
const editPeople = document.getElementById('editPeople');
const editTopics = document.getElementById('editTopics');
const editActionItems = document.getElementById('editActionItems');
const editType = document.getElementById('editType');

let allMemories = [];
let currentEditRow = null;
let currentFilter = 'all';

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  return date.toLocaleString();
}

function badgeClass(type) {
  const cleaned = (type || '').toLowerCase();
  if (cleaned === 'note') return 'badge badge-note';
  if (cleaned === 'task') return 'badge badge-task';
  if (cleaned === 'reminder') return 'badge badge-reminder';
  if (cleaned === 'follow-up') return 'badge badge-follow-up';
  if (cleaned === 'appointment') return 'badge badge-reminder';
  if (cleaned === 'notification') return 'badge badge-reminder';
  return 'badge badge-default';
}

function ensureLoopStyles() {
  if (document.getElementById('loopStatusStyles')) return;

  const style = document.createElement('style');
  style.id = 'loopStatusStyles';
  style.textContent = `
    .filter-wrap {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 14px 0 18px 0;
    }

    .filter-btn {
      padding: 9px 14px;
      border: 1px solid #d9deea;
      border-radius: 999px;
      background: #fff;
      cursor: pointer;
      font: inherit;
    }

    .filter-btn.active {
      background: #111827;
      color: white;
      border-color: #111827;
    }

    .loop-badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
      margin-right: 8px;
    }

    .loop-open {
      background: #ffe5e5;
      color: #b00020;
    }

    .loop-closed {
      background: #e6f7ea;
      color: #157347;
    }

    .loop-neutral {
      background: #f1f3f5;
      color: #495057;
    }

    .memory-status-row {
      margin-top: 10px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .memory-list-label {
      font-size: 14px;
      margin: 8px 0 12px 0;
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);
}

function getLoopStatus(row) {
  const raw = String(row.loop_status || '').toLowerCase();

  if (raw === 'open' || row.is_open_loop === true) return 'open';
  if (raw === 'closed') return 'closed';
  return 'neutral';
}

function getLoopBadge(row) {
  const status = getLoopStatus(row);

  if (status === 'open') {
    return `<span class="loop-badge loop-open">🔴 Open</span>`;
  }

  if (status === 'closed') {
    return `<span class="loop-badge loop-closed">🟢 Closed</span>`;
  }

  return `<span class="loop-badge loop-neutral">⚪ Neutral</span>`;
}

function hasOpenActionItems(row) {
  return getLoopStatus(row) === 'open' || safeArray(row.action_items).length > 0;
}

function createMetaChips(items, prefix = '') {
  return safeArray(items)
    .filter(Boolean)
    .map(item => `<span class="meta-chip">${prefix}${item}</span>`)
    .join('');
}

function applyFilter(rows) {
  if (currentFilter === 'open') {
    return rows.filter(row => getLoopStatus(row) === 'open');
  }

  if (currentFilter === 'closed') {
    return rows.filter(row => getLoopStatus(row) === 'closed');
  }

  if (currentFilter === 'neutral') {
    return rows.filter(row => getLoopStatus(row) === 'neutral');
  }

  return rows;
}

function setFilter(filter) {
  currentFilter = filter;
  updateFilterButtons();
  renderApp();
}

window.setFilter = setFilter;

function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });
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
    label.textContent = 'Showing: Closed memories';
  } else if (currentFilter === 'neutral') {
    label.textContent = 'Showing: Neutral memories';
  }
}

function renderList(rows, targetEl, emptyMessage) {
  if (!targetEl) return;

  if (!rows.length) {
    targetEl.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  targetEl.innerHTML = rows.map(row => {
    const peopleChips = createMetaChips(row.people, '@');
    const topicChips = createMetaChips(row.topics, '#');
    const actions = safeArray(row.action_items);

    return `
      <article class="memory-card">
        <div class="memory-topline">
          <span class="${badgeClass(row.type)}">${row.type || 'memory'}</span>
          <span class="memory-date">${formatDate(row.created_at)}</span>
        </div>

        <div class="memory-content">${row.content || ''}</div>

        <div class="memory-status-row">
          ${getLoopBadge(row)}
        </div>

        <div class="meta-block">
          ${peopleChips}
          ${topicChips}
        </div>

        ${
          actions.length
            ? `<div class="action-box"><strong>Action items:</strong> ${actions.join(', ')}</div>`
            : ''
        }

        <div class="card-actions">
          <button class="primary-btn" data-edit-id="${row.id}">Edit</button>
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
}

function renderApp() {
  const priorityRows = allMemories.filter(hasOpenActionItems);
  const filteredRows = applyFilter(allMemories);

  if (openLoopsCount) openLoopsCount.textContent = priorityRows.length;
  if (shownCount) shownCount.textContent = filteredRows.length;

  renderList(priorityRows, priorityList, 'No open action items found.');
  renderList(filteredRows, memoryList, 'No memories found for this filter.');

  updateFilterButtons();
  updateMemoryListLabel();
}

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

function commaStringToArray(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
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
    'renew'
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

async function runAISearch(query) {
  try {
    const q = (query || '').trim();

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

async function loadMemories() {
  if (priorityList) {
    priorityList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }
  if (memoryList) {
    memoryList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }

  const { data, error } = await supabase
    .from('memories')
    .select('id, created_at, content, people, topics, action_items, type, is_open_loop, loop_status')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (priorityList) {
      priorityList.innerHTML = `<div class="empty-state">Error loading memories: ${error.message}</div>`;
    }
    if (memoryList) {
      memoryList.innerHTML = `<div class="empty-state">Please check your Supabase settings and table access.</div>`;
    }
    return;
  }

  allMemories = data || [];
  renderApp();
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

async function saveQuickMemory() {
  const captureTextarea = document.getElementById('quickCaptureInput');
  const quickSaveBtn = document.getElementById('quickSaveBtn');
  const quickCaptureType = document.getElementById('quickCaptureType');

  if (!captureTextarea || !quickSaveBtn) return;

  const rawText = captureTextarea.value.trim();
  if (!rawText) return;

  quickSaveBtn.textContent = 'Saving...';
  quickSaveBtn.disabled = true;

  let detectedType = quickCaptureType ? quickCaptureType.value : 'note';
  let actionItems = [];

  const lower = rawText.toLowerCase();

  if (
    lower.includes('need to') ||
    lower.includes('have to') ||
    lower.includes('must') ||
    lower.includes('pay') ||
    lower.includes('call') ||
    lower.includes('follow up') ||
    lower.includes('schedule') ||
    lower.includes('transfer') ||
    lower.includes('deposit')
  ) {
    if (detectedType === 'note') {
      detectedType = 'task';
    }

    actionItems = rawText
      .split(/\.|,|and/i)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s =>
        s.toLowerCase().includes('pay') ||
        s.toLowerCase().includes('call') ||
        s.toLowerCase().includes('need') ||
        s.toLowerCase().includes('deposit') ||
        s.toLowerCase().includes('transfer') ||
        s.toLowerCase().includes('follow up') ||
        s.toLowerCase().includes('schedule')
      );
  }

  const loopFields = detectOpenLoop(rawText);

  const payload = {
    content: rawText,
    type: detectedType,
    action_items: actionItems,
    is_open_loop: loopFields.is_open_loop,
    loop_status: loopFields.loop_status
  };

  const { error } = await supabase
    .from('memories')
    .insert([payload]);

  quickSaveBtn.textContent = 'Save Memory';
  quickSaveBtn.disabled = false;

  if (error) {
    alert(`Could not save memory: ${error.message}`);
    return;
  }

  captureTextarea.value = '';
  currentFilter = 'all';
  await loadMemories();
}

function injectCaptureBox() {
  if (document.getElementById('quickCaptureWrap')) return;
  if (!searchInput) return;

  const wrap = document.createElement('section');
  wrap.id = 'quickCaptureWrap';
  wrap.style.marginBottom = '24px';

  const title = document.createElement('h2');
  title.textContent = 'Quick capture';
  title.style.marginBottom = '10px';

  const textarea = document.createElement('textarea');
  textarea.id = 'quickCaptureInput';
  textarea.placeholder = 'Type or speak your thought here...';
  textarea.style.width = '100%';
  textarea.style.minHeight = '96px';
  textarea.style.padding = '14px';
  textarea.style.borderRadius = '16px';
  textarea.style.border = '1px solid #d9deea';
  textarea.style.boxSizing = 'border-box';
  textarea.style.marginBottom = '10px';
  textarea.style.font = 'inherit';
  textarea.style.resize = 'vertical';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '10px';
  controls.style.alignItems = 'center';
  controls.style.flexWrap = 'wrap';
  controls.style.marginBottom = '6px';

  const typeSelect = document.createElement('select');
  typeSelect.id = 'quickCaptureType';
  typeSelect.style.padding = '10px 12px';
  typeSelect.style.borderRadius = '12px';
  typeSelect.style.border = '1px solid #d9deea';
  typeSelect.style.font = 'inherit';

  ['note', 'task', 'reminder', 'follow-up', 'idea'].forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    typeSelect.appendChild(option);
  });

  const quickSaveBtn = document.createElement('button');
  quickSaveBtn.id = 'quickSaveBtn';
  quickSaveBtn.textContent = 'Save Memory';
  quickSaveBtn.className = 'primary-btn';
  quickSaveBtn.style.padding = '12px 18px';
  quickSaveBtn.addEventListener('click', saveQuickMemory);

  const note = document.createElement('div');
  note.textContent = 'Fast capture for desktop and iPhone. Use voice dictation on your phone keyboard if you want to speak instead of type.';
  note.style.fontSize = '14px';
  note.style.opacity = '0.8';

  controls.appendChild(typeSelect);
  controls.appendChild(quickSaveBtn);

  wrap.appendChild(title);
  wrap.appendChild(textarea);
  wrap.appendChild(controls);
  wrap.appendChild(note);

  const anchor = searchInput.parentElement;
  anchor.parentNode.insertBefore(wrap, anchor);
}

if (searchInput) {
  searchInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await runAISearch(searchInput.value);
    }
  });
}

if (refreshBtn) refreshBtn.addEventListener('click', async () => {
  currentFilter = 'all';
  if (searchInput) searchInput.value = '';
  await loadMemories();
});

if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditor);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeEditor);
if (saveBtn) saveBtn.addEventListener('click', saveChanges);

ensureLoopStyles();
injectCaptureBox();
injectFilterBar();
loadMemories();
