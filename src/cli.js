#!/usr/bin/env node
// umcal command line. Run `umcal help` for usage.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cleanText } from './clean.js';
import { resolveConfig, applyCliFlags, parseConfig } from './config.js';
import { renderCalendar } from './render.js';
import { fetchTimetable } from './source.js';

const USAGE = `umcal – clean WISE timetables

Usage:
  umcal clean <input.ics> [-o out.ics]       clean a downloaded timetable file
  umcal fetch [--t <id> | --url URL] [-o out.ics] [--raw]
                                             download (and clean) a timetable

Options:
  -c, --config <file>     JSON config, comments allowed (see docs/CONFIG.md)
  --keep-absences         keep "Službene odsotnosti"
  --keep-reserved         keep "Rezervirani termini"
  --no-alarm              no reminders`;

const OPTIONS = {
  config: { type: 'string', short: 'c' },
  output: { type: 'string', short: 'o' },
  t: { type: 'string' },
  url: { type: 'string' },
  raw: { type: 'boolean' },
  'keep-absences': { type: 'boolean' },
  'keep-reserved': { type: 'boolean' },
  'no-alarm': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

function loadConfig(values) {
  const user = values.config ? parseConfig(readFileSync(values.config, 'utf8')) : {};
  return applyCliFlags(resolveConfig(user), values);
}

function report(result) {
  const { events, removed, owner, format } = result;
  console.error(`${owner ?? 'unknown owner'} · format ${format} · ${events.length} events kept · removed ${removed.absences} absences, ${removed.reserved} reserved`);
}

function writeCleaned(result, output) {
  const ics = renderCalendar(result.events, { name: result.owner ? `Urnik – ${result.owner}` : 'Urnik', timezones: result.timezones });
  if (output) writeFileSync(output, ics);
  else process.stdout.write(ics);
}

function cmdClean(positionals, values) {
  const input = positionals[0];
  if (!input) throw new Error('clean: missing input file');
  const config = loadConfig(values);
  const result = cleanText(readFileSync(input, 'utf8'), config);
  report(result);
  writeCleaned(result, values.output ?? input.replace(/(\.ics)?$/i, '-clean.ics'));
}

async function cmdFetch(values) {
  const config = loadConfig(values);
  const { url, text } = await fetchTimetable(config.source);
  console.error(`Downloaded ${url}`);
  if (values.raw) {
    if (values.output) writeFileSync(values.output, text);
    else process.stdout.write(text);
    return;
  }
  const result = cleanText(text, config);
  report(result);
  writeCleaned(result, values.output);
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({ args: rest, options: OPTIONS, allowPositionals: true });
  if (!command || command === 'help' || values.help) {
    console.log(USAGE);
    return;
  }
  if (command === 'clean') return cmdClean(positionals, values);
  if (command === 'fetch') return cmdFetch(values);
  throw new Error(`Unknown command "${command}". Run "umcal help".`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
