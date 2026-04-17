import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://whotwmofqunhxxbrdvpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_muNMrMjZDHYxT616JNJZHQ_YErEnvUS';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM ELEMENTS
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

// STATE
let allMemories = [];
let currentFilter = 'all';

// HELPERS
function safeArray(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  return [String(v)];
}

function formatDate(v) {
  if (!v) return '';
  return new Date(v).toLocaleString();
}

function getLoopStatus(row) {
  if (row.is_open_loop === true) return 'open';
  if (row.loop_status === 'closed') return 'closed';
  return 'neutral';
}

// DASHBOARD COUNTS
function updateDashboard(rows) {
  const total = rows.length;
  const open = rows.filter(r => getLoopStatus(r) === 'open').length;
  const closed = rows.filter(r => getLoopStatus(r) === 'closed').length;
  const neutral = rows.filter(r => getLoopStatus(r) === 'neutral').length;

  if (totalMemoriesCount) totalMemoriesCount.textContent = total;
  if (openLoopsCount) openLoopsCount.textContent = open;
  if (neutralCount) neutralCount.textContent = neutral;
  if (closedCount) closedCount.textContent = closed;
}

// FILTER
function applyFilter(rows) {
  if (currentFilter === 'open') return rows.filter(r => getLoopStatus(r) === 'open');
  if (currentFilter === 'closed') return rows.filter(r => getLoopStatus(r) === 'closed');
  if (currentFilter === 'neutral') return rows.filter(r => getLoopStatus(r) === 'neutral');
  return rows;
}

// RENDER LIST
function renderList(rows, el) {
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `<div>No results</div>`;
    return;
  }

  el.innerHTML = rows.map(r => `
    <div class="memory-card">
      <div><strong>${r.type || 'memory'}</strong> — ${formatDate(r.created_at)}</div>
      <div>${r.content || ''}</div>

      ${
        safeArray(r.action_items).length
          ? `<div><strong>Action:</strong> ${safeArray(r.action_items).join(', ')}</div>`
          : ''
      }

      <div>
        <button onclick="deleteMemory('${r.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// MAIN RENDER
function renderApp() {
  const filtered = applyFilter(allMemories);
  const openItems = allMemories.filter(r => getLoopStatus(r) === 'open');

  updateDashboard(allMemories);

  renderList(openItems, priorityList);
  renderList(filtered, memoryList);
}

// LOAD DATA
async function loadMemories() {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  allMemories = data || [];
  renderApp();
}

// DELETE
window.deleteMemory = async function (id) {
  if (!confirm('Delete this memory?')) return;

  await supabase.from('memories').delete().eq('id', id);
  await loadMemories();
};

// SAVE MEMORY (NEW CLEAN VERSION)
async function saveMemory() {
  if (!captureInput) return;

  const text = captureInput.value.trim();
  if (!text) return;

  const payload = {
    content: text,
    type: typeSelect?.value || 'note',
    is_open_loop: text.toLowerCase().includes('need') || text.toLowerCase().includes('pay'),
    loop_status: 'open'
  };

  await supabase.from('memories').insert([payload]);

  captureInput.value = '';
  await loadMemories();
}

// EVENTS
if (saveMemoryBtn) {
  saveMemoryBtn.addEventListener('click', saveMemory);
}

if (searchInput) {
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.toLowerCase();
      const filtered = allMemories.filter(m =>
        JSON.stringify(m).toLowerCase().includes(q)
      );
      renderList(filtered, memoryList);
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', loadMemories);
}

// INIT
loadMemories();
