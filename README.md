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

**https://svizec.github.io/um-calendar/**

- **Bookmarklets (fastest):** drag one to your bookmarks bar once, open your timetable on wise-tt.com
  and click it.
  - *Počisti urnik WISE* opens the page with the timetable loaded (choose options there).
  - *Prenesi očiščen urnik* downloads the cleaned file at once, with the options and abbreviations
    that were set when you dragged it.
- **Manual:** enter your WISE id (`t=`), download the `.ics`, drop it on the page.

Then pick options, download the cleaned file and import it into your calendar. Nothing leaves your browser.

## Command line

Requires [Node.js](https://nodejs.org) 22+.

```bash
npx github:svizec/um-calendar clean urnik.ics            # -> urnik-clean.ics
npx github:svizec/um-calendar fetch --t <id> -o urnik.ics # download + clean
npx github:svizec/um-calendar help
```

Options can be stored in a JSON file (`-c config.jsonc`, comments allowed), see [docs/CONFIG.md](docs/CONFIG.md) and
[config.example.jsonc](config.example.jsonc).

## Development

```bash
npm test       # node:test
npm run web    # local web page at http://localhost:8080
```

See [AGENTS.md](AGENTS.md) for structure and rules, [docs/FORMATS.md](docs/FORMATS.md) for the WISE formats.
