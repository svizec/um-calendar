#!/usr/bin/env node
// Regenerates test fixtures from a public WISE timetable, with all person names anonymized.
//
//   node scripts/make-fixtures.js [t=426]
//
// Writes test/fixtures/feed.ics (current feed format) and test/fixtures/export.ics
// (the same data converted to the older one-off export format).
// Never point this at the maintainer's own timetable (see AGENTS.md).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fetchTimetable } from '../src/source.js';
import { parse, findAll, getText, getProp, serialize, escapeText } from '../src/ics.js';

const t = Number(process.argv[2] ?? 426);
const OWNER = 'JANEZ NOVAK';
const OTHERS = ['MARIJA KOVAČ', 'PETER HORVAT', 'ANA KRAJNC', 'LUKA ZUPAN', 'MAJA POTOČNIK'];

const { text } = await fetchTimetable({ school: 'umfs', t, lang: 'sl' });
const root = parse(text);
const cal = root.children.find((c) => c.name === 'VCALENDAR');

// --- anonymize names ---
const realOwner = (getText(cal, 'X-WR-CALNAME') ?? '').split(/\s+[—–-]\s+/)[0].trim();
const names = new Map([[realOwner, OWNER]]);
const alias = (n) => {
  if (!names.has(n)) names.set(n, OTHERS[names.size - 1] ?? `UČITELJ ${names.size}`);
  return names.get(n);
};
for (const p of cal.props) if (p.name === 'X-WR-CALNAME') p.value = escapeText(`${OWNER} — umfs`);
for (const ev of findAll(cal, 'VEVENT')) {
  const d = getProp(ev, 'DESCRIPTION');
  if (!d) continue;
  const desc = getText(ev, 'DESCRIPTION').replace(/^Predavatelji: (.*)$/m, (_, list) => `Predavatelji: ${list.split(',').map((s) => alias(s.trim())).join(', ')}`);
  d.value = escapeText(desc);
}
writeFileSync(new URL('../test/fixtures/feed.ics', import.meta.url), serialize(root));

// --- convert to the export format ---
const uuid = (s) => {
  const h = createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const exportEvents = [];
for (const ev of findAll(cal, 'VEVENT')) {
  const summary = getText(ev, 'SUMMARY');
  if (summary === 'Rezervirani termini') continue; // not present in the export format
  const start = getProp(ev, 'DTSTART').value;
  const end = getProp(ev, 'DTEND').value;
  const props = [
    { name: 'UID', value: uuid(getText(ev, 'UID')) },
    { name: 'DTSTAMP', value: '20261001T111800Z' },
    { name: 'DTSTART', params: { TZID: 'Europe/Berlin' }, value: start },
    { name: 'DTEND', params: { TZID: 'Europe/Berlin' }, value: end },
  ];
  if (summary !== 'Službene odsotnosti') {
    const m = /^(.*?)\s*\(([A-ZČŠŽ]+(?: \d+)?)\)$/.exec(summary);
    const location = getText(ev, 'LOCATION') ?? '';
    const groups = (/Skupine: (.*)$/m.exec(getText(ev, 'DESCRIPTION') ?? '')?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    props.splice(1, 0, { name: 'LOCATION', value: escapeText(location) });
    props.push({ name: 'SUMMARY', value: escapeText(`${m[1]}, ${location}`) });
    props.push({ name: 'DESCRIPTION', value: escapeText([m[2], ...groups].join(', ')) });
  }
  exportEvents.push({ name: 'VEVENT', props, children: [] });
}
const exportCal = {
  name: 'VCALENDAR',
  props: [
    { name: 'VERSION', value: '2.0' },
    { name: 'CALSCALE', value: 'GREGORIAN' },
    { name: 'METHOD', value: 'PUBLISH' },
    { name: 'PRODID', value: `WISE TIMETABLE - ${OWNER}` },
    { name: 'X-WR-TIMEZONE', value: 'Europe/Berlin' },
  ],
  children: [
    parse(`BEGIN:VTIMEZONE\nTZID:Europe/Berlin\nX-LIC-LOCATION:Europe/Berlin\nBEGIN:DAYLIGHT\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19700329T020000\nRRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10\nEND:STANDARD\nEND:VTIMEZONE`).children[0],
    ...exportEvents,
  ],
};
writeFileSync(new URL('../test/fixtures/export.ics', import.meta.url), serialize(exportCal));
console.log(`Fixtures written from t=${t}: ${findAll(cal, 'VEVENT').length} feed events, ${exportEvents.length} export events.`);
