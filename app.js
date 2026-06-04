import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://whotwmofqunhxxbrdvpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_muNMrMjZDHYxT616JNJZHQ_YErEnvUS';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

let allMemories = [];
let currentEditRow = null;
let currentFilter = 'all';
let currentSearchQuery = '';

let searchStatusFilter = 'all';
let searchPersonFilter = '';
let searchTopicFilter = '';
let searchDateFrom = '';
let searchDateTo = '';
let expandedSearchResultIds = new Set();

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}

function uniqueArray(values) {
  return Array.from(
    new Set(
      safeArray(values)
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )
  );
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

function getMemoryDateValue(row) {
  return row.memory_date || row.created_at || '';
}

function isSearchActive() {
  return Boolean(
    currentSearchQuery.trim() ||
    searchStatusFilter !== 'all' ||
    searchPersonFilter ||
    searchTopicFilter ||
    searchDateFrom ||
    searchDateTo
  );
}

function truncateText(value, maxLength = 280) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function shouldTruncateText(value, maxLength = 280) {
  return String(value || '').trim().length > maxLength;
}

function getActiveSearchLabel() {
  const parts = [];

  if (currentSearchQuery.trim()) parts.push(`Text: "${currentSearchQuery.trim()}"`);
  if (searchStatusFilter !== 'all') parts.push(`Status: ${searchStatusFilter}`);
  if (searchPersonFilter) parts.push(`Person: @${searchPersonFilter}`);
  if (searchTopicFilter) parts.push(`Topic: #${searchTopicFilter}`);
  if (searchDateFrom) parts.push(`From: ${searchDateFrom}`);
  if (searchDateTo) parts.push(`To: ${searchDateTo}`);

  return parts.length ? parts.join(' | ') : 'No search filters active';
}

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

/* ---------- SAFE LOCAL EXTRACTION: NEW MEMORIES ONLY ---------- */

function getKnownPeopleFromExistingMemories() {
  const knownPeople = new Set([
    'Drew',
    'Amanda Jackson',
    'Rose Walker',
    'Sam',
    'Cam Forrey',
    'Packy'
  ]);

  allMemories.forEach(row => {
    safeArray(row.people).forEach(person => {
      const cleaned = String(person || '').trim();
      if (cleaned) knownPeople.add(cleaned);
    });
  });

  return Array.from(knownPeople);
}

function extractPeopleLocal(rawText) {
  const text = String(rawText || '');
  const found = new Set();

  getKnownPeopleFromExistingMemories().forEach(person => {
    const escaped = person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');

    if (pattern.test(text)) {
      found.add(person);
    }
  });

  return Array.from(found).slice(0, 8);
}

function extractTopicsLocal(rawText) {
  const lower = String(rawText || '').toLowerCase();
  const topics = new Set();

  const rules = [
    { topic: 'Open Brain', terms: ['open brain', 'memory system', 'second brain'] },
    { topic: 'Search', terms: ['search', 'filter', 'results'] },
    { topic: 'Payroll', terms: ['payroll', 'caregiver pay', 'pay period'] },
    { topic: 'Scheduling', terms: ['schedule', 'scheduling', 'shift', 'appointment'] },
    { topic: 'Home Care', terms: ['home care', 'caregiver', 'client', 'hco'] },
    { topic: 'Gymnia', terms: ['gymnia', 'sugar cravings', 'sweet tooth', 'gymnema'] },
    { topic: 'VSL', terms: ['vsl', 'sales page', 'funnel page'] },
    { topic: 'Taxes', terms: ['tax', 'irs', 'franchise tax board', 'ftb'] },
    { topic: 'Workers Comp', terms: ['workers comp', 'state fund', 'berkshire'] },
    { topic: 'Finance', terms: ['invoice', 'cash flow', 'deposit', 'transfer', 'balance'] },
    { topic: 'Marketing', terms: ['ad', 'affiliate', 'copy', 'offer', 'landing page'] },
    { topic: 'Follow Up', terms: ['follow up', 'call back', 'reach out'] }
  ];

  rules.forEach(rule => {
    if (rule.terms.some(term => lower.includes(term))) {
      topics.add(rule.topic);
    }
  });

  const hashtags = String(rawText || '').match(/#[A-Za-z0-9][A-Za-z0-9\s_-]{1,40}/g) || [];

  hashtags.forEach(tag => {
    const cleaned = tag.replace(/^#/, '').trim();
    if (cleaned) topics.add(cleaned);
  });

  return Array.from(topics).slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODateOnly(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getNextWeekday(dayName) {
  const days = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const targetDay = days[String(dayName || '').toLowerCase()];
  if (targetDay === undefined) return null;

  const today = new Date();
  const result = new Date(today);
  let diff = targetDay - today.getDay();

  if (diff <= 0) diff += 7;

  result.setDate(today.getDate() + diff);
  return result;
}

function detectDueDateLocal(rawText) {
  const lower = String(rawText || '').toLowerCase();
  const today = new Date();

  if (/\btoday\b/.test(lower)) return toISODateOnly(today);
  if (/\btomorrow\b/.test(lower)) return toISODateOnly(addDays(today, 1));

  const inDaysMatch = lower.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDaysMatch) {
    return toISODateOnly(addDays(today, Number(inDaysMatch[1])));
  }

  const weekdayMatch = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    return toISODateOnly(getNextWeekday(weekdayMatch[2]));
  }

  const monthMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/i);
  if (monthMatch) {
    const month = monthMatch[1];
    const day = monthMatch[2];
    const year = monthMatch[3] || today.getFullYear();
    const parsed = new Date(`${month} ${day}, ${year}`);

    if (!Number.isNaN(parsed.getTime())) {
      return toISODateOnly(parsed);
    }
  }

  const numericDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericDateMatch) {
    const month = Number(numericDateMatch[1]) - 1;
    const day = Number(numericDateMatch[2]);
    let year = numericDateMatch[3] ? Number(numericDateMatch[3]) : today.getFullYear();

    if (year < 100) year += 2000;

    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) {
      return toISODateOnly(parsed);
    }
  }

  return null;
}

