// Web page logic. The cleaning itself lives in ../src (copied to ./src when the site is built).
import { cleanText, renderCalendar, feedUrl, parseWiseLink, readWise } from './src/index.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'umcal-web-v1';

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) ?? {}; } catch { return {}; }
  },
  save(patch) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...this.load(), ...patch })); } catch { /* storage unavailable */ }
  },
};

const state = { text: null, fileName: null, abbreviations: store.load().abbreviations ?? {} };

// --- step 1: WISE id / link ---
function updateLink() {
  const raw = $('wise-id').value;
  const parsed = parseWiseLink(raw);
  const link = $('download-link');
  if (parsed) {
    link.href = feedUrl(parsed);
    link.removeAttribute('aria-disabled');
    $('id-hint').textContent = `Urnik ${parsed.t} (${parsed.school}). Prenesi datoteko in jo naloži v 2. koraku.`;
    store.save({ wiseId: raw.trim() });
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    $('id-hint').innerHTML = raw.trim()
      ? 'Tega ne prepoznam. Vpiši številko ali prilepi povezavo, ki vsebuje <code>t=</code>.'
      : 'ID je številka za <code>t=</code> v povezavi do tvojega urnika na wise-tt.com.';
  }
}

// --- step 2: file ---
async function loadFile(file) {
  if (!file) return;
  state.text = await file.text();
  state.fileName = file.name;
  $('file-name').textContent = file.name;
  renderAbbreviations();
  update();
}

// --- step 3: options ---
function options() {
  const showFull = $('opt-fullname').checked;
  const alarm = $('opt-alarm').checked ? Math.max(0, Number($('opt-alarm-min').value) || 0) : null;
  return {
    remove: { absences: $('opt-absences').checked, reserved: $('opt-reserved').checked },
    groups: { compact: $('opt-groups').checked },
    teachers: { show: $('opt-teachers').checked },
    title: { showFullName: showFull },
    alarmMinutes: alarm,
    abbreviations: Object.fromEntries(Object.entries(state.abbreviations).filter(([, v]) => v.trim())),
  };
}

const OPTION_IDS = ['opt-absences', 'opt-reserved', 'opt-groups', 'opt-teachers', 'opt-fullname', 'opt-alarm', 'opt-alarm-min'];

function saveOptions() {
  store.save({ options: Object.fromEntries(OPTION_IDS.map((id) => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value])) });
}

function restoreOptions() {
  const saved = store.load();
  for (const [id, v] of Object.entries(saved.options ?? {})) {
    const el = $(id);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  }
  if (saved.wiseId) $('wise-id').value = saved.wiseId;
}

function renderAbbreviations() {
  const list = $('abbr-list');
  let subjects = [];
  try {
    subjects = [...new Set(readWise(state.text).events.filter((e) => e.kind === 'class' && e.subject).map((e) => e.subject))].sort();
  } catch {
    /* reported by update() */
  }
  list.replaceChildren();
  if (!subjects.length) {
    list.innerHTML = '<p class="muted">V urniku ni predmetov.</p>';
    return;
  }
  for (const subject of subjects) {
    const row = document.createElement('label');
    row.className = 'abbr-row';
    const name = document.createElement('span');
    name.textContent = subject;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = suggest(subject);
    input.value = state.abbreviations[subject] ?? '';
    input.setAttribute('aria-label', `Kratica za ${subject}`);
    input.addEventListener('input', () => {
      state.abbreviations[subject] = input.value.trim();
      store.save({ abbreviations: state.abbreviations });
      updateAbbrCount();
      update();
    });
    row.append(name, input);
    list.append(row);
  }
  state.subjects = subjects;
  updateAbbrCount();
}

function updateAbbrCount() {
  const subjects = state.subjects ?? [];
  const filled = subjects.filter((s) => state.abbreviations[s]).length;
  $('abbr-count').textContent = subjects.length ? `(${filled}/${subjects.length})` : '';
}

/** Placeholder suggestion: initials of the significant words. */
function suggest(subject) {
  const skip = new Set(['IN', 'V', 'Z', 'S', 'ZA', 'NA', 'PRI', 'OD', 'DO', 'TER', 'ALI']);
  return subject.split(/\s+/).filter((w) => w && !skip.has(w.toUpperCase())).map((w) => w[0]).join('').toUpperCase();
}

// --- step 4: result ---
let lastResult = null;

function update() {
  saveOptions();
  if (!state.text) return;
  $('error').hidden = true;
  try {
    lastResult = cleanText(state.text, options());
  } catch (err) {
    lastResult = null;
    $('error').textContent = `Datoteke ni bilo mogoče prebrati: ${err.message}`;
    $('error').hidden = false;
    $('result').hidden = true;
    return;
  }
  const { events, removed, owner } = lastResult;
  $('stats').textContent =
    `${owner ? owner + ': ' : ''}${events.length} terminov · odstranjenih ${removed.absences} odsotnosti in ${removed.reserved} rezervacij`;
  const rows = events.map((e) => {
    const tr = document.createElement('tr');
    for (const text of [fmtDate(e.start.value), `${fmtTime(e.start.value)}–${fmtTime(e.end.value)}`, e.summary, e.location ?? '']) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    tr.title = e.description;
    return tr;
  });
  $('preview').replaceChildren(...rows);
  $('result').hidden = false;
}

const DAYS = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
function fmtDate(v) {
  const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}. ${y}`;
}
const fmtTime = (v) => `${v.slice(9, 11)}:${v.slice(11, 13)}`;

function save() {
  if (!lastResult) return;
  const name = lastResult.owner ? `Urnik – ${lastResult.owner}` : 'Urnik';
  const ics = renderCalendar(lastResult.events, { name, timezones: lastResult.timezones });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.fileName ?? 'urnik.ics').replace(/(\.ics)?$/i, '-clean.ics');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- wiring ---
restoreOptions();
updateLink();
$('wise-id').addEventListener('input', updateLink);
$('file').addEventListener('change', (e) => loadFile(e.target.files[0]));
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  loadFile(e.dataTransfer.files[0]);
});
for (const id of OPTION_IDS) $(id).addEventListener('input', update);
$('save').addEventListener('click', save);
