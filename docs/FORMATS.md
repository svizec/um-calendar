# WISE formats and cleaned output

Observed October 2026 on `https://www.wise-tt.com/web/umfs/`. Fixtures: `test/fixtures/` (from public
timetable t=426, names anonymized).

## Input: "feed" (current)

Both the subscription link (`webcal://…/reports?t=<id>&lang=sl&format=ics`) and the page's
".ics" download return this format.

```
PRODID:-//Wise Technologies//Wise Timetable//EN
X-WR-CALNAME:<NAME> — umfs
UID:S2880-20261221@umfs.wise-tt.com            S-number = occurrence id, date appended
DTSTART;TZID=Europe/Ljubljana:20261221T123500
SUMMARY:VZVRATNO INŽENIRSTVO (LV)              type in parentheses, sometimes "(RV 1)"
LOCATION:S18-4
DESCRIPTION:Predavatelji: <NAMES>\nSkupine: IOI MAG 1. l. - 1.sk.\, IOI MAG 1. l. - 2.sk.
```

Busy blocks: `SUMMARY:Službene odsotnosti` and `SUMMARY:Rezervirani termini`, UID `R<uuid>-<date>@…`.
UIDs are stable between downloads. The feed's VTIMEZONE is unusual (first DAYLIGHT block with
+0200→+0200), so output always uses our own `Europe/Ljubljana` definition.

## Input: "export" (older one-off download, kept locally by the maintainer)

```
PRODID:WISE TIMETABLE - <NAME>
UID:<random uuid>                               not known to be stable between downloads
DTSTART;TZID=Europe/Berlin:20261009T104500
SUMMARY:RAČUNALNIŠKO OBLIKOVANJE\, J2-415     subject, room
DESCRIPTION:RV\, IOI UN 2. l.                                  type, groups…
```

Busy blocks have no SUMMARY/DESCRIPTION at all; they are treated as absences. `Europe/Berlin` is
rewritten to `Europe/Ljubljana` (same rules).

The even older format (`wtt_um_fs-…` UIDs, `SUMMARY:null` busy blocks, teacher in DESCRIPTION) is not
supported any more.

## Output

```
UID:umcal-S2880
SUMMARY:VZVRATNO INŽENIRSTVO (VI) - LV1 (3h)    full name (abbreviation) - type+number (school hours)
LOCATION:S18-4
DESCRIPTION:Skupine: IOI MAG 1. l. - sk. 1, 2[\nIzvajalci: <co-teachers>]
VALARM: DISPLAY, TRIGGER:-PT15M
```

- **Numbering:** 1..n chronologically per (subject, type, exact set of groups). `RV 1` counts as `RV`.
  Numbers are recomputed from the full semester each run; they only shift if a session is added or dropped.
- **School hours:** `floor((duration + 10) / 55)` – 45 min lessons with 10 min breaks.
- **Groups:** `X - 1.sk., X - 2.sk.` → `X - sk. 1, 2`; three or more consecutive → `sk. 1-3`; different bases joined with `; `.
- **Title:** with `title.showFullName: false` the title is `VI - LV1 (3h)` and the description starts with the full name.
- **Teachers:** the owner is never listed; co-teachers appear as `Izvajalci:`.
- **UID:** `umcal-` + WISE key. In the feed the key is the S-number without the date, so a slot moved to another day
  stays the same calendar event (sync updates it instead of delete + create).
