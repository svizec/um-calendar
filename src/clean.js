// Turns WISE events into compact, readable calendar events. Browser-safe.

import { parseDateTime } from './ics.js';
import { resolveConfig } from './config.js';
import { readWise } from './wise.js';

/**
 * @typedef {{
 *   uid: string, key: string,
 *   start: import('./wise.js').IcsTime, end: import('./wise.js').IcsTime,
 *   summary: string, location: string|null, description: string,
 *   alarmMinutes: number|null,
 * }} CleanEvent
 */

/** Parse WISE ICS text and return cleaned events plus metadata. */
export function cleanText(text, userConfig) {
  const config = resolveConfig(userConfig);
  const wise = readWise(text);
  const owner = config.owner ?? wise.owner;
  const result = cleanEvents(wise.events, { ...config, owner });
  return { ...result, owner, format: wise.format, timezones: wise.timezones, config };
}

/** @returns {{ events: CleanEvent[], removed: { absences: number, reserved: number } }} */
export function cleanEvents(wiseEvents, config) {
  const removed = { absences: 0, reserved: 0 };
  const kept = [];
  for (const e of wiseEvents) {
    if (e.kind === 'absence' && config.remove.absences) removed.absences++;
    else if (e.kind === 'reserved' && config.remove.reserved) removed.reserved++;
    else kept.push(e);
  }

  kept.sort((a, b) => a.start.value.localeCompare(b.start.value) || a.key.localeCompare(b.key));
  const numbers = sequenceNumbers(kept);

  const events = kept.map((e) => {
    if (e.kind !== 'class') {
      const title = e.kind === 'absence' ? 'Službene odsotnosti' : 'Rezervirani termini';
      return baseEvent(e, title, '', null);
    }
    const hours = schoolHours(e.start.value, e.end.value, config.lesson);
    const label = e.type ? `${e.type}${numbers.get(e) ?? ''}` : null;
    return baseEvent(
      e,
      buildTitle(e, label, hours, config),
      buildDescription(e, label, hours, config),
      config.alarmMinutes,
      e.location,
    );
  });

  return { events, removed };
}

function baseEvent(e, summary, description, alarmMinutes, location = null) {
  return { uid: `umcal-${e.key}`, key: e.key, start: e.start, end: e.end, summary, location, description, alarmMinutes };
}

/**
 * Number events 1..n in chronological order per (subject, type, set of groups).
 * "RV 1" in the source is treated as plain "RV".
 */
export function sequenceNumbers(classEvents) {
  const counters = new Map();
  const numbers = new Map();
  for (const e of classEvents) {
    if (e.kind !== 'class' || !e.type) continue;
    const k = [e.subject?.toUpperCase(), e.type, [...e.groups].sort().join('|')].join('#');
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    numbers.set(e, n);
  }
  return numbers;
}

/** Number of whole school hours (lesson + break cycles) that fit between start and end. */
export function schoolHours(startValue, endValue, lesson = { minutes: 45, breakMinutes: 10 }) {
  const toMinutes = (v) => {
    const t = parseDateTime(v);
    return Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi) / 60000;
  };
  const duration = toMinutes(endValue) - toMinutes(startValue);
  const cycle = lesson.minutes + lesson.breakMinutes;
  return Math.max(0, Math.floor((duration + lesson.breakMinutes) / cycle));
}

function subjectName(e, config) {
  const abbr = lookupAbbreviation(e.subject, config.abbreviations);
  if (!abbr) return e.subject;
  return config.title.showFullName ? `${e.subject} (${abbr})` : abbr;
}

function lookupAbbreviation(subject, abbreviations = {}) {
  if (!subject) return null;
  if (abbreviations[subject]) return abbreviations[subject];
  const upper = subject.toUpperCase();
  for (const [name, abbr] of Object.entries(abbreviations)) {
    if (name.toUpperCase() === upper) return abbr;
  }
  return null;
}

export function buildTitle(e, label, hours, config) {
  let title = subjectName(e, config);
  if (label) title += ` - ${label}`;
  if (hours > 0) title += ` (${hours}h)`;
  return title;
}

export function buildDescription(e, label, hours, config) {
  const lines = [];
  // Repeat the full subject name only when the title shows just the abbreviation.
  const abbreviated = lookupAbbreviation(e.subject, config.abbreviations) && !config.title.showFullName;
  if (abbreviated) {
    let head = e.subject;
    if (label) head += ` - ${label}`;
    if (hours > 0) head += ` (${hours}h)`;
    lines.push(head);
  }

  const groups = config.groups.compact ? compactGroups(e.groups) : e.groups;
  if (groups.length) lines.push(`Skupine: ${groups.join(config.groups.compact ? '; ' : ', ')}`);

  if (config.teachers.show) {
    const owner = config.owner?.toUpperCase();
    const others = e.teachers.filter((t) => t.toUpperCase() !== owner);
    if (others.length) lines.push(`Izvajalci: ${others.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * ["STR UN 3. l. KON - 1.sk.", "STR UN 3. l. KON - 2.sk.", "MEH VS 3. l."]
 *   -> ["STR UN 3. l. KON - sk. 1, 2", "MEH VS 3. l."]
 * Runs of three or more consecutive groups collapse into a range ("sk. 1-3").
 */
export function compactGroups(groups) {
  const pattern = /^(.*?)\s*-\s*(\d+)\.\s*sk\.?$/i;
  const order = [];
  const byBase = new Map();
  for (const g of groups) {
    const m = pattern.exec(g);
    if (!m) {
      if (!order.includes(g)) order.push(g);
      continue;
    }
    const base = m[1].trim();
    if (!byBase.has(base)) {
      byBase.set(base, []);
      order.push({ base });
    }
    byBase.get(base).push(Number(m[2]));
  }
  return order.map((item) => {
    if (typeof item === 'string') return item;
    const nums = [...new Set(byBase.get(item.base))].sort((a, b) => a - b);
    return `${item.base} - sk. ${formatNumbers(nums)}`;
  });
}

function formatNumbers(nums) {
  const parts = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) parts.push(`${nums[i]}-${nums[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(nums[k]));
    i = j + 1;
  }
  return parts.join(', ');
}
