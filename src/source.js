// Downloads a WISE timetable. Works in Node; in browsers WISE blocks it (no CORS headers).

import { feedUrl } from './config.js';

export const USER_AGENT = 'umcal (+https://github.com/svizec/um-calendar)';

export async function fetchTimetable(source, { fetchImpl = globalThis.fetch } = {}) {
  const url = feedUrl(source);
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar' } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error(`Download from ${url} is not an iCalendar file.`);
  return { url, text };
}
