// Renders cleaned events to ICS. Browser-safe.

import { escapeText, serialize, utcStamp } from './ics.js';

export const DEFAULT_TZID = 'Europe/Ljubljana';
// WISE exports sometimes label local time as Europe/Berlin; the DST rules are identical.
const TZID_ALIASES = { 'Europe/Berlin': DEFAULT_TZID };

export const PRODID = '-//umcal//WISE timetable cleaner//SL';

const LJUBLJANA_VTIMEZONE = {
  name: 'VTIMEZONE',
  props: [
    { name: 'TZID', value: DEFAULT_TZID },
    { name: 'X-LIC-LOCATION', value: DEFAULT_TZID },
  ],
  children: [
    {
      name: 'DAYLIGHT',
      props: [
        { name: 'TZOFFSETFROM', value: '+0100' },
        { name: 'TZOFFSETTO', value: '+0200' },
        { name: 'TZNAME', value: 'CEST' },
        { name: 'DTSTART', value: '19700329T020000' },
        { name: 'RRULE', value: 'FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU' },
      ],
      children: [],
    },
    {
      name: 'STANDARD',
      props: [
        { name: 'TZOFFSETFROM', value: '+0200' },
        { name: 'TZOFFSETTO', value: '+0100' },
        { name: 'TZNAME', value: 'CET' },
        { name: 'DTSTART', value: '19701025T030000' },
        { name: 'RRULE', value: 'FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU' },
      ],
      children: [],
    },
  ],
};

export function normalizeTzid(tzid) {
  return tzid ? (TZID_ALIASES[tzid] ?? tzid) : null;
}

function timeProp(name, t) {
  if (t.utc) return { name, value: `${t.value}Z` };
  const tzid = normalizeTzid(t.tzid);
  return tzid ? { name, params: { TZID: tzid }, value: t.value } : { name, value: t.value };
}

/**
 * Build a VEVENT component.
 * @param {import('./clean.js').CleanEvent} e
 * @param {{ stamp?: string, extraProps?: {name:string,value:string}[] }} [opts]
 */
export function eventComponent(e, { stamp = utcStamp(), extraProps = [] } = {}) {
  const props = [
    { name: 'UID', value: e.uid },
    { name: 'DTSTAMP', value: stamp },
    timeProp('DTSTART', e.start),
    timeProp('DTEND', e.end),
    { name: 'SUMMARY', value: escapeText(e.summary) },
  ];
  if (e.location) props.push({ name: 'LOCATION', value: escapeText(e.location) });
  if (e.description) props.push({ name: 'DESCRIPTION', value: escapeText(e.description) });
  props.push(...extraProps);

  const children = [];
  if (e.alarmMinutes != null) {
    children.push({
      name: 'VALARM',
      props: [
        { name: 'ACTION', value: 'DISPLAY' },
        { name: 'DESCRIPTION', value: escapeText(e.summary) },
        { name: 'TRIGGER', value: `-PT${Number(e.alarmMinutes)}M` },
      ],
      children: [],
    });
  }
  return { name: 'VEVENT', props, children };
}

function timezoneComponents(events, sourceTimezones = []) {
  const needed = new Set(events.flatMap((e) => [e.start, e.end]).filter((t) => !t.utc && t.tzid).map((t) => normalizeTzid(t.tzid)));
  const out = [];
  for (const tzid of needed) {
    if (tzid === DEFAULT_TZID) out.push(LJUBLJANA_VTIMEZONE);
    else {
      const src = sourceTimezones.find((tz) => tz.props.some((p) => p.name === 'TZID' && p.value === tzid));
      if (src) out.push(src);
    }
  }
  return out;
}

/** Full calendar file with all events. */
export function renderCalendar(events, { name, timezones = [], stamp = utcStamp() } = {}) {
  const props = [
    { name: 'VERSION', value: '2.0' },
    { name: 'PRODID', value: PRODID },
    { name: 'CALSCALE', value: 'GREGORIAN' },
    { name: 'METHOD', value: 'PUBLISH' },
  ];
  if (name) props.push({ name: 'X-WR-CALNAME', value: escapeText(name) });
  props.push({ name: 'X-WR-TIMEZONE', value: DEFAULT_TZID });
  const cal = {
    name: 'VCALENDAR',
    props,
    children: [...timezoneComponents(events, timezones), ...events.map((e) => eventComponent(e, { stamp }))],
  };
  return serialize(cal);
}

/** Calendar object holding a single event (one VEVENT plus its VTIMEZONE). */
export function renderEventObject(e, { timezones = [], stamp = utcStamp(), extraProps = [] } = {}) {
  const cal = {
    name: 'VCALENDAR',
    props: [
      { name: 'VERSION', value: '2.0' },
      { name: 'PRODID', value: PRODID },
      { name: 'CALSCALE', value: 'GREGORIAN' },
    ],
    children: [...timezoneComponents([e], timezones), eventComponent(e, { stamp, extraProps })],
  };
  return serialize(cal);
}
