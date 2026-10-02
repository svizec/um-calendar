# Configuration

JSON file passed with `-c config.json`. Every key is optional; defaults live in `src/config.js`.
Keys starting with `$` (e.g. `$comment`) are ignored. Example: [`config.example.json`](../config.example.json).

| Key | Default | Meaning |
|---|---|---|
| `source.school` | `"umfs"` | WISE school path (`https://www.wise-tt.com/web/<school>/`) |
| `source.t` | – | timetable id of the person (`t=` in the WISE link); changes between years, so check it each semester |
| `source.lang` | `"sl"` | WISE language |
| `source.url` | – | full feed/webcal URL; overrides the three keys above |
| `remove.absences` | `true` | drop "Službene odsotnosti" (and empty busy blocks in the export format) |
| `remove.reserved` | `true` | drop "Rezervirani termini" |
| `abbreviations` | `{}` | `{ "FULL SUBJECT NAME": "ABBR" }`; subjects without an entry show only the full name |
| `title.showFullName` | `true` | title `FULL NAME (ABBR) - LV1 (2h)`; `false` gives `ABBR - LV1 (2h)` (the full name then moves to the description) |
| `groups.compact` | `true` | `X - 1.sk., X - 2.sk.` → `X - sk. 1, 2` |
| `teachers.show` | `true` | list co-teachers in the description |
| `owner` | auto | owner name (excluded from teachers); detected from the file |
| `alarmMinutes` | `15` | reminder before each class; `null` = no reminders |
| `lesson.minutes` / `lesson.breakMinutes` | `45` / `10` | school-hour arithmetic |

Unknown top-level keys (e.g. `sync`, used by tools built on umcal) are passed through unchanged.

CLI flags `--keep-absences`, `--keep-reserved`, `--no-alarm`, `--t`, `--url` override the file.
