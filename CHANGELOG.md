# Changelog

All notable changes to Universal Converter. Versioning follows semver
(pre-1.0: minor bumps may include behavior changes; they are listed here).

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
