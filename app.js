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
  if (cleaned === 'appointment') return 'badge badge-reminder';
  if (cleaned === 'notification') return 'badge badge-reminder';
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
    ...safeArray(row.people),
    ...safeArray(row.topics),
    ...safeArray(row.action_items),
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
  const term = searchInput ? searchInput.value.trim() : '';

  const filtered = allMemories.filter(row => matchesSearch(row, term));
  const priorityRows = filtered.filter(hasOpenActionItems);

  if (openLoopsCount) openLoopsCount.textContent = priorityRows.length;
  if (shownCount) shownCount.textContent = filtered.length;

  renderList(priorityRows, priorityList, 'No open action items found.');
  renderList(filtered, memoryList, 'No memories match your search.');
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

async function loadMemories() {
  if (priorityList) {
    priorityList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }
  if (memoryList) {
    memoryList.innerHTML = `<div class="empty-state">Loading memories...</div>`;
  }

  const { data, error } = await supabase
    .from('memories')
    .select('id, created_at, content, people, topics, action_items, type')
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

  const payload = {
    content: editContent ? editContent.value.trim() : '',
    people: editPeople ? commaStringToArray(editPeople.value) : [],
    topics: editTopics ? commaStringToArray(editTopics.value) : [],
    action_items: editActionItems ? commaStringToArray(editActionItems.value) : [],
    type: editType ? editType.value.trim() : ''
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

  closeEditor();
  await loadMemories();
}

async function saveQuickMemory() {
  const captureTextarea = document.getElementById('quickCaptureInput');
  const captureType = document.getElementById('quickCaptureType');
  const quickSaveBtn = document.getElementById('quickSaveBtn');

  if (!captureTextarea || !quickSaveBtn) return;

  const rawText = captureTextarea.value.trim();
  if (!rawText) return;

  quickSaveBtn.textContent = 'Saving...';
  quickSaveBtn.disabled = true;

  // 🔥 BASIC AI-LIKE EXTRACTION (rule-based for now)

  let detectedType = 'note';
  let actionItems = [];

  const lower = rawText.toLowerCase();

  // detect task language
  if (
    lower.includes('need to') ||
    lower.includes('have to') ||
    lower.includes('must') ||
    lower.includes('pay') ||
    lower.includes('call') ||
    lower.includes('follow up') ||
    lower.includes('schedule')
  ) {
    detectedType = 'task';

    // split into rough action items
    actionItems = rawText
      .split(/\.|,|and/i)
      .map(s => s.trim())
      .filter(s =>
        s.toLowerCase().includes('pay') ||
        s.toLowerCase().includes('call') ||
        s.toLowerCase().includes('need') ||
        s.toLowerCase().includes('deposit') ||
        s.toLowerCase().includes('transfer')
      );
  }

  const payload = {
    content: rawText,
    type: captureType ? captureType.value : detectedType,
    action_items: actionItems
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
  await loadMemories();
}
  const captureTextarea = document.getElementById('quickCaptureInput');
  const captureType = document.getElementById('quickCaptureType');
  const quickSaveBtn = document.getElementById('quickSaveBtn');

  if (!captureTextarea || !quickSaveBtn) return;

  const value = captureTextarea.value.trim();
  if (!value) return;

  quickSaveBtn.textContent = 'Saving...';
  quickSaveBtn.disabled = true;

  const payload = {
    content: value,
    type: captureType ? captureType.value : 'note'
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

if (searchInput) searchInput.addEventListener('input', renderApp);
if (refreshBtn) refreshBtn.addEventListener('click', loadMemories);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditor);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeEditor);
if (saveBtn) saveBtn.addEventListener('click', saveChanges);

injectCaptureBox();
loadMemories();
