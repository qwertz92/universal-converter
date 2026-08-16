# Changelog

All notable changes to Universal Converter. Versioning follows semver
(pre-1.0: minor bumps may include behavior changes; they are listed here).

## 0.3.0 — 2026-07-20

The release that makes the converter usable without reading the documentation
first. Everything here answers one question: does a normal person know what to
type, and does the tool say what it understood?

### Added

- **Conversion targets.** `5 kWh to MJ`, `1 kWh in kcal`, `1 L diesel -> kg`,
  `5 kWh = MJ` — the most natural phrasing there is. Before this release
  `5 kwh to mj` failed with `unknown material "to mj"`. The requested row is
  now computed (even when that unit is outside the default display list),
  floated to the top of its group, echoed as `result.target`, and shown as a
  headline answer card. It **highlights** — every other group still appears,
  because the assumptions around a number are the point of this tool.
- **Durations.** `5 kW for 3 h`, `2 kW × 30 min`, `5 kW for an hour`. The
  power→energy prompt asked for a duration and offered nowhere to enter one; it
  now carries a duration control, and applying it writes `for 3 h` into the
  query so it stays visible, editable and shareable. Nothing is ever assumed.
- **Unit autocomplete in the main input**, grouped by dimension, with the full
  ARIA combobox keyboard model (arrows, Tab/Enter to accept, Escape). The
  catalog is discoverable from the keyboard instead of from `/units`.
- **A live interpretation line** under the input stating what the engine
  understood — value, unit with its full name and dimension, material,
  duration, target — or exactly what is still missing. Its height is reserved
  and its text clamped, so typing never moves the page.
- **Starter-unit chips** when a value was typed without a unit, plus an
  explicit "the unit is never guessed" explanation.
- **Conversational phrasing**: `convert 5 kwh to mj`,
  `how many kWh in 1 liter diesel?`. A question whose wanted half is not a unit
  ("how much CO₂ is in 1 L diesel") still converts the source.
- **Recent conversions**, browser-local only, offered as chips in the empty
  state (roadmap 0.3 "saved scenarios" — the half that needs no new data).
- A filter box on the Learn index, three quick examples for the new grammar,
  and `/` to focus the converter from anywhere on the page.

### Changed

- Result groups that produced a number now come **before** groups that only ask
  for context: `1 kg` leads with Mass, not with the "pick a fuel" prompt.
- Error messages say something true instead of guessing. Unknown materials
  suggest real fuels (`1 barrel oil` → crude oil); unit suggestions must be
  close _relative to the shorter string_, so `1 mile` no longer proposes
  `mtoe`; and quantities this tool genuinely does not model — temperature,
  length, pressure, speed, storage, currency, concentration — are named as out
  of scope with the reason. That table is consulted only after the catalog
  fails to resolve a token, so it can never shadow a real unit.
- The exactness badge links to the legend; its meaning lived only in a `title`
  tooltip, which does not exist on touch.
- Catalog notes are written for readers. `/fuels/electricity` used to tell
  visitors its CO₂e was "`context_required` by default (rulebook §C.6, spec
  §9.6)". No figure changed — only the prose.
- Group blurbs ("CO₂ and CO₂e are separate") are no longer hidden on phones;
  warning severity is spelled out; pollutant labels use CO₂/CH₄/N₂O; the fuel
  prompt says "pick a fuel"; Scope 3 gets a plain-language gloss.
- About, the home page, the methodology page and the electricity Learn article
  no longer describe a v0.1 that does not ship region/year grid factors.

### Fixed

- **The page scrolled sideways on a phone**: 101px on `/convert`, 451px on
  `/sources`, 5px on fuel pages. Three independent causes — a `<select>` that
  could not shrink, source labels demanding a fixed 16rem inside unshrinkable
  ancestors, and raw URLs in source notes that no browser breaks on its own.
- `/fuels/electricity` built the worked example "1 L electricity" — a category
  error on the page for the one fuel that has no volume.
