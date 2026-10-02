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

// Abbreviation list: [{ subject, abbr }]. Older versions stored a { subject: abbr } map.
function loadAbbrList() {
  const saved = store.load();
  if (Array.isArray(saved.abbrList)) return saved.abbrList;
  return Object.entries(saved.abbreviations ?? {}).map(([subject, abbr]) => ({ subject, abbr }));
}

const state = { text: null, fileName: null, abbrList: loadAbbrList() };

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
  if (file) loadText(await file.text(), file.name, `Naložena je datoteka »${file.name}«.`);
}

/** @param {string} source sentence shown above the settings, e.g. where the timetable came from */
function loadText(text, name, source) {
  state.text = text;
  state.fileName = name;
  $('file-name').textContent = name;
  $('loaded').hidden = false;
  $('load-notice').textContent = `${source} Preveri nastavitve in kratice, nato spodaj klikni »Prenesi očiščen urnik«.`;
  $('load-notice').hidden = false;
  mergeSubjectsFromFile();
  renderAbbreviations();
  update();
}

function clearFile() {
  // drop subjects that came only from this timetable and never got an abbreviation
  const fromFile = new Set((state.subjects ?? []).map((s) => s.toUpperCase()));
  state.abbrList = state.abbrList.filter((r) => r.abbr.trim() || !fromFile.has(r.subject.trim().toUpperCase()));
  saveAbbrList();
  Object.assign(state, { text: null, fileName: null, subjects: [] });
  lastResult = null;
  $('file').value = '';
  $('loaded').hidden = true;
  $('load-notice').hidden = true;
  $('error').hidden = true;
  $('result').hidden = true;
  $('preview').replaceChildren();
  renderAbbreviations();
}

// --- bookmarklet: runs on wise-tt.com (same origin as the timetable, so no CORS problem), gzips the
// timetable and opens this page with it in the URL fragment. The fragment never leaves the browser.
const PAGE_URL = new URL('./', location.href).href;
const MODULE_URL = new URL('./src/index.js', location.href).href;

const BOOKMARKLET_HEAD = `if(!/(^|\\.)wise-tt\\.com$/.test(location.hostname)){alert('Odpri svoj urnik na wise-tt.com in klikni zaznamek tam.');return}`
  + `const t=new URL(location.href).searchParams.get('t')||(document.querySelector('input[name=t]')||{}).value;`
  + `if(!t){alert('Ne najdem ID-ja urnika (t=). Odpri svoj urnik.');return}`
  + `const s=(location.pathname.match(/\\/web\\/([^/]+)/)||[])[1]||'umfs';`
  + `const r=await fetch('/web/'+s+'/reports?t='+encodeURIComponent(t)+'&lang=sl&format=ics');`;

function bookmarkletCode() {
  const page = JSON.stringify(PAGE_URL);
  const src = `(async()=>{${BOOKMARKLET_HEAD}`
    + `const z=new Uint8Array(await new Response(r.body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer());`
    + `let b='';for(let i=0;i<z.length;i+=32768)b+=String.fromCharCode(...z.subarray(i,i+32768));`
    + `location.href=${page}+'#wise='+encodeURIComponent(t)+'&ics='+btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')})()`;
  return `javascript:${encodeURIComponent(src)}`;
}

/**
 * "Instant" bookmarklet: same start, then imports the cleaning module from this site (GitHub Pages
 * sends CORS headers), cleans with the options baked in at drag time and downloads the file.
 */
function instantBookmarkletCode() {
  const src = `(async()=>{${BOOKMARKLET_HEAD}`
    + `const x=await r.text();const m=await import(${JSON.stringify(MODULE_URL)});const c=${JSON.stringify(options())};`
    + `const o=m.cleanText(x,c);const ics=m.renderCalendar(o.events,{name:o.owner?'Urnik – '+o.owner:'Urnik',timezones:o.timezones});`
    + `const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));`
    + `a.download='urnik-'+t+'-clean.ics';document.body.appendChild(a);a.click();a.remove()`
    + `})().catch(e=>alert('Urnika ni bilo mogoče prenesti: '+e.message))`;
  return `javascript:${encodeURIComponent(src)}`;
}

