# TODO

State on 2026-10-01: v0.2.0 – cleaning, fetch and web page; sync moved to the private repo.

## Next (needs the maintainer)
- [ ] Settings → Pages → Source: GitHub Actions, then re-run the Pages workflow.
- [ ] Repo description and website (svizec.github.io/um-calendar) in the About box.

## Verify on real data
- [ ] When WISE moves a slot, does the S-number stay the same? (DECISIONS #9; UIDs depend on it)
- [ ] Web page works on Safari/iOS and Outlook imports the cleaned file correctly.

## Later / ideas
- [ ] Optional proxy (e.g. Cloudflare Worker) so colleagues get a self-updating cleaned subscription link.
- [ ] Keep GitHub Action versions current (checkout, setup-node, pages actions).
