// Minimal iCalendar (RFC 5545) reader/writer. Browser-safe: no Node imports.

/** Join folded lines (CRLF/LF followed by a space or tab). */
export function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

/** Split a content line into { name, params, value }. Value stays escaped. */
export function parseLine(line) {
  // The first ':' outside a quoted parameter value ends the name/params part.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(';');
  const params = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/**
 * Parse ICS text into a component tree:
 * { name, props: [{ name, params, value }], children: [component] }
 */
export function parse(text) {
  const root = { name: 'ROOT', props: [], children: [] };
  const stack = [root];
  for (const line of unfold(text)) {
    if (!line.trim()) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    const top = stack[stack.length - 1];
    if (prop.name === 'BEGIN') {
      const comp = { name: prop.value.toUpperCase(), props: [], children: [] };
      top.children.push(comp);
      stack.push(comp);
    } else if (prop.name === 'END') {
      if (stack.length > 1) stack.pop();
    } else {
      top.props.push(prop);
    }
  }
  return root;
}

export function getProp(comp, name) {
  return comp.props.find((p) => p.name === name) ?? null;
}

export function getText(comp, name) {
  const p = getProp(comp, name);
  return p ? unescapeText(p.value) : null;
}

export function findAll(comp, name) {
  const out = [];
  const walk = (c) => {
    for (const ch of c.children) {
      if (ch.name === name) out.push(ch);
      walk(ch);
    }
  };
  walk(comp);
  return out;
}

export function unescapeText(value) {
  return value.replace(/\\([\\;,nN])/g, (_, ch) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

export function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Fold a content line to at most 75 octets per line without splitting UTF-8 characters. */
export function fold(line) {
  if (encoder.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = 74; // continuation lines start with a space
    }
    current += ch;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Serialize a component tree (as produced by parse or built by hand) to ICS text. */
export function serialize(comp) {
  const lines = [];
  const walk = (c) => {
    lines.push(`BEGIN:${c.name}`);
    for (const p of c.props) lines.push(fold(propToLine(p)));
    for (const ch of c.children) walk(ch);
    lines.push(`END:${c.name}`);
  };
  if (comp.name === 'ROOT') comp.children.forEach(walk);
  else walk(comp);
  return lines.join('\r\n') + '\r\n';
}

function propToLine({ name, params = {}, value }) {
  const paramText = Object.entries(params)
    .map(([k, v]) => `;${k}=${/[;:,]/.test(v) ? `"${v}"` : v}`)
    .join('');
  return `${name}${paramText}:${value}`;
}

/** Parse an ICS date-time value ("20261009T104500", optional "Z") into parts. */
export function parseDateTime(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(value.trim());
  if (!m) throw new Error(`Unsupported date-time value: ${value}`);
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  return { y: +y, mo: +mo, d: +d, h: +h, mi: +mi, s: +s, utc: Boolean(z) };
}

export function formatDateTime({ y, mo, d, h, mi, s }) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(y, 4)}${p(mo)}${p(d)}T${p(h)}${p(mi)}${p(s)}`;
}

/** Current time as an ICS UTC timestamp. */
export function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
