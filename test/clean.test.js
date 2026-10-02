import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanText, compactGroups, schoolHours } from '../src/clean.js';
import { readWise } from '../src/wise.js';
import { renderCalendar } from '../src/render.js';
import { parse, findAll, getText } from '../src/ics.js';
import { feedUrl, parseWiseLink, parseConfig } from '../src/config.js';

const feed = readFileSync(new URL('./fixtures/feed.ics', import.meta.url), 'utf8');
const exp = readFileSync(new URL('./fixtures/export.ics', import.meta.url), 'utf8');

test('detects both WISE formats and the owner', () => {
  assert.equal(readWise(feed).format, 'feed');
  assert.equal(readWise(exp).format, 'export');
  assert.equal(readWise(feed).owner, 'JANEZ NOVAK');
  assert.equal(readWise(exp).owner, 'JANEZ NOVAK');
});

test('removes absences and reserved slots by default, each with its own switch', () => {
  const all = readWise(feed).events.length;
  const r = cleanText(feed);
  assert.ok(r.removed.absences > 0 && r.removed.reserved > 0);
  assert.equal(r.events.length + r.removed.absences + r.removed.reserved, all);
  assert.ok(r.events.every((e) => !/odsotnosti|Rezervirani/.test(e.summary)));

  const keepReserved = cleanText(feed, { remove: { reserved: false } });
  assert.equal(keepReserved.removed.reserved, 0);
  assert.equal(keepReserved.events.filter((e) => e.summary === 'Rezervirani termini').length, r.removed.reserved);
});

test('feed and export formats produce the same cleaned events', () => {
  const pick = (r) => r.events.map((e) => [e.start.value, e.end.value, e.summary, e.location, e.description]);
  assert.deepEqual(pick(cleanText(exp)), pick(cleanText(feed)));
});

test('numbers sessions per subject, type and group set in chronological order', () => {
  const titles = cleanText(feed).events.map((e) => e.summary);
  const lv = titles.filter((t) => t.startsWith('VZVRATNO INŽENIRSTVO - LV'));
  assert.deepEqual(lv.map((t) => /LV(\d+)/.exec(t)[1]), lv.map((_, i) => String(i + 1)));
});

test('"RV 1" in the source is numbered like plain "RV"', () => {
  const text = feed.replace(/\(RV\)/g, '(RV 1)');
  const titles = cleanText(text).events.map((e) => e.summary).filter((t) => t.includes(' - RV'));
  assert.ok(titles.length > 0);
  assert.ok(titles.every((t) => / - RV\d+ \(\dh\)$/.test(t)), titles.join('\n'));
});

test('abbreviations: "FULL NAME (ABBR)" by default, abbreviation only when switched off', () => {
  const cfg = { abbreviations: { 'VZVRATNO INŽENIRSTVO': 'VI' } };
  const full = cleanText(feed, cfg).events.find((x) => x.summary.startsWith('VZVRATNO INŽENIRSTVO (VI) - LV1 '));
  assert.ok(full);
  assert.match(full.description, /^Skupine: /);
  const short = cleanText(feed, { ...cfg, title: { style: 'short' } }).events.find((x) => x.key === full.key);
  assert.equal(short.summary, full.summary.replace('VZVRATNO INŽENIRSTVO (VI)', 'VI'));
  assert.match(short.description, /^VZVRATNO INŽENIRSTVO - LV1/);
  const legacy = cleanText(feed, { ...cfg, title: { showFullName: false } }).events.find((x) => x.key === full.key);
  assert.equal(legacy.summary, short.summary);
  const name = cleanText(feed, { ...cfg, title: { style: 'name' } }).events.find((x) => x.key === full.key);
  assert.equal(name.summary, full.summary.replace(' (VI)', ''));
  assert.throws(() => cleanText(feed, { ...cfg, title: { style: 'tiny' } }), /title.style/);
  // subjects without an abbreviation show only the full name
  assert.ok(cleanText(feed, cfg).events.some((x) => x.summary.startsWith('ESTETIKA IN SEMIOTIKA - ')));
});

test('config files may contain comments and trailing commas', () => {
  const cfg = parseConfig(`{
    // line comment
    "source": { "url": "https://www.wise-tt.com/web/umfs/?t=1" }, /* block */
    "abbreviations": { "A // B": "AB", },
  }`);
  assert.equal(cfg.source.url, 'https://www.wise-tt.com/web/umfs/?t=1');
  assert.deepEqual(cfg.abbreviations, { 'A // B': 'AB' });
});

test('school hours: 45 min lessons with 10 min breaks', () => {
  assert.equal(schoolHours('20261009T104500', '20261009T122500'), 2);
  assert.equal(schoolHours('20261009T104500', '20261009T123500'), 2);
  assert.equal(schoolHours('20261009T104500', '20261009T132000'), 3);
  assert.equal(schoolHours('20261009T080000', '20261009T084500'), 1);
  assert.equal(schoolHours('20261009T080000', '20261009T082000'), 0);
});

test('compacts groups', () => {
  assert.deepEqual(compactGroups(['A - 1.sk.', 'A - 2.sk.', 'B']), ['A - sk. 1, 2', 'B']);
  assert.deepEqual(compactGroups(['A - 1.sk.', 'A - 2.sk.', 'A - 3.sk.', 'A - 5.sk.']), ['A - sk. 1-3, 5']);
  assert.deepEqual(compactGroups(['A - 4.sk.']), ['A - sk. 4']);
});

test('rendered calendar is valid and round-trips', () => {
  const r = cleanText(feed);
  const ics = renderCalendar(r.events, { name: 'Test' });
  assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
  const events = findAll(parse(ics), 'VEVENT');
  assert.equal(events.length, r.events.length);
  assert.equal(getText(events[0], 'SUMMARY'), r.events[0].summary);
  assert.equal(getText(events[0], 'DESCRIPTION'), r.events[0].description);
  assert.equal(findAll(events[0], 'VALARM').length, 1);
  assert.match(ics, /TZID=Europe\/Ljubljana/);
  assert.doesNotMatch(ics, /Europe\/Berlin/);
});

test('alarms can be disabled', () => {
  const ics = renderCalendar(cleanText(feed, { alarmMinutes: null }).events);
  assert.doesNotMatch(ics, /VALARM/);
});

test('parses WISE links and ids', () => {
  assert.deepEqual(parseWiseLink('426'), { school: 'umfs', t: 426, lang: 'sl' });
  assert.deepEqual(parseWiseLink('https://www.wise-tt.com/web/umfs/?t=426&lang=sl'), { school: 'umfs', t: 426, lang: 'sl' });
  assert.deepEqual(parseWiseLink('webcal://www.wise-tt.com/web/umfs/reports?t=12&lang=en&format=ics'), { school: 'umfs', t: 12, lang: 'en' });
  assert.equal(parseWiseLink('nonsense'), null);
  assert.equal(feedUrl({ school: 'umfs', t: 426, lang: 'sl' }), 'https://www.wise-tt.com/web/umfs/reports?t=426&lang=sl&format=ics');
});

test('browser-safe modules do not import Node built-ins', () => {
  for (const f of ['index', 'ics', 'wise', 'clean', 'render', 'config']) {
    const src = readFileSync(new URL(`../src/${f}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from ['"]node:|require\(/, `${f}.js must stay browser-safe`);
  }
});
