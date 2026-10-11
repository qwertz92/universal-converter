# Open issues

One list of known open defects, by priority. Closed items are deleted — git
keeps them. P1 core function unusable / wrong data; P2 normal flow wrong or
clearly disturbing; P3 minor or rare; P4 not noticeable.

## P3

- **The fuel form's "Answer in" list offers targets the engine cannot reach.**
  (2026-10-11) With an energy input (`10 kWh diesel`) the volume and CO₂/CO₂e
  targets come back as an honest "no conversion path" row; in the cost form,
  Per = cm³, ft³, short or long ton returns `context_required`. No wrong
  number, but a choice that leads nowhere. Fix: filter the target list by what
  `convert` can produce for the chosen unit and fuel
  (`src/lib/components/converter/GuidedForm.svelte`). Effort: ~1 h.
- **A shared `?q=1e3 kWh` opens the guided form dimmed.** (2026-10-11) The
  parser accepts `1e3`, the form's `isAmount` (`src/lib/ui/guided.ts`) does not,
  so a correct result sits at 45% opacity under "Fill in an amount". Effort:
  ~15 min (accept the parser's number grammar, or open such links in text mode).
- **Guided mode records its examples as "recent".** (2026-10-11) Clicking a
  task tab runs its worked example, and `rememberSoon` in `Converter.svelte`
  stores it in the recent list 1.5 s later. Effort: ~15 min.
- **A grid picked in the Electricity task stays in later URLs** as
  `&region=…&year=…` after switching to Fuel. Numbers are unaffected
  (checked 2026-10-11); the Settings label names the grid. Effort: ~15 min.
- **The new radiogroups (mode switch, task strip) have no arrow-key
  navigation.** (2026-10-11) Each button is its own Tab stop and Enter/Space
  work, so they are operable, but not WAI-ARIA radio groups. Effort: ~30 min.

## P4

- **Rows in two-column result cards alternate between 48 and 64px** at about
  750–800px wide, where a longer value pushes the badge cluster to a second
  line. (2026-10-10) Static, nothing shifts on interaction.
- **The LHV/HHV heading's one-line explanation lives only in a `title`**
  (`src/lib/components/results/ResultGroupCard.svelte`), unreachable on touch
  and by keyboard; the "LHV vs. HHV" link next to it is reachable. (2026-10-10)
- **Hand-written `?pin=kwh` links no longer pin** (2026-10-11): pin symbols
  match exactly since the milli/mega fix (`src/lib/ui/pin.ts`). The app itself
  writes the exact symbol, so only hand-typed links are affected.
- **`/fuels/heavy-fuel-oil` and `/fuels/fuel-oil` land on `/fuels/heating-oil`**,
  because `data/fuels.json` names that entry "fuel oil" / "heavy fuel oil" (it is
  residual fuel oil; the id is the misleading part). A data-naming question, not
  a resolver bug. (2026-10-11)
- **Valid unit URLs in a different case answer HTTP 404 first.** `/units/MW`
  has no prerendered file (lower-case redirects only, for case-insensitive
  filesystems), so Cloudflare serves the static 404 shell, which then redirects
  in the browser to `/units/megawatt`. Visitors land right; a crawler sees 404.
  (2026-10-11, verified on the live site)
