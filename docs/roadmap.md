# Roadmap — Universal Converter

> Source of truth for scope: `docs/spec-v0.1.md` §15 (phases) and §16
> (long-term feature ideas). This document copies the phase breakdown
> faithfully, marks what v0.1 has actually shipped in this repository so far,
> and adds a short set of justified "candidate additions" for what should
> come immediately after 0.1. It does not re-litigate the domain rules —
> see `docs/conversion-rules.md` for those.

---

## Phase status

### 0.1 — SvelteKit app, conversion core, energy units, basic fuel catalog, basic emissions, sources/provenance, learn pages, tests, Cloudflare deployment readiness

**Shipped in this repository, as of this writing:**

- SvelteKit 2 + TypeScript (strict) + Tailwind 4 scaffold, `adapter-cloudflare`
  configured, `wrangler.jsonc` present, `worker-configuration.d.ts` checked in
  and regenerable via `npm run gen`.
- Framework-independent conversion engine (`src/lib/conversion`, `units`,
  `fuels`, `emissions`, `data`): exact unit conversions, the 8-level
  exactness taxonomy (including the added `context_required` level), the
  fuel pipeline (density, LHV/HHV heating values), the emissions pipeline
  (CO2/CO2e separation, biogenic CO2 handling, hydrogen combustion=0
  labeling), and all guards (no silent kW→kWh, no CO2↔CO2e path,
  `context_required` for missing fuel/region/year/density).
- Zod-validated data files with strict envelopes: `data/units.json` populated
  with **73 units**; `data/fuels.json` with **21 fuels** (incl. electricity);
  `data/emission-factors.json` with **33 emission factors** (12 CO2, 16 CO2e,
  5 biogenic CO2); `data/sources.json` with **10 sources**; `data/examples.json`
  with **20 quick examples**.
- **325 passing Vitest tests** (16 files) across exact conversions, the
  parser, the fuel pipeline, emissions, formatting, guards, golden
  end-to-end cases against the real catalog, and data validation —
  comfortably past the spec's 30-test minimum (§13).
- Domain documentation: `docs/conversion-rules.md` and
  `docs/accuracy-and-limitations.md` (Domain agent).
- Research and source catalog: `docs/research-notes.md` (Research agent),
  identifying DESNZ 2025 as the primary fuel/emission data source (OGL v3),
  IPCC 2006 as the global fallback, EPA/EIA as US cross-checks, and NIST SP
  811 for exact unit-definition constants.
- The full SvelteKit UI: the main converter page, result-group cards,
  exactness badges, unit/fuel detail pages, the 14 Learn pages, and the
  Sources/Methodology pages (Frontend agent) — all implemented, not
  placeholders.
- Final acceptance-criteria review (`docs/review-v0.1.md`, Review agent) —
  24 PASS / 6 PARTIAL (documentation drift only) / 0 FAIL against the spec
  §17 acceptance criteria.

**Read `docs/review-v0.1.md` for the authoritative "is 0.1 actually done"
verdict** — this roadmap describes scope and intent, not a live
build-status dashboard.

### 0.2 — Better natural-gas models, region/year electricity factors, import/export, advanced search, more fuels, better uncertainty display, public API draft

Per spec §15, unchanged.

### 0.3 — Heating-cost calculator, electricity/gas price calculator, boiler efficiency, heat pump COP, well-to-wheel factors, country presets, saved scenarios

Per spec §15, unchanged.

### 0.4 — Historical industrial units, pressure/flow/temperature, steam/energy engineering calculators, user-defined materials/fuels, offline PWA, embeddable widget

Per spec §15, unchanged.

### 1.0 — Full provenance UI, versioned datasets, public API, exportable calculation reports, multi-language UI (DE/EN), SEO knowledge pages, admin/data-update pipeline, optional CLI, optional npm package

Per spec §15, unchanged.

---

## Candidate additions for right after 0.1

The spec's §16 "long-term feature ideas" list is large and mostly
un-prioritized. Of that list, the following are the ones most worth pulling
forward into early 0.2 work, in order, with justification:

1. **Country/year electricity grid-factor presets** (already slated for 0.2).
   This directly resolves the single most common `context_required` prompt
   (`kWh electricity → CO2e`) into a real, cited answer for the handful of
   regions users will ask about most (UK, EU aggregate, US). The research
   groundwork already exists (`docs/research-notes.md` §4.13: UK 2025, EU-27
   2023, US eGRID) — this is mostly a data-population and UI-picker task, not
   new engine architecture.
2. **Source Diff Viewer** (spec §16). Given how central "don't silently
   average diverging sources" is to this product's credibility (rulebook
   §D.16), a small UI that shows DESNZ vs. IPCC vs. EPA/EIA figures for the
   same fuel side-by-side turns a documented policy into a visible,
   trust-building feature at low engineering cost — the data already carries
   per-source values.
3. **`/api/convert` (public API draft)** (already slated for 0.2). The engine
   is already framework-independent and returns a serializable
   `ConversionResultSet`; exposing it as a SvelteKit server route is close to
   a thin wrapper, and it unlocks the CLI/embeddable-widget/npm-package ideas
   later in §16 without re-architecting.
4. **Confidence score / uncertainty display improvements** (spec §16,
   already slated for 0.2 as "improved uncertainty display"). The engine
   already carries `range` and `uncertainty` fields end-to-end
   (`ConversionResult.range`, `EmissionFactor.uncertainty`) — the gap is
   purely on the display side, making this cheap relative to its honesty
   payoff.

These are judgment calls about sequencing, not scope changes: everything
above already appears in spec §15/§16. Nothing here should be read as
authorization to skip 0.2's other listed items (better natural-gas models,
import/export, advanced search) — it is a "if choosing where to start
first" recommendation.

---

## Non-goals for now

- **No Rust/WASM engine.** The spec explicitly calls this over-engineering
  for v0.1 (spec §4.2); the TypeScript engine's correctness and test
  coverage matter far more than raw performance at this stage. Revisit only
  if profiling on real traffic shows the JS engine is an actual bottleneck.
- **No user accounts.** Nothing in v0.1–1.0 scope (spec §15) requires
  authentication, saved user data, or personalization; "Saved Scenarios"
  (0.3) can be designed session/local-storage-first without accounts.
- **No paid data sources.** IEA's detailed statistical datasets are
  explicitly excluded for licensing reasons (`docs/research-notes.md` §5);
  the project's credibility depends on every number being traceable to a
  source whose license we can actually rely on, so no paid or
  redistribution-restricted dataset should be added without a documented ADR.