function extractActionItemsLocal(rawText) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const actionVerbs = [
    'call',
    'text',
    'email',
    'send',
    'pay',
    'schedule',
    'book',
    'submit',
    'review',
    'finish',
    'complete',
    'follow up',
    'check',
    'update',
    'renew',
    'file',
    'deposit',
    'transfer',
    'ask',
    'contact'
  ];

  const pieces = text
    .split(/(?:\.|\n|;|\band then\b|\bthen\b)/i)
    .map(piece => piece.trim())
    .filter(Boolean);

  const actions = [];

  pieces.forEach(piece => {
    const lower = piece.toLowerCase();

    const hasAction =
      actionVerbs.some(verb => lower.includes(verb)) ||
      lower.includes('need to') ||
      lower.includes('have to') ||
      lower.includes('must ') ||
      lower.includes('remind me');

    if (!hasAction) return;

    let cleaned = piece
      .replace(/^i\s+(need to|have to|must)\s+/i, '')
      .replace(/^remind me to\s+/i, '')
      .replace(/^please\s+/i, '')
      .trim();

    if (cleaned.length > 220) {
      cleaned = `${cleaned.slice(0, 220).trim()}...`;
    }

    if (cleaned) actions.push(cleaned);
  });

  return uniqueArray(actions).slice(0, 8);
}

function getLocalExtraction(rawText, selectedType) {
  const people = extractPeopleLocal(rawText);
  const topics = extractTopicsLocal(rawText);
  const actionItems = extractActionItemsLocal(rawText);
  const dueDate = detectDueDateLocal(rawText);
  const loopFields = detectOpenLoop(rawText);

  let type = selectedType || 'note';

  if (type === 'note' && dueDate) {
    type = 'reminder';
  } else if (type === 'note' && actionItems.length > 0) {
    type = 'task';
  }

  const loopStatus =
    loopFields.loop_status === 'neutral' && actionItems.length > 0
      ? 'open'
      : loopFields.loop_status;

  return {
    people,
    topics,
    action_items: actionItems,
    memory_date: dueDate,
    type,
    is_open_loop: loopStatus === 'open',
    loop_status: loopStatus
  };
}

/* ---------- SORTING ---------- */

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

function sortRowsNewestFirst(rows) {
  return [...rows].sort((a, b) => {
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

function getStaleOpenRows(rows) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return rows
    .filter(row => {
      const createdTime = new Date(row.created_at);
      return (
        getEffectiveLoopStatus(row) === 'open' &&
        !Number.isNaN(createdTime.getTime()) &&
        createdTime < sevenDaysAgo
      );
    })
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      return aTime - bTime;
    })
    .slice(0, 10);
}

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

  if (currentFilter === 'stale') {
    return getStaleOpenRows(rows);
  }

  return rows;
}

