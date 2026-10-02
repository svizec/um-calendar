# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).

## [Unreleased]

## [0.4.5] - 2026-10-02

### Changed
- Web: the original-text switch moved to the right of the step 4 heading as "👁 Prikaži original".

## [0.4.4] - 2026-10-02

### Changed
- Web: both bookmarklets are offered in the top box with equal-height buttons and clearer names
  ("Počisti urnik WISE", "Prenesi očiščen urnik"). Their icons are CSS-only, so bookmark names contain no
  emoji (browsers always add a generic icon to bookmarklets).

## [0.4.3] - 2026-10-02

### Changed
- Web: removed the "Prikaži opis v predogledu" switch; descriptions show on hover, and inline together
  with the original text when "👁 Prikaži original v predogledu" is on. That switch now fits on one line.

## [0.4.2] - 2026-10-02

### Fixed
- Web: the loaded-file box with the ✕ button was always visible (its `display: flex` overrode `hidden`),
  so it stayed on screen before loading and after removing the file.

## [0.4.1] - 2026-10-02

### Changed
- Web: event descriptions in the preview are shown under the title only with "Prikaži opis v predogledu";
  otherwise rows stay compact and the description appears on hover.

## [0.4.0] - 2026-10-02

### Added
- `readWise` keeps each event's original text (`raw.summary`, `raw.description`, `raw.location`);
  `cleanText` returns all source events as `source`.
- Web: "👁 Prikaži original v predogledu" shows the original WISE text under every cleaned event and
  lists removed busy blocks (struck through). Preview only; not part of the downloaded file or bookmarklets.

## [0.3.4] - 2026-10-02

### Changed
- Web: the notice above the settings says where the timetable came from (WISE via bookmarklet or the
  uploaded file name) and is replaced on every load instead of piling up.

### Added
- Web: ✕ button to remove the loaded timetable (also drops its subjects that have no abbreviation).

## [0.3.3] - 2026-10-02

### Added
- Web: Tab or Enter in an empty abbreviation field accepts the suggested (grey) abbreviation and jumps
  to the next subject.

## [0.3.2] - 2026-10-02

### Changed
- Web preview shows each event's description (groups, co-teachers) under its title, so options like
  "Združi skupine" are visible before downloading.

## [0.3.1] - 2026-10-02

### Added
- Web page: "⬇️ Prenesi urnik WISE" bookmarklet that downloads the cleaned file directly on
  wise-tt.com, with the current options and abbreviations baked in.
- Web page: abbreviation list can be edited freely (add / remove subjects, also before loading a timetable);
  subjects of a loaded timetable are added automatically.

### Changed
- After the "open here" bookmarklet the page scrolls to the settings and shows a short notice.

## [0.3.0] - 2026-10-02

### Added
- `title.style`: `"full"` (default), `"short"` (abbreviation only), `"name"` (full name only).
  `title.showFullName: false` still works as `"short"`.
- Config files may contain `//` / `/* */` comments and trailing commas (`parseConfig`).
- Web page: bookmarklet that reads the timetable directly on wise-tt.com – no download/upload needed;
  title style selector.

## [0.2.0] - 2026-10-01

### Changed
- Titles show `FULL NAME (ABBR) - LV1 (2h)` by default (`title.showFullName: true`); the description no
  longer repeats the title in that case.

### Removed
- iCloud/CalDAV sync (`umcal calendars`, `umcal sync`, `caldav.js`, `sync.js`, `credentials.js`) moved
  to the private sync repo. The `sync` config section is no longer part of the defaults.

### Added
- Public API for other tools: ICS helpers, `normalizeTzid`, `applyCliFlags` from `um-calendar`; `fetchTimetable` from `um-calendar/source`.

## [0.1.0] - 2026-10-01

### Added
- Reader for the current WISE feed format and the older one-off export format.
- Cleaning: removes "Službene odsotnosti" and "Rezervirani termini" (separate switches), numbers
  sessions per subject/type/groups (`RV 1` treated as `RV`), counts school hours, compacts groups,
  subject abbreviations shown as `FULL NAME (ABBR)` (switchable to abbreviation only), co-teachers, reminders.
- `umcal` CLI: `clean`, `fetch`, `calendars`, `sync` (dry run by default, `--apply`, `--expect-hash`, safety blocks).
- Minimal CalDAV client for iCloud; sync touches only `umcal-` events in one exactly named calendar,
  treats moved slots as updates and never deletes past events.
- Web page for colleagues (GitHub Pages): drop a WISE `.ics`, download the cleaned one.
- Anonymized fixtures from a public timetable and `node:test` suites.
