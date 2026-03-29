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
  return 'badge badge-default';
}

function hasOpenActionItems(row) {
  return safeArray(row.action_items).length > 0;
}

function matchesSearch(row, term) {
  if (!term) return true;
  const q = term.toLowerCase();

  const combined = [
    row.content || '',
    ...(safeArray(row.people)),
    ...(safeArray(row.topics)),
    ...(safeArray(row.action_items)),
    row.type || ''
  ].join(' ').toLowerCase();

  return combined.includes(q);
}

function createMetaChips(items, prefix = '') {
  return safeArray(items)
    .filter(Boolean)
    .map(item => `<span class="meta-chip">${prefix}${item}</span>`)
    .join('');
}

function renderList(rows, targetEl, emptyMessage) {
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
  const term = searchInput.value.trim();

  const filtered = allMemories.filter(row => matchesSearch(row, term));
  const priorityRows = filtered.filter(hasOpenActionItems);
  const nonPriorityRows = filtered;

  openLoopsCount.textContent = priorityRows.length;
  shownCount.textContent = filtered.length;

  renderList(priorityRows, priorityList, 'No open action items found.');
  renderList(nonPriorityRows, memoryList, 'No memories match your search.');
}

function openEditor(rowId) {
  const row = allMemories.find(item => String(item.id) === String(rowId));
  if (!row) return;

  currentEditRow = row;

  editContent.value = row.content || '';
  editPeople.value = safeArray(row.people).join(', ');
  editTopics.value = safeArray(row.topics).join(', ');
  editActionItems.value = safeArray(row.action_items).join(', ');
  editType.value = row.type || '';

  editModal.classList.remove('hidden');
}

function closeEditor() {
  editModal.classList.add('hidden');
  currentEditRow = null;
}

function commaStringToArray(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

async function loadMemories() {
  priorityList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  memoryList.innerHTML = `<div class="empty-state">Loading memories...</div>`;

  const { data, error } = await supabase
    .from('memories')
    .select('id, uuid, created_at, content, people, topics, action_items, type')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    priorityList.innerHTML = `<div class="empty-state">Error loading memories: ${error.message}</div>`;
    memoryList.innerHTML = `<div class="empty-state">Please check your Supabase settings and table access.</div>`;
    return;
  }

  allMemories = data || [];
  renderApp();
}

async function saveChanges() {
  if (!currentEditRow) return;

  const payload = {
    content: editContent.value.trim(),
    people: commaStringToArray(editPeople.value),
    topics: commaStringToArray(editTopics.value),
    action_items: commaStringToArray(editActionItems.value),
    type: editType.value.trim()
  };

  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  const { error } = await supabase
    .from('memories')
    .update(payload)
    .eq('id', currentEditRow.id);

  saveBtn.textContent = 'Save changes';
  saveBtn.disabled = false;

  if (error) {
    alert(`Could not save changes: ${error.message}`);
    return;
  }

  closeEditor();
  await loadMemories();
}

searchInput.addEventListener('input', renderApp);
refreshBtn.addEventListener('click', loadMemories);
closeModalBtn.addEventListener('click', closeEditor);
modalBackdrop.addEventListener('click', closeEditor);
saveBtn.addEventListener('click', saveChanges);

loadMemories();