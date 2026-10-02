// Configuration defaults and helpers. Browser-safe.

export const DEFAULTS = Object.freeze({
  source: {
    school: 'umfs', // path segment in https://www.wise-tt.com/web/<school>/
    t: null, // timetable id of the person, e.g. 426
    lang: 'sl',
    url: null, // full feed URL; overrides school/t/lang when set
  },
  remove: {
    absences: true, // "Službene odsotnosti" (and empty busy blocks in the export format)
    reserved: true, // "Rezervirani termini"
  },
  title: {
    showFullName: true, // "VZVRATNO INŽENIRSTVO (VI) - LV1 (3h)"; false: "VI - LV1 (3h)"
  },
  abbreviations: {}, // { "VZVRATNO INŽENIRSTVO": "VI" }; subjects without an entry keep the full name
  groups: { compact: true }, // "X - 1.sk., X - 2.sk." -> "X - sk. 1, 2"
  teachers: { show: true }, // list co-teachers in the description (the owner is never listed)
  owner: null, // whose timetable this is; auto-detected when null
  alarmMinutes: 15, // reminder before each class; null disables reminders
  lesson: { minutes: 45, breakMinutes: 10 }, // one school hour plus the break after it
  // Other top-level keys (e.g. "sync" used by tools built on umcal) are passed through untouched.
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function mergeConfig(base, override) {
  if (!isPlainObject(override)) return structuredClone(base);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(override)) {
    if (k.startsWith('$') || k.startsWith('//')) continue; // allow "$comment" / "//" keys in JSON
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? mergeConfig(out[k], v) : structuredClone(v);
  }
  return out;
}

export function resolveConfig(userConfig) {
  return mergeConfig(DEFAULTS, userConfig ?? {});
}

/** Apply the common CLI flags (--keep-absences, --keep-reserved, --no-alarm, --url, --t) to a resolved config. */
export function applyCliFlags(config, values = {}) {
  const out = structuredClone(config);
  if (values['keep-absences']) out.remove.absences = false;
  if (values['keep-reserved']) out.remove.reserved = false;
  if (values['no-alarm']) out.alarmMinutes = null;
  if (values.url) out.source = { ...out.source, ...(parseWiseLink(values.url) ?? {}), url: values.url };
  if (values.t) out.source = { ...out.source, t: Number(values.t), url: null };
  return out;
}

/** Build the WISE feed URL from config.source. */
export function feedUrl(source) {
  if (source.url) return source.url.replace(/^webcal:\/\//i, 'https://');
  if (!source.t) throw new Error('Missing timetable id: set source.t (e.g. 426) or source.url.');
  const school = encodeURIComponent(source.school || 'umfs');
  const params = new URLSearchParams({ t: String(source.t), lang: source.lang || 'sl', format: 'ics' });
  return `https://www.wise-tt.com/web/${school}/reports?${params}`;
}

/**
 * Extract { school, t, lang } from anything a user might paste: a bare id ("426"),
 * the timetable page link, the reports/ics link or a webcal:// link.
 */
export function parseWiseLink(input) {
  const text = String(input ?? '').trim();
  if (/^\d+$/.test(text)) return { school: 'umfs', t: Number(text), lang: 'sl' };
  let url;
  try {
    url = new URL(text.replace(/^webcal:\/\//i, 'https://'));
  } catch {
    return null;
  }
  const t = url.searchParams.get('t');
  const m = /\/web\/([^/]+)/.exec(url.pathname);
  if (!t || !/^\d+$/.test(t)) return null;
  return { school: m ? decodeURIComponent(m[1]) : 'umfs', t: Number(t), lang: url.searchParams.get('lang') || 'sl' };
}