- The exactness badge renders as a plain span inside `/units` cards, where an
  anchor inside an anchor would have been invalid HTML.
- Tap targets: copy buttons and the details toggle were 16–24px tall in result
  rows; theme and menu buttons were 36px.
- Estimate and region badges were below WCAG AA contrast on their own tint.

### Found by adversarial review of the whole repository

Two independent reviews attacked the new work **and** everything that came
before it. What they found, all fixed and test-pinned:

- **A wrong number.** Hard coal shipped `2.37528994` kg CO₂e/kg where its own
  note, its component sum and the research ledger all record `2.39528994` — a
  digit transposition under-reporting it by 0.84%. Factor values are now
  cross-checked against the breakdowns stated in their own notes.
- **Biogenic combustion CO₂ was filed as "Scope 3 upstream (indirect, before
  you buy it)"** — the opposite of what it is. It now has its own scope.
- **Invented range bounds.** The volumetric natural-gas ranges were attributed
  to DESNZ, which publishes no such range. Removed.
- **"petroleum" resolved to kerosene**, so `1 barrel petroleum` answered with
  jet fuel.
- **The engine claimed missing data it had just used.** `1 L diesel to t` said
  "the catalog has no density for diesel" directly above a mass computed from
  that density. `5 kW to MJ` dropped the request entirely.
- **Exactness stopped propagating** into per-energy emission factors: lignite's
  CO₂ printed four significant figures derived from a 5.5–21.6 MJ/kg spread.
- **A dimensionally meaningless calculation path**: `1 kg diesel × 9.905 kWh/L`.
- **The disambiguation chips were a trap** — clicking one deleted the material
  you had typed and left the ambiguity, forever.
- **Every BreadcrumbList on the site** emitted
  `https://universal-converter.org../units` (108 of 108 pages).
- **Tab and Shift+Tab** both rewrote the input instead of moving focus.
- **Screen readers** got ~165 words re-read on every keystroke.
- **A lookbehind regex** would have failed to parse on Safari < 16.4, taking
  the whole site down there rather than one input.
- **Contrast**, all computed: the home page's key instruction at 4.28:1, input
  borders at 1.28:1 against WCAG 1.4.11's 3:1, placeholders at 2.36:1 in
  Safari, "Critical:" warnings at 4.43:1.
- **`package.json`** — every script and all 22 devDependencies — shipped in the
  client bundle to render a version string.
- Range bounds rounded inward (understating spread), 40-digit bounds in the API
  and CSV, density units filed under Energy, and a shared `?q=` link showing an
  empty-state panel before swapping in the results.

### Not done, and why

- The spec's original 0.3 list (heating-cost and price calculators, boiler
  efficiency, heat-pump COP, well-to-wheel factors, country presets) all need
  sourced numbers this repository does not have. Shipping them would mean
  inventing figures — the one thing this project refuses to do. They stay on
  the roadmap with their blockers named.
- No public error-reporting channel is published: the repository is private and
  no contact address has been cleared for publication. The footer instead
  points at the per-figure sources, which is what a reader can act on today.

## 0.2.0 — 2026-07-20

### Added

- **Grid electricity region/year** (roadmap 0.2 item 1): picking a region +
  year with a cited factor turns `kWh electricity` emissions from
  `context_required` into a real `region_year_specific` GHG **mass** for the
  entered amount, labeled with the factor's own metric (CO2 vs CO2e stay
  separate). Data-driven picker (options bar + inline on the emissions row),
  shareable via `?region=&year=`. Factors: UK 2025 (CO2e, DESNZ), EU-27 2023 +
  EU-27 2022 (CO2, EEA — the 2022 value was recorded in research-notes and is
  now shipped, making the year-dependence of grid intensity visible).
- **`/api/convert` public API draft** (roadmap 0.2): GET-only, CORS-open JSON
  endpoint over the same engine/data/guards; parse failures are structured
  400s; unmatched region/year stays a 200 `context_required` result. See
  `docs/api.md`. The one non-prerendered route (Cloudflare Pages Function).
