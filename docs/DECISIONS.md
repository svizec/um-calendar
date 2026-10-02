# Decisions

Short log of choices agreed with the maintainer, newest last. Add an entry when a
choice is non-obvious or was discussed.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-10-01 | Two repos: public `svizec/um-calendar` (library, CLI, web page), private `svizec/um-calendar-sync` (personal config + scheduled sync) | Public Actions logs would expose the timetable; scheduled workflows in public repos are disabled after 60 days without activity; Pages needs a public repo on the free plan |
| 2 | 2026-10-01 | Sync via CalDAV into an existing iCloud calendar, diffing by UID | Keeps the calendar (and its sharing) intact; no re-sharing after changes; works for Mac, iPhone and Outlook (via iCloud for Windows) |
| 3 | 2026-10-01 | Everything in plain JavaScript, no dependencies, no build | One codebase for web page, CLI and GitHub Actions; the agent maintains the code |
| 4 | 2026-10-01 | Remove both "Službene odsotnosti" and "Rezervirani termini" by default, separate switch for each | Maintainer's request |
| 5 | 2026-10-01 | Renumber all sessions RV1, RV2…; "RV 1" in WISE is treated as "RV" | "RV 1" is considered a timetable inconsistency, not a separate series |
| 6 | 2026-10-01 | Title uses the abbreviation from config; subjects without one keep the full name; optional switch to show both | Maintainer's request |
| 7 | 2026-10-01 | Reminders on (15 min) | Maintainer's request |
| 15 | 2026-10-01 | Sync code (CalDAV client, diff/apply, credentials) lives only in the private repo; the public repo is cleaning + fetch + web page | Maintainer: code that isn't used publicly shouldn't be published. The public package exports a stable API (`um-calendar`, `um-calendar/source`) for the private repo |
| 14 | 2026-10-01 | Title always shows the full name with the abbreviation: `FULL NAME (ABBR) - RV1 (2h)`; `showFullName` defaults to true; the description then omits the repeated head line | Maintainer's request (supersedes the abbreviation-only default of #6) |
| 8 | 2026-10-01 | Past events are never deleted, even if WISE drops them | Keeps history; WISE normally keeps the whole semester anyway |
| 9 | 2026-10-01 | Key events by the WISE S-number (without date) so a moved slot is an update | Maintainer prefers "moved" over delete + create. Assumes WISE keeps the S-number when a slot moves – verify on the first real move |
| 10 | 2026-10-01 | Daily check (06:00), mode `confirm`: changes are posted as a GitHub issue and applied after approval (comment "potrdi", workflow run, or iPhone Shortcut) | iCloud does not notify you about your own account's changes; maintainer wants to see and confirm changes |
| 11 | 2026-10-01 | Only the iCloud calendar named `test` may be used until the maintainer changes `sync.calendar` | Safety while testing; the shared calendar must not be touched |
| 12 | 2026-10-01 | Colleagues' web page: manual download + drag & drop, processing in the browser | WISE sends no CORS headers, so a page cannot fetch it; avoids running a proxy. A proxy (e.g. Cloudflare Worker) with subscription links is a possible later extension |
| 13 | 2026-10-01 | Test fixtures from another assistant's public timetable (t=426), names anonymized | Maintainer's request; no personal timetable in a public repo |
