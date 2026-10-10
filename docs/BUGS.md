# Open issues

One list of known open defects, by priority. Closed items are deleted — git
keeps them. P1 core function unusable / wrong data; P2 normal flow wrong or
clearly disturbing; P3 minor or rare; P4 not noticeable.

## P3

- **A mistyped unit or fuel URL gets a bare "Not Found" on production.**
  (2026-10-10) `/units/*` and `/fuels/*` are prerendered and excluded from the
  Pages Function in `svelte.config.js`, so an unknown slug never reaches
  `src/routes/+error.svelte`; Cloudflare serves the adapter's plaintext
  `404.html`. The helpful near-miss link only shows in dev and on in-app
  navigation. Options: a prerendered `/404` page served as the static 404, or
  routing those paths through the Function. Effort: ~1 h plus a deployed check.
- **`/fuels/natural_gas` and `/fuels/Diesel` do not redirect** the way
  `/units/kWh` and `/units/kilowatt-hour` now do. (2026-10-10) Needs the
  `resolveUnitSlug` treatment in `src/routes/fuels/[fuel]/+page.ts`. Effort:
  ~30 min.
- **On a phone the options bar sits between the field and the results.**
  (2026-10-10) `/convert` at 375px: field at 316px, results at 739px; the
  LHV/HHV toggle and grid picker take ~140px of that. Moving or collapsing it is
  a design choice (it changes the results it sits above). Effort: ~1 h.

## P4

- **Rows in two-column result cards alternate between 48 and 64px** at about
  750–800px wide, where a longer value pushes the badge cluster to a second
  line. (2026-10-10) Static, nothing shifts on interaction.
- **The LHV/HHV heading's one-line explanation lives only in a `title`**
  (`src/lib/components/results/ResultGroupCard.svelte`), unreachable on touch
  and by keyboard; the "LHV vs. HHV" link next to it is reachable. (2026-10-10)