- **Result export**: copy JSON, download JSON/CSV (rows keep exactness +
  source refs), and an "API ↗" link carrying the current query/basis/grid.
- **Time result group**: bare time inputs (`2 h`) now get real time
  conversions instead of landing under "Energy".
- **SEO**: prerendered `/sitemap.xml` (116 URLs) + robots reference, default
  OG/Twitter card image, `BreadcrumbList` JSON-LD breadcrumbs on detail
  pages, short unit slugs (`/units/kwh` → 308 → `/units/kilowatt_hour`).
- **CI**: GitHub Actions workflow running lint / check / test / build; Node
  pinned via `.nvmrc` + `engines`.

### Changed

- **Honest ranges**: energy results whose heating value carries a recorded
  spread now show the range **converted into each row's own unit** (the kWh
  row shows a kWh range) through the exactness-bounded formatter; wide spreads
  (>25% high/low: lignite, anthracite) are labeled `estimated` (`~`, 3 sig
  figs) instead of `source_based`. Copy-citation includes the range.
- Global-scope IPCC factors (region `"global"`) are labeled `source_based`,
  no longer `region_year_specific`.
- Emission results surface the factor's `uncertainty` note as a warning and
  its source table/cell in the explanation (previously captured but dropped).
- Factor-based UI labels use readable units (`gCO2e/kWh`, not
  `g_co2e_per_kwh`); illustrative electricity examples carry a CO2/CO2e chip.
- The footer carries the OGL v3.0 attribution required by `docs/sources.md`
  and reads its version from `package.json`.
- Parser: leading-dot decimals (`.5 kWh`), dangling-separator tolerance
  (`5. kWh`), input-length and 10^±30 magnitude guards (new
  `unsupported_value` error kind), lazy "did you mean" suggestions.
- Accessibility: combobox no longer pre-highlights an option and its clear
  button is keyboard-reachable; the LHV/HHV toggle implements the radiogroup
  keyboard pattern; the mobile menu overlays instead of reflowing; Escape
  closes popovers/menu; `--text-faint` contrast now meets WCAG AA; critical
  warnings are visually distinct; "context required" vs "not available" group
  headers are no longer conflated.

### Fixed

- The engine's region/year electricity path returned the raw intensity rate
  with a hardcoded CO2e unit id — it now multiplies the input energy through
  the factor and derives the unit from the factor's pollutant.
- `maxSigFigs` reached only energy/power rows (mass/volume silently ignored
  it) and could crash decimal.js at 0 — now threaded everywhere and clamped.
- A supplied-but-unusable `time` option made the power→energy group vanish
  instead of falling back to the context prompt.
- Fuel picks from the "pick a material" prompt now materialise into the query
  text, so shared URLs keep them.
- Deep links no longer trigger a duplicate conversion plus an unsolicited
  `replaceState` navigation on load.
- Theme: browser chrome (`theme-color`) follows the active theme, the toggle
  icon no longer flashes for dark-mode users, and the pre-paint fallback
  matches the store's semantics.

### Data

- `electricity-eu27-2022-co2` (292 gCO2/kWh, EEA) added; catalog is now
  34 emission factors (13 CO2 · 16 CO2e · 5 biogenic CO2).
- Data validation additionally enforces strictly positive physical values and
  well-formed ranges (`0 < low < high`).

## 0.1.0 — 2026-07-05

Initial release: framework-independent conversion engine (exact units, fuel
pipeline with LHV/HHV bases, CO2/CO2e-separated emissions, guards), 73-unit /
21-fuel / 33-factor sourced catalog (DESNZ 2025 primary, IPCC 2006 fallback,
NIST for exact constants), SvelteKit UI with result groups + exactness
badges, 14 Learn pages, methodology/sources pages, 325 tests, Cloudflare
Pages deployment. See `docs/review-v0.1.md` for the acceptance review.