function getSemanticSearchTerms(query) {
  const lower = String(query || '').toLowerCase();

  const semanticGroups = [
    {
      triggers: ['caregiver', 'caregiver issue', 'staff', 'staffing'],
      related: [
        'caregiver',
        'shift',
        'missed shift',
        'no call',
        'no show',
        'late',
        'scheduling',
        'schedule',
        'client',
        'home care',
        'payroll',
        'complaint'
      ]
    },
    {
      triggers: ['payroll', 'pay', 'payment'],
      related: [
        'payroll',
        'pay period',
        'caregiver pay',
        'invoice',
        'cash flow',
        'deposit',
        'transfer',
        'balance',
        'workers comp'
      ]
    },
    {
      triggers: ['client', 'home care', 'patient'],
      related: [
        'client',
        'caregiver',
        'home care',
        'scheduling',
        'shift',
        'care plan',
        'family',
        'hospice'
      ]
    },
    {
      triggers: ['gymnia', 'affiliate', 'marketing'],
      related: [
        'gymnia',
        'affiliate',
        'clickbank',
        'offer',
        'vsl',
        'sales page',
        'funnel',
        'ad',
        'copy',
        'landing page'
      ]
    },
    {
      triggers: ['open brain', 'search', 'memory'],
      related: [
        'open brain',
        'memory',
        'search',
        'filter',
        'supabase',
        'vercel',
        'ai',
        'semantic',
        'extraction'
      ]
    }
  ];

  const terms = new Set(
    lower
      .split(/\s+/)
      .map(term => term.trim())
      .filter(Boolean)
  );

  semanticGroups.forEach(group => {
    const matched = group.triggers.some(trigger => lower.includes(trigger));

    if (matched) {
      group.related.forEach(term => terms.add(term));
    }
  });

  return Array.from(terms);
}

