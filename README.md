# um-calendar

Cleans **WISE Timetable** calendars (UM FS) into a compact, readable form.

```
WISE:     VZVRATNO INŽENIRSTVO (LV)   + dozens of "Službene odsotnosti" blocks
cleaned:  VZVRATNO INŽENIRSTVO (VI) - LV3 (3h)          S18-4
          Skupine: IOI MAG 1. l. - sk. 1-3
```

- removes busy blocks ("Službene odsotnosti", "Rezervirani termini" – each switchable)
- numbers sessions per subject, type and group set (LV1, LV2 …) and counts school hours
- compacts groups, optional subject abbreviations, reminders

## For colleagues: web page

**https://svizec.github.io/um-calendar/** – enter your WISE id (`t=` in your timetable link), download the
`.ics`, drop it on the page, download the cleaned file and import it into your calendar. Nothing leaves your browser.

## Command line

Requires [Node.js](https://nodejs.org) 22+.

```bash
npx github:svizec/um-calendar clean urnik.ics            # -> urnik-clean.ics
npx github:svizec/um-calendar fetch --t <id> -o urnik.ics # download + clean
npx github:svizec/um-calendar help
```

Options can be stored in a JSON file (`-c config.json`), see [docs/CONFIG.md](docs/CONFIG.md) and
[config.example.json](config.example.json).

## Development

```bash
npm test       # node:test
npm run web    # local web page at http://localhost:8080
```

See [AGENTS.md](AGENTS.md) for structure and rules, [docs/FORMATS.md](docs/FORMATS.md) for the WISE formats.
