// Reads WISE Timetable ICS exports into a common event model. Browser-safe.
//
// Supported formats (see docs/FORMATS.md):
//   "feed"   – subscription / download link (reports?...&format=ics), PRODID "-//Wise Technologies//..."
//   "export" – older one-off export, PRODID "WISE TIMETABLE - <NAME>", busy blocks have no SUMMARY

import { parse, findAll, getProp, getText, parseDateTime } from './ics.js';

export const ABSENCE_TITLE = 'Službene odsotnosti';
export const RESERVED_TITLE = 'Rezervirani termini';

const FEED_SUMMARY = /^(.*?)\s*\(([A-ZČŠŽ]{1,5})(?:\s*(\d+))?\)$/;

/**
 * @typedef {{ value: string, tzid: string|null, utc: boolean }} IcsTime
 * @typedef {{
 *   key: string, sourceUid: string,
 *   start: IcsTime, end: IcsTime,
 *   kind: 'class'|'absence'|'reserved',
 *   subject: string|null, type: string|null, rawType: string|null,
 *   location: string|null, groups: string[], teachers: string[],
 * }} WiseEvent
 */

/** @returns {{ format: 'feed'|'export', owner: string|null, events: WiseEvent[], timezones: object[] }} */
export function readWise(text) {
  const root = parse(text);
  const cal = root.children.find((c) => c.name === 'VCALENDAR');
  if (!cal) throw new Error('Not an iCalendar file (VCALENDAR missing).');

  const prodid = getText(cal, 'PRODID') ?? '';
  const vevents = findAll(cal, 'VEVENT');
  const format = detectFormat(prodid, vevents);
  const read = format === 'export' ? readExportEvent : readFeedEvent;
  const events = vevents.map(read).filter(Boolean);

  return {
    format,
    owner: detectOwner(cal, prodid, format, events),
    events: dedupeKeys(events),
    timezones: cal.children.filter((c) => c.name === 'VTIMEZONE'),
  };
}

function detectFormat(prodid, vevents) {
  if (/^WISE TIMETABLE\b/i.test(prodid)) return 'export';
  if (/Wise Technologies/i.test(prodid)) return 'feed';
  const summaries = vevents.map((e) => getText(e, 'SUMMARY')).filter(Boolean);
  return summaries.some((s) => FEED_SUMMARY.test(s)) ? 'feed' : 'export';
}

function readTimes(vevent) {
  const time = (name) => {
    const p = getProp(vevent, name);
    if (!p) return null;
    const { utc } = parseDateTime(p.value);
    return { value: p.value.replace(/Z$/, ''), tzid: p.params.TZID ?? null, utc };
  };
  const start = time('DTSTART');
  const end = time('DTEND') ?? start;
  return start ? { start, end } : null;
}

function readFeedEvent(vevent) {
  const times = readTimes(vevent);
  if (!times) return null;
  const uid = getText(vevent, 'UID') ?? '';
  const summary = (getText(vevent, 'SUMMARY') ?? '').trim();
  const description = getText(vevent, 'DESCRIPTION') ?? '';

  const lines = Object.fromEntries(
    description.split('\n').map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l.trim(), ''];
    }),
  );
  const teachers = splitList(lines['Predavatelji']);
  const groups = splitList(lines['Skupine']);

  // Occurrence UIDs look like "S2880-20261221@umfs.wise-tt.com". The S-number identifies the
  // occurrence, the date is appended, so keying by the S-number lets a moved slot stay the same event.
  const m = /^(S\d+)-\d{8}@/.exec(uid);
  const key = m ? m[1] : uid.replace(/@.*$/, '');

  const base = { key, sourceUid: uid, ...times, teachers, groups };
  if (!summary || summary === ABSENCE_TITLE) return { ...base, kind: 'absence', subject: null, type: null, rawType: null, location: null };
  if (summary === RESERVED_TITLE) return { ...base, kind: 'reserved', subject: null, type: null, rawType: null, location: null };

  const sm = FEED_SUMMARY.exec(summary);
  return {
    ...base,
    kind: 'class',
    subject: sm ? sm[1].trim() : summary,
    type: sm ? sm[2] : null,
    rawType: sm ? [sm[2], sm[3]].filter(Boolean).join(' ') : null,
    location: getText(vevent, 'LOCATION'),
  };
}

function readExportEvent(vevent) {
  const times = readTimes(vevent);
  if (!times) return null;
  const uid = getText(vevent, 'UID') ?? '';
  const summary = (getText(vevent, 'SUMMARY') ?? '').trim();
  const base = { key: uid, sourceUid: uid, ...times, teachers: [], groups: [] };
  // In this format busy blocks carry no SUMMARY; they correspond to "Službene odsotnosti".
  if (!summary || summary.toLowerCase() === 'null') {
    return { ...base, kind: 'absence', subject: null, type: null, rawType: null, location: null };
  }

  const location = getText(vevent, 'LOCATION');
  let subject = summary;
  const comma = summary.lastIndexOf(',');
  if (comma > 0 && (!location || summary.slice(comma + 1).trim() === location)) {
    subject = summary.slice(0, comma).trim();
  }

  const [first = '', ...groups] = splitList(getText(vevent, 'DESCRIPTION'));
  const tm = /^([A-ZČŠŽ]{1,5})(?:\s*(\d+))?$/.exec(first);
  return {
    ...base,
    kind: 'class',
    subject,
    type: tm ? tm[1] : null,
    rawType: tm ? first : null,
    location,
    groups: tm ? groups : [first, ...groups].filter(Boolean),
  };
}

function detectOwner(cal, prodid, format, events) {
  if (format === 'export') {
    const m = /^WISE TIMETABLE\s*-\s*(.+)$/i.exec(prodid);
    if (m) return m[1].trim();
  }
  const calname = getText(cal, 'X-WR-CALNAME');
  if (calname) {
    const name = calname.split(/\s+[—–-]\s+/)[0].trim();
    if (name) return name;
  }
  // Fall back to the most frequent teacher.
  const counts = new Map();
  for (const e of events) for (const t of e.teachers) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function splitList(text) {
  if (!text) return [];
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Keys must be unique; if WISE ever reuses an S-number, fall back to the full UID for the duplicates. */
function dedupeKeys(events) {
  const seen = new Set();
  for (const e of events) {
    if (seen.has(e.key)) e.key = e.sourceUid.replace(/@.*$/, '');
    seen.add(e.key);
  }
  return events;
}