function refreshBookmarklets() {
  $('bookmarklet').href = bookmarkletCode();
  $('bookmarklet-instant').href = instantBookmarkletCode();
}

async function receiveFromWise() {
  const m = /^#wise=(\d+)&ics=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', PAGE_URL); // drop the data from the address bar
  try {
    const bin = atob(m[2].replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('no calendar');
    $('wise-id').value = m[1];
    updateLink();
    loadText(text, `urnik-${m[1]}.ics`, `Urnik ${m[1]} je naložen neposredno z WISE.`);
    $('s3').scrollIntoView({ behavior: 'smooth' });
  } catch {
    $('error').textContent = 'Urnika z WISE ni bilo mogoče prebrati. Poskusi znova ali uporabi ročni način.';
    $('error').hidden = false;
  }
}

// --- step 3: options ---
function options() {
  const alarm = $('opt-alarm').checked ? Math.max(0, Number($('opt-alarm-min').value) || 0) : null;
  return {
    remove: { absences: $('opt-absences').checked, reserved: $('opt-reserved').checked },
    groups: { compact: $('opt-groups').checked },
    teachers: { show: $('opt-teachers').checked },
    title: { style: $('opt-title').value },
    alarmMinutes: alarm,
    abbreviations: Object.fromEntries(
      state.abbrList.filter((r) => r.subject.trim() && r.abbr.trim()).map((r) => [r.subject.trim().toUpperCase(), r.abbr.trim()]),
    ),
  };
}

// opt-desc and opt-original only change the preview; they are not part of options() and not baked into bookmarklets
const OPTION_IDS = ['opt-absences', 'opt-reserved', 'opt-groups', 'opt-teachers', 'opt-title', 'opt-alarm', 'opt-alarm-min', 'opt-desc', 'opt-original'];

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

function saveAbbrList() {
  store.save({ abbrList: state.abbrList });
}

/** Add subjects of the loaded timetable that are not in the list yet (with an empty abbreviation). */
function mergeSubjectsFromFile() {
  let subjects = [];
  try {
    subjects = [...new Set(readWise(state.text).events.filter((e) => e.kind === 'class' && e.subject).map((e) => e.subject))].sort();
  } catch {
    return; // reported by update()
  }
  state.subjects = subjects;
  const known = new Set(state.abbrList.map((r) => r.subject.trim().toUpperCase()));
  for (const subject of subjects) if (!known.has(subject.toUpperCase())) state.abbrList.push({ subject, abbr: '' });
}

function renderAbbreviations() {
  const list = $('abbr-list');
  list.replaceChildren();
  if (!state.abbrList.length) {
    list.innerHTML = '<p class="muted">Ni predmetov. Naloži urnik ali dodaj predmet.</p>';
  }
  state.abbrList.forEach((row, i) => {
    const el = document.createElement('div');
    el.className = 'abbr-row edit';
    const subject = document.createElement('input');
    subject.type = 'text';
    subject.value = row.subject;
    subject.placeholder = 'IME PREDMETA';
    subject.setAttribute('aria-label', 'Ime predmeta');
    const abbr = document.createElement('input');
    abbr.type = 'text';
    abbr.maxLength = 16;
    abbr.value = row.abbr;
    abbr.placeholder = suggest(row.subject);
    abbr.setAttribute('aria-label', `Kratica za ${row.subject || 'predmet'}`);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button secondary remove';
    remove.textContent = '×';
    remove.title = 'Odstrani';
    remove.setAttribute('aria-label', `Odstrani ${row.subject || 'predmet'}`);
    subject.addEventListener('input', () => {
      row.subject = subject.value;
      abbr.placeholder = suggest(row.subject);
      abbreviationsChanged();
    });
    abbr.addEventListener('input', () => {
      row.abbr = abbr.value;
      abbreviationsChanged();
    });
    // Tab (or Enter) accepts the suggested abbreviation shown as placeholder in an empty field and
    // jumps to the next subject's abbreviation, so a whole list can be confirmed with Tab, Tab, Tab.
    abbr.addEventListener('keydown', (e) => {
      if (!((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter')) return;
      if (!abbr.value && abbr.placeholder) {
        abbr.value = abbr.placeholder;
        abbr.dispatchEvent(new Event('input'));
      }
      const next = abbr.closest('.abbr-row')?.nextElementSibling?.querySelectorAll('input')[1];
      if (next) {
        e.preventDefault();
        next.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
    remove.addEventListener('click', () => {
      state.abbrList.splice(i, 1);
      abbreviationsChanged();
      renderAbbreviations();
    });
    el.append(subject, abbr, remove);
    list.append(el);
  });
  updateAbbrCount();
}

function abbreviationsChanged() {
  saveAbbrList();
  updateAbbrCount();
  update();
}

function updateAbbrCount() {
  const total = state.abbrList.filter((r) => r.subject.trim()).length;
  const filled = state.abbrList.filter((r) => r.subject.trim() && r.abbr.trim()).length;
  $('abbr-count').textContent = total ? `(${filled}/${total})` : '';
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
  refreshBookmarklets();
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
  const rows = $('opt-original').checked ? comparisonRows(lastResult) : events.map((e) => previewRow(e));
  $('preview').replaceChildren(...rows);
  $('result').hidden = false;
}

const div = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });

/** One preview row. `original` (WISE event) adds the original text; `removed` marks a dropped block. */
function previewRow(e, { original, removed } = {}) {
  const tr = document.createElement('tr');
  if (removed) tr.className = 'removed';
  const cells = [fmtDate(e.start.value), `${fmtTime(e.start.value)}–${fmtTime(e.end.value)}`, null, removed ? '' : e.location ?? ''];
  for (const text of cells) {
    const td = document.createElement('td');
    if (text !== null) td.textContent = text;
    else if (removed) {
      td.append(div('ev-title', '🗑 Odstranjeno'), div('ev-orig', original.raw.summary || '(prazen blok zasedenosti)'));
    } else {
      // title plus the event description (groups, co-teachers) as it will appear in the calendar
      td.append(div('ev-title', e.summary));
      if (e.description && $('opt-desc').checked) td.append(div('ev-desc', e.description));
      else if (e.description) tr.title = e.description; // compact rows: description on hover
      if (original) {
        const raw = original.raw;
        const text = [raw.summary, raw.description, raw.location && raw.location !== e.location ? `Prostor: ${raw.location}` : null].filter(Boolean).join('\n');
        td.append(div('ev-orig', text || '(brez besedila)'));
      }
    }
    tr.append(td);
  }
  return tr;
}

/** All WISE events in order: cleaned ones with their original text, removed ones struck through. */
function comparisonRows(result) {
  const cleaned = new Map(result.events.map((e) => [e.key, e]));
  return [...result.source]
    .sort((a, b) => a.start.value.localeCompare(b.start.value))
    .map((o) => (cleaned.has(o.key) ? previewRow(cleaned.get(o.key), { original: o }) : previewRow(o, { original: o, removed: true })));
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
renderAbbreviations();
refreshBookmarklets();
for (const id of ['bookmarklet', 'bookmarklet-instant']) {
  $(id).addEventListener('click', (e) => {
    e.preventDefault();
    alert('Zaznamek povleci v vrstico z zaznamki, nato ga klikni na svojem urniku na wise-tt.com.');
  });
}
$('abbr-add').addEventListener('click', () => {
  state.abbrList.push({ subject: '', abbr: '' });
  renderAbbreviations();
  $('abbr-list').lastElementChild?.querySelector('input')?.focus();
});
receiveFromWise();
$('wise-id').addEventListener('input', updateLink);
$('file').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('file-clear').addEventListener('click', clearFile);
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
