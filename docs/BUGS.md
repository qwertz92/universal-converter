# Open issues

One list of known open defects, by priority. Closed items are deleted — git
keeps them. P1 core function unusable / wrong data; P2 normal flow wrong or
clearly disturbing; P3 minor or rare; P4 not noticeable.

## P3

- **On a phone the options bar sits between the field and the results.**
  (2026-10-10) `/convert` at 375px: field at 316px, results at 739px; the
  LHV/HHV toggle and grid picker take ~140px of that. Moving or collapsing it is
  a design choice (it changes the results it sits above). Effort: ~1 h.

- **Lowercase symbol slugs pick the mega/tera prefix.** (2026-10-10)
  `/units/mw`, `/units/mwh`, `/units/mj` (and `pj`, `tj`, `tw`) are prerendered
  redirects to megawatt, megawatt-hour, megajoule…, built by lowercasing each
  primary symbol in `buildUnitSlugAliases` (`src/lib/ui/unit-slugs.ts`). A
  reader who meant milli lands 10^9 off; the catalog has no milliwatt or
  millijoule to compete. Dropping aliases whose symbol has an upper-case SI
  prefix removes the risk but also those short URLs — a product decision.
  Effort: ~30 min.

## P4

- **Rows in two-column result cards alternate between 48 and 64px** at about
  750–800px wide, where a longer value pushes the badge cluster to a second
  line. (2026-10-10) Static, nothing shifts on interaction.
- **The LHV/HHV heading's one-line explanation lives only in a `title`**
  (`src/lib/components/results/ResultGroupCard.svelte`), unreachable on touch
  and by keyboard; the "LHV vs. HHV" link next to it is reachable. (2026-10-10)
- **The static 404 fallback and the new fuel/unit redirects are untested on real
  Cloudflare Pages.** (2026-10-11) `fallback: 'spa'` in `svelte.config.js` and
  the prerendered `/fuels/natural_gas` redirect were verified only under
  `wrangler pages dev` (`npm run preview`), which on Windows also serves
  `/fuels/Diesel` and `/units/Kilowatt-Hour` from the lowercase file, so the
  case-variant path through the runtime redirect was checked with a spelling
  that has no file (`/fuels/Red_Diesel`, `/units/Kilowatt%20Hour`). After the
  next deploy, check `/units/MW`, `/units/nonsense`, `/fuels/Diesel` and
  `/learn/nonsense` once on the live domain (status 404 and the styled page; MW
  and Diesel end on the canonical page).