function getSearchableText(row) {
  return [
    row.content,
    row.type,
    ...safeArray(row.people),
    ...safeArray(row.topics),
    ...safeArray(row.action_items),
    row.loop_status,
    row.memory_date
  ]
    .join(' ')
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPlainWordSearch(query) {
  return /^[a-z0-9]+$/i.test(String(query || '').trim());
}

function getSemanticSearchDetails(row, query) {
  const cleanQuery = String(query || '').trim().toLowerCase();

  if (!cleanQuery) {
    return {
      score: 1,
      reasons: []
    };
  }

  const contentText = String(row.content || '').toLowerCase();
  const plainWordSearch = isPlainWordSearch(cleanQuery);

  let score = 0;
  const reasons = new Set();

  const exactWordPattern = new RegExp(`\\b${escapeRegExp(cleanQuery)}\\b`, 'i');

  if (exactWordPattern.test(contentText)) {
    score += 1000;
    reasons.add('Exact word in memory');
  } else if (contentText.includes(cleanQuery)) {
    score += 700;
    reasons.add('Text found in memory');
  }

  if (plainWordSearch && score === 0) {
    return {
      score: 0,
      reasons: []
    };
  }

  const searchableText = getSearchableText(row);
  const terms = getSemanticSearchTerms(cleanQuery);

  safeArray(row.people).forEach(person => {
    const lowerPerson = String(person).toLowerCase();

    if (lowerPerson.includes(cleanQuery)) {
      score += 80;
      reasons.add(`Person: @${person}`);
    }
  });

  safeArray(row.topics).forEach(topic => {
    const lowerTopic = String(topic).toLowerCase();

    if (lowerTopic.includes(cleanQuery)) {
      score += 70;
      reasons.add(`Topic: #${topic}`);
    }
  });

  safeArray(row.action_items).forEach(action => {
    if (String(action).toLowerCase().includes(cleanQuery)) {
      score += 40;
      reasons.add('Action item match');
    }
  });

  terms.forEach(term => {
    if (
      term &&
      term !== cleanQuery &&
      searchableText.includes(term)
    ) {
      score += 8;
    }
  });

  if (score < 120) {
    score = 0;
  }

  return {
    score,
    reasons: Array.from(reasons).slice(0, 4)
  };
}

function getSemanticSearchScore(row, query) {
  return getSemanticSearchDetails(row, query).score;
}


function applySearchText(rows) {
  const query = String(currentSearchQuery || '').trim().toLowerCase();

  if (!query) return rows;

return rows
    .map(row => {
      const searchDetails = getSemanticSearchDetails(row, query);

      return {
        ...row,
        _searchScore: searchDetails.score,
        _searchReasons: searchDetails.reasons
      };
    })
    .filter(row => row._searchScore > 0); 
}

function applySearchStatus(rows) {
  if (searchStatusFilter === 'all') return rows;

  if (searchStatusFilter === 'stale') {
    const staleIds = new Set(getStaleOpenRows(allMemories).map(row => String(row.id)));
    return rows.filter(row => staleIds.has(String(row.id)));
  }

  return rows.filter(row => getEffectiveLoopStatus(row) === searchStatusFilter);
}

function applySearchPerson(rows) {
  if (!searchPersonFilter) return rows;

  return rows.filter(row =>
    safeArray(row.people)
      .map(person => String(person).toLowerCase())
      .includes(searchPersonFilter.toLowerCase())
  );
}

function applySearchTopic(rows) {
  if (!searchTopicFilter) return rows;

  return rows.filter(row =>
    safeArray(row.topics)
      .map(topic => String(topic).toLowerCase())
      .includes(searchTopicFilter.toLowerCase())
  );
}

function applySearchDateRange(rows) {
  if (!searchDateFrom && !searchDateTo) return rows;

  const fromTime = searchDateFrom
    ? new Date(`${searchDateFrom}T00:00:00`).getTime()
    : null;

  const toTime = searchDateTo
    ? new Date(`${searchDateTo}T23:59:59`).getTime()
    : null;

  return rows.filter(row => {
    const dateValue = getMemoryDateValue(row);
    const rowTime = new Date(dateValue).getTime();

    if (Number.isNaN(rowTime)) return false;
    if (fromTime !== null && rowTime < fromTime) return false;
    if (toTime !== null && rowTime > toTime) return false;

    return true;
  });
}

function getSearchResultsRows() {
  let rows = [...allMemories];

  rows = applySearchText(rows);
  rows = applySearchStatus(rows);
  rows = applySearchPerson(rows);
  rows = applySearchTopic(rows);
  rows = applySearchDateRange(rows);

  const query = String(currentSearchQuery || '').trim();

  if (query) {
    return [...rows].sort((a, b) => {
      const scoreA = a._searchScore || 0;
      const scoreB = b._searchScore || 0;

      if (scoreB !== scoreA) return scoreB - scoreA;

      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;

      return bTime - aTime;
    });
  }

  return sortRowsNewestFirst(rows);
}
function getUniqueValues(fieldName) {
  const values = new Set();

  allMemories.forEach(row => {
    safeArray(row[fieldName]).forEach(value => {
      const cleaned = String(value || '').trim();
      if (cleaned) values.add(cleaned);
    });
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function highlightSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.classList.remove('highlight-section');
  void section.offsetWidth;
  section.classList.add('highlight-section');

  setTimeout(() => {
    section.classList.remove('highlight-section');
  }, 2000);
}

function scrollToSection(sectionId) {
  setTimeout(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    highlightSection(sectionId);
  }, 100);
}

function setFilterAndScroll(filter, sectionId) {
  currentFilter = filter;
  updateFilterButtons();
  updateDashboardCardStates();
  renderApp();
  scrollToSection(sectionId);
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
  document.querySelectorAll('.dashboard-filter-card').forEach(card => {
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
  } else if (currentFilter === 'stale') {
    label.textContent = 'Showing: Stale open loops only';
  }
}

function injectSearchUpgradeStyles() {
  if (document.getElementById('searchUpgradeStyles')) return;

  const style = document.createElement('style');
  style.id = 'searchUpgradeStyles';

  style.textContent = `
    .search-upgrade-panel {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(248, 250, 252, 0.98);
      backdrop-filter: blur(8px);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      margin: 18px 0;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }

    .search-results-section {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      margin: 18px 0;
      background: #ffffff;
    }

    .search-filter-details {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 12px;
      margin-top: 10px;
      background: #ffffff;
    }

    .search-filter-details summary {
      cursor: pointer;
      font-weight: 700;
      color: #0f172a;
    }

    .search-filter-details[open] summary {
      margin-bottom: 10px;
    }

    .search-filter-btn,
    .search-person-btn,
    .search-topic-btn,
    .compact-toggle-btn {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 7px 12px;
      margin: 3px;
      background: #ffffff;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .search-filter-btn.active,
    .search-person-btn.active,
    .search-topic-btn.active {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }

    .search-top-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
    }

    .active-search-label {
      font-size: 0.92rem;
      color: #475569;
      line-height: 1.4;
    }

    .compact-result-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 12px;
      background: #ffffff;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
    }

    .compact-result-card.open {
      border-color: #f97316;
      background: #fffaf5;
    }

    .compact-result-card.closed {
      opacity: 0.78;
      background: #f8fafc;
    }

    .compact-result-topline {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .compact-result-content {
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .compact-result-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .compact-result-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .compact-toggle-btn {
      border-radius: 8px;
      background: #f8fafc;
    }
  `;

  document.head.appendChild(style);
}

function resetSearchFilters() {
  currentSearchQuery = '';
  searchStatusFilter = 'all';
  searchPersonFilter = '';
  searchTopicFilter = '';
  searchDateFrom = '';
  searchDateTo = '';
  expandedSearchResultIds = new Set();

  if (searchInput) searchInput.value = '';

  const fromInput = document.getElementById('searchDateFrom');
  const toInput = document.getElementById('searchDateTo');

  if (fromInput) fromInput.value = '';
  if (toInput) toInput.value = '';

  renderApp();

  const panel = document.getElementById('searchUpgradePanel');
  if (panel) {
    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

function injectSearchUpgradePanel() {
  if (!searchInput) return;
  if (document.getElementById('searchUpgradePanel')) return;

  injectSearchUpgradeStyles();

  const panel = document.createElement('section');
  panel.id = 'searchUpgradePanel';
  panel.className = 'search-upgrade-panel';

  panel.innerHTML = `
    <div class="section-header">
      <h2>Search Upgrades</h2>
      <p>Search by text, status, person, topic, or custom date range.</p>
    </div>

    <div class="filter-wrap" id="searchStatusButtons">
      <button class="search-filter-btn active" data-search-status="all">All</button>
      <button class="search-filter-btn" data-search-status="open">Open only</button>
      <button class="search-filter-btn" data-search-status="closed">Closed only</button>
      <button class="search-filter-btn" data-search-status="neutral">Neutral only</button>
      <button class="search-filter-btn" data-search-status="stale">Stale only</button>
    </div>

    <div class="search-top-actions">
      <div id="activeSearchLabel" class="active-search-label">No search filters active</div>
      <button id="clearSearchFiltersTopBtn" type="button" class="search-filter-btn">Clear search filters</button>
    </div>

    <details class="search-filter-details">
      <summary>People filters</summary>
      <div id="searchPeopleButtons" class="filter-wrap"></div>
    </details>

    <details class="search-filter-details">
      <summary>Topic filters</summary>
      <div id="searchTopicButtons" class="filter-wrap"></div>
    </details>

    <details class="search-filter-details">
      <summary>Custom date range</summary>
      <div class="filter-wrap">
        <label>
          From:
          <input type="date" id="searchDateFrom">
        </label>
        <label>
          To:
          <input type="date" id="searchDateTo">
        </label>
        <button id="clearSearchFiltersBtn" type="button" class="search-filter-btn">Clear search filters</button>
      </div>
    </details>
  `;

  const searchParent = searchInput.closest('section') || searchInput.parentElement;

  if (searchParent && searchParent.parentNode) {
    searchParent.parentNode.insertBefore(panel, searchParent.nextSibling);
  } else {
    searchInput.insertAdjacentElement('afterend', panel);
  }

  const resultsSection = document.createElement('section');
  resultsSection.id = 'searchResultsSection';
  resultsSection.className = 'search-results-section';
  resultsSection.style.display = 'none';

  resultsSection.innerHTML = `
    <div class="section-header">
      <h2 id="searchResultsTitle">Search Results</h2>
      <p id="searchResultsSummary">Use the search box or filters above to find memories.</p>
    </div>
    <div id="searchResultsList" class="card-list"></div>
  `;

  panel.parentNode.insertBefore(resultsSection, panel.nextSibling);

  document.querySelectorAll('[data-search-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      searchStatusFilter = btn.dataset.searchStatus || 'all';
      expandedSearchResultIds = new Set();
      renderApp();

      const results = document.getElementById('searchResultsSection');
      if (results && isSearchActive()) {
        results.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  const fromInput = document.getElementById('searchDateFrom');
  const toInput = document.getElementById('searchDateTo');
  const clearBtn = document.getElementById('clearSearchFiltersBtn');
  const clearTopBtn = document.getElementById('clearSearchFiltersTopBtn');

  if (fromInput) {
    fromInput.addEventListener('change', () => {
      searchDateFrom = fromInput.value;
      expandedSearchResultIds = new Set();
      renderApp();
    });
  }

  if (toInput) {
    toInput.addEventListener('change', () => {
      searchDateTo = toInput.value;
      expandedSearchResultIds = new Set();
      renderApp();
    });
  }

  if (clearBtn) clearBtn.addEventListener('click', resetSearchFilters);
  if (clearTopBtn) clearTopBtn.addEventListener('click', resetSearchFilters);
}

function renderDynamicSearchButtons() {
  const peopleWrap = document.getElementById('searchPeopleButtons');
  const topicsWrap = document.getElementById('searchTopicButtons');

  if (peopleWrap) {
    const people = getUniqueValues('people');

    if (!people.length) {
      peopleWrap.innerHTML = `<div class="empty-state">No people tags saved yet.</div>`;
    } else {
      peopleWrap.innerHTML = `
        <button class="search-person-btn ${searchPersonFilter === '' ? 'active' : ''}" data-person="">All people</button>
        ${people.map(person => `
          <button class="search-person-btn ${searchPersonFilter === person ? 'active' : ''}" data-person="${escapeHtml(person)}">
            @${escapeHtml(person)}
          </button>
        `).join('')}
      `;

      peopleWrap.querySelectorAll('[data-person]').forEach(btn => {
        btn.addEventListener('click', () => {
          searchPersonFilter = btn.getAttribute('data-person') || '';
          expandedSearchResultIds = new Set();
          renderApp();
        });
      });
    }
  }

  if (topicsWrap) {
    const topics = getUniqueValues('topics');

    if (!topics.length) {
      topicsWrap.innerHTML = `<div class="empty-state">No topic tags saved yet.</div>`;
    } else {
      topicsWrap.innerHTML = `
        <button class="search-topic-btn ${searchTopicFilter === '' ? 'active' : ''}" data-topic="">All topics</button>
        ${topics.map(topic => `
          <button class="search-topic-btn ${searchTopicFilter === topic ? 'active' : ''}" data-topic="${escapeHtml(topic)}">
            #${escapeHtml(topic)}
          </button>
        `).join('')}
      `;

      topicsWrap.querySelectorAll('[data-topic]').forEach(btn => {
        btn.addEventListener('click', () => {
          searchTopicFilter = btn.getAttribute('data-topic') || '';
          expandedSearchResultIds = new Set();
          renderApp();
        });
      });
    }
  }

  const activeLabel = document.getElementById('activeSearchLabel');
  if (activeLabel) {
    activeLabel.textContent = getActiveSearchLabel();
  }

  document.querySelectorAll('[data-search-status]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.searchStatus === searchStatusFilter);
  });
}

function renderCompactSearchList(rows, targetEl, emptyMessage) {
  if (!targetEl) return;

  if (!rows.length) {
    targetEl.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  targetEl.innerHTML = rows.map(row => {
    const actions = safeArray(row.action_items);
    const searchReasons = safeArray(row._searchReasons);
    const people = safeArray(row.people);
    const topics = safeArray(row.topics);
    const status = getEffectiveLoopStatus(row);
    const rowId = String(row.id);
    const isExpanded = expandedSearchResultIds.has(rowId);
    const content = String(row.content || '');
    const actionText = actions.join(', ');
    const contentIsLong = shouldTruncateText(content, 320);
    const actionsAreLong = shouldTruncateText(actionText, 180);

    const displayedContent = isExpanded ? content : truncateText(content, 320);
    const displayedActions = isExpanded ? actionText : truncateText(actionText, 180);

    const toggleButton =
      contentIsLong || actionsAreLong
        ? `<button class="compact-toggle-btn" data-toggle-search-id="${escapeHtml(row.id)}">${isExpanded ? 'Show less' : 'Show full memory'}</button>`
        : '';

    return `
      <article class="compact-result-card ${status}">
        <div class="compact-result-topline">
          <div>
            <span class="${badgeClass(row.type)}">${escapeHtml(row.type || 'memory')}</span>
            <span class="loop-badge loop-${status}">
              ${status === 'open' ? '🔴 Open' : status === 'closed' ? '🟢 Closed' : '⚪ Neutral'}
            </span>
          </div>
          <span class="memory-date">${escapeHtml(formatDate(row.created_at))}</span>
        </div>

        <div class="compact-result-content">${escapeHtml(displayedContent)}</div>
        ${
  searchReasons.length
    ? `
    <div class="compact-result-meta">
      ${searchReasons.map(reason => `<span class="meta-chip">Why: ${escapeHtml(reason)}</span>`).join('')}
    </div>
    `
    : ''
}

        ${
          people.length || topics.length
            ? `
            <div class="compact-result-meta">
              ${people.map(person => `<span class="meta-chip">@${escapeHtml(person)}</span>`).join('')}
              ${topics.map(topic => `<span class="meta-chip">#${escapeHtml(topic)}</span>`).join('')}
            </div>
            `
            : ''
        }

        ${
          actions.length
            ? `
            <div class="action-box" style="line-height:1.5;overflow-wrap:anywhere;word-break:break-word;margin-top:10px;">
              <strong>Action items:</strong> ${escapeHtml(displayedActions)}
            </div>
            `
            : ''
        }

        <div class="compact-result-actions">
          ${toggleButton}
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

  targetEl.querySelectorAll('[data-toggle-search-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId = btn.getAttribute('data-toggle-search-id');

      if (expandedSearchResultIds.has(String(rowId))) {
        expandedSearchResultIds.delete(String(rowId));
      } else {
        expandedSearchResultIds.add(String(rowId));
      }

      renderApp();

      const section = document.getElementById('searchResultsSection');
      if (section) {
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  targetEl.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => openEditor(btn.getAttribute('data-edit-id')));
  });

  targetEl.querySelectorAll('[data-close-id]').forEach(btn => {
    btn.addEventListener('click', async () => markAsClosed(btn.getAttribute('data-close-id')));
  });

  targetEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => deleteMemory(btn.getAttribute('data-delete-id')));
  });
}

function renderSearchResults() {
  const section = document.getElementById('searchResultsSection');
  const title = document.getElementById('searchResultsTitle');
  const summary = document.getElementById('searchResultsSummary');
  const list = document.getElementById('searchResultsList');

  if (!section || !title || !summary || !list) return;

  const active = isSearchActive();
  section.style.display = active ? 'block' : 'none';

  if (!active) {
    list.innerHTML = '';
    return;
  }

  const rows = getSearchResultsRows();
  const queryText = currentSearchQuery.trim();

  title.textContent = 'Search Results';

  const summaryParts = [];

  if (queryText) summaryParts.push(`text contains "${queryText}"`);
  if (searchStatusFilter !== 'all') summaryParts.push(`status: ${searchStatusFilter}`);
  if (searchPersonFilter) summaryParts.push(`person: @${searchPersonFilter}`);
  if (searchTopicFilter) summaryParts.push(`topic: #${searchTopicFilter}`);
  if (searchDateFrom) summaryParts.push(`from: ${searchDateFrom}`);
  if (searchDateTo) summaryParts.push(`to: ${searchDateTo}`);

  summary.textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}${summaryParts.length ? ` — ${summaryParts.join(' | ')}` : ''}`;

  renderCompactSearchList(rows, list, 'No matching memories found.');
}

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
    setFilterAndScroll('closed', 'recentlyCompletedSection');
  });

  closedCard.parentNode.insertBefore(completedTodayCard, closedCard.nextSibling);
}

function isThisWeek(value) {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  const firstDayOfWeek = new Date(today);
  firstDayOfWeek.setDate(today.getDate() - today.getDay());

  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

  return date >= firstDayOfWeek && date <= lastDayOfWeek;
}

function updateDashboard(rows) {
  injectCompletedTodayCard();

  let weekCountEl = document.getElementById('completedWeekCount');

  if (!weekCountEl) {
    const todayCard = document.getElementById('completedTodayCount')?.closest('.dashboard-filter-card');

    if (todayCard && todayCard.parentNode) {
      const weekCard = document.createElement('div');
      weekCard.className = 'dashboard-filter-card';
      weekCard.dataset.filter = 'closed';

      weekCard.innerHTML = `
        <div class="stat-number" id="completedWeekCount">0</div>
        <div class="stat-label">Completed This Week</div>
      `;

      weekCard.style.cursor = 'pointer';

      weekCard.addEventListener('click', () => {
        setFilterAndScroll('closed', 'recentlyCompletedSection');
      });

      todayCard.parentNode.insertBefore(weekCard, todayCard.nextSibling);
      weekCountEl = document.getElementById('completedWeekCount');
    }
  }

  const completedTodayCount = document.getElementById('completedTodayCount');

  const total = rows.length;
  const open = rows.filter(r => getEffectiveLoopStatus(r) === 'open').length;
  const closed = rows.filter(r => getEffectiveLoopStatus(r) === 'closed').length;
  const neutral = rows.filter(r => getEffectiveLoopStatus(r) === 'neutral').length;

  const completedToday = rows.filter(r =>
    getEffectiveLoopStatus(r) === 'closed' && isToday(r.closed_at)
  ).length;

  const completedWeek = rows.filter(r =>
    getEffectiveLoopStatus(r) === 'closed' && isThisWeek(r.closed_at)
  ).length;

  const recentlyAdded = rows.filter(r => isToday(r.created_at)).length;

  if (totalMemoriesCount) totalMemoriesCount.textContent = total;
  if (openLoopsCount) openLoopsCount.textContent = open;
  if (neutralCount) neutralCount.textContent = neutral;
  if (closedCount) closedCount.textContent = closed;

  if (completedTodayCount) completedTodayCount.textContent = completedToday;
  if (weekCountEl) weekCountEl.textContent = completedWeek;

  let addedEl = document.getElementById('recentlyAddedCount');

  if (!addedEl) {
    const weekCard = document.getElementById('completedWeekCount')?.closest('.dashboard-filter-card');

    if (weekCard && weekCard.parentNode) {
      const card = document.createElement('div');
      card.className = 'dashboard-filter-card';
      card.dataset.filter = 'all';

      card.innerHTML = `
        <div class="stat-number" id="recentlyAddedCount">0</div>
        <div class="stat-label">Recently Added</div>
      `;

      card.style.cursor = 'pointer';

      card.addEventListener('click', () => {
        setFilterAndScroll('all', 'memoryList');
      });

      weekCard.parentNode.insertBefore(card, weekCard.nextSibling);
      addedEl = document.getElementById('recentlyAddedCount');
    }
  }

  if (addedEl) addedEl.textContent = recentlyAdded;

  let staleEl = document.getElementById('staleOpenCount');
  const staleOpen = getStaleOpenRows(rows).length;

  if (!staleEl) {
    const addedCard = document.getElementById('recentlyAddedCount')?.closest('.dashboard-filter-card');

    if (addedCard && addedCard.parentNode) {
      const card = document.createElement('div');
      card.className = 'dashboard-filter-card';
      card.dataset.filter = 'stale';

      card.innerHTML = `
        <div class="stat-number" id="staleOpenCount">0</div>
        <div class="stat-label">Stale Open</div>
      `;

      card.style.cursor = 'pointer';

      card.addEventListener('click', () => {
        setFilterAndScroll('stale', 'staleOpenSection');
      });

      addedCard.parentNode.insertBefore(card, addedCard.nextSibling);
      staleEl = document.getElementById('staleOpenCount');
    }
  }

  if (staleEl) staleEl.textContent = staleOpen;
}

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

        ${
          row.memory_date
            ? `<div class="memory-closed-at">Detected date: ${escapeHtml(row.memory_date)}</div>`
            : ''
        }

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
    btn.addEventListener('click', () => openEditor(btn.getAttribute('data-edit-id')));
  });

  targetEl.querySelectorAll('[data-close-id]').forEach(btn => {
    btn.addEventListener('click', async () => markAsClosed(btn.getAttribute('data-close-id')));
  });

  targetEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => deleteMemory(btn.getAttribute('data-delete-id')));
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

  const shouldShowRecentlyCompleted = !isSearchActive() && (currentFilter === 'all' || currentFilter === 'closed');
  section.style.display = shouldShowRecentlyCompleted ? 'block' : 'none';

  if (!shouldShowRecentlyCompleted) return;

  renderList(getRecentlyClosedRows(allMemories), list, 'No recently completed memories yet.');
}

function renderStaleOpen() {
  let section = document.getElementById('staleOpenSection');

  if (!section) {
    section = document.createElement('section');
    section.id = 'staleOpenSection';
    section.className = 'recently-completed-section';

    section.innerHTML = `
      <div class="section-header">
        <h2>Stale Open Loops</h2>
        <p>Open items older than 7 days that need attention.</p>
      </div>
      <div id="staleOpenList" class="card-list"></div>
    `;

    const recentlyCompletedSection = document.getElementById('recentlyCompletedSection');

    if (recentlyCompletedSection && recentlyCompletedSection.parentNode) {
      recentlyCompletedSection.parentNode.insertBefore(section, recentlyCompletedSection.nextSibling);
    } else if (memoryList && memoryList.parentNode) {
      memoryList.parentNode.insertBefore(section, memoryList);
    }
  }

  const list = document.getElementById('staleOpenList');
  if (!section || !list) return;

  const shouldShow =
    !isSearchActive() &&
    (
      currentFilter === 'all' ||
      currentFilter === 'open' ||
      currentFilter === 'stale'
    );

  section.style.display = shouldShow ? 'block' : 'none';

  if (!shouldShow) return;

  renderList(getStaleOpenRows(allMemories), list, 'No stale open loops 🎉');
}

function renderApp() {
  injectSearchUpgradePanel();
  renderDynamicSearchButtons();

  const searchActive = isSearchActive();
  const priorityRows = allMemories.filter(hasOpenActionItems);
  const filteredRows = sortRowsForCurrentFilter(applyFilter(allMemories));

  const prioritySection = document.querySelector('.priority-section');
  const allSection = document.querySelector('.all-section');

  const shouldShowPriority = !searchActive && (currentFilter === 'all' || currentFilter === 'open');
  const shouldShowAllSection = !searchActive && currentFilter !== 'stale';

  updateDashboard(allMemories);

  if (prioritySection) prioritySection.style.display = shouldShowPriority ? 'block' : 'none';
  if (allSection) allSection.style.display = shouldShowAllSection ? 'block' : 'none';

  renderSearchResults();

  if (shouldShowPriority) renderList(priorityRows, priorityList, 'No open action items found.');

  renderRecentlyCompleted();
  renderStaleOpen();

  if (shouldShowAllSection) renderList(filteredRows, memoryList, 'No memories found for this filter.');

  updateFilterButtons();
  updateDashboardCardStates();
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

async function saveMemory() {
  if (!captureInput || !saveMemoryBtn) return;

  const rawText = captureInput.value.trim();
  if (!rawText) return;

  saveMemoryBtn.textContent = 'Saving...';
  saveMemoryBtn.disabled = true;

  const selectedType = typeSelect ? typeSelect.value : 'note';
  const extracted = getLocalExtraction(rawText, selectedType);

  const payload = {
    content: rawText,
    type: extracted.type,
    people: extracted.people,
    topics: extracted.topics,
    action_items: extracted.action_items,
    memory_date: extracted.memory_date,
    is_open_loop: extracted.is_open_loop,
    loop_status: extracted.loop_status
  };

  if (extracted.loop_status === 'closed') {
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

async function runAISearch(query) {
  currentSearchQuery = String(query || '').trim();
  expandedSearchResultIds = new Set();
  renderApp();
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
    .select('id, created_at, memory_date, content, people, topics, action_items, type, is_open_loop, loop_status, closed_at')
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

if (dashboardCards.length) {
  dashboardCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter || 'all';
      setFilter(filter);
    });
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    runAISearch(searchInput.value);
  });

  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runAISearch(searchInput.value);
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    currentFilter = 'all';
    currentSearchQuery = '';
    searchStatusFilter = 'all';
    searchPersonFilter = '';
    searchTopicFilter = '';
    searchDateFrom = '';
    searchDateTo = '';
    expandedSearchResultIds = new Set();

    if (searchInput) searchInput.value = '';

    const fromInput = document.getElementById('searchDateFrom');
    const toInput = document.getElementById('searchDateTo');

    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';

    await loadMemories();
  });
}

if (saveMemoryBtn) {
  saveMemoryBtn.addEventListener('click', saveMemory);
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditor);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeEditor);
if (saveBtn) saveBtn.addEventListener('click', saveChanges);

injectFilterBar();
injectSearchUpgradePanel();
loadMemories();
