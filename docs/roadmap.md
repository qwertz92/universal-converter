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
  `data/emission-factors.json` with **34 emission factors** (13 CO2, 16 CO2e,
  5 biogenic CO2); `data/sources.json` with **10 sources**; `data/examples.json`
  with **20 quick examples**.
- **325 passing Vitest tests** (16 files) across exact conversions, the
  parser, the fuel pipeline, emissions, formatting, guards, golden
  end-to-end cases against the real catalog, and data validation —
  comfortably past the spec's 30-test minimum (§13). (v0.2.0 grew this to
  **382 tests / 21 files**.)
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

**Shipped in v0.2.0 (2026-07-20, see `CHANGELOG.md`):**

- **Region/year electricity factors** — engine + data-driven picker; cited
  factors only (UK 2025 CO2e, EU-27 2023/2022 CO2), metric always labeled,
  results are the input energy × factor as `region_year_specific` mass.
- **Public API draft** — `GET /api/convert` (`docs/api.md`), the one
  non-prerendered route.
- **Better uncertainty display** — recorded heating-value spreads render as
  per-unit converted ranges through the exactness-bounded formatter; >25%
  spreads are labeled `estimated`; factor uncertainty notes surface as
  warnings.
- **Export half of import/export** — copy/download JSON, download CSV
  (provenance kept per row), API deep link. *Import* (parsing a saved
  set back in) is deliberately not designed yet.

**Still open from the 0.2 list, with reasons:**

- *Better natural-gas models* — needs new sourced data (Zustandszahl /
  reference-condition tables), not just engine work.
- *Advanced search* — unit/fuel search exists; "advanced" (cross-entity,
  fuzzy, synonyms beyond aliases) unscoped.
- *More fuels* — DESNZ variant rows (100% mineral petrol/diesel, gas oil,
  burning oil, wood chips, biomethane, …) are recorded verbatim in
  `docs/research-notes.md`, but shipping them as near-duplicate fuel ids
  without a variant/compare model risks catalog confusion — blocked on the
  data-model ADR below.
- *US grid factor* — the ~370 gCO2/kWh figure in research-notes is flagged
  provisional/unverified; shipping it would break the no-invented-numbers
  rule. Needs a bounded re-extraction of EPA Hub Table 6 (XLSX).
- *Source Diff Viewer* — the catalog currently ships exactly one factor per
  fuel+metric+scope, so there is nothing to diff yet; follows the variant
  ADR.
- **New prerequisite ADR:** fuel variants / multi-source values (density as
  array vs. separate fuel ids, GWP-set field on factors) — see the data
  audit's schema findings.

### 0.3 — Heating-cost calculator, electricity/gas price calculator, boiler efficiency, heat pump COP, well-to-wheel factors, country presets, saved scenarios

**What v0.3.0 actually shipped (2026-07-20, see `CHANGELOG.md`):** a usability
milestone, not the calculator list. The converter became usable without reading
the documentation first — an explicit conversion target (`5 kWh to MJ`) and
duration (`5 kW for 3 h`) in the query grammar, unit autocomplete, a live
statement of what the engine understood, honest out-of-scope messaging, a
mobile pass that removed up to 451px of horizontal overflow, and browser-local
recent conversions (the "saved scenarios" half that needs no new data).

**Update (v0.3.2): the price calculators shipped after all.** The blocker below
was stated too broadly. "We cannot publish a tariff" is not the same as "we
cannot compute with one" — and the second never followed from the first. A rate
the reader types is their own number, so multiplying by it invents nothing.

`1000 kWh at 0.32 EUR/kWh` and `100 m³ natural gas at 0.09 EUR/kWh` now answer,
under three constraints that keep the rulebook intact: the catalog still carries
no tariffs, the currency is a label that is never converted (this tool has no
exchange rates and refuses currency conversion outright), and the cost is never
labeled more exact than the quantity it rests on. The same reasoning applies to
boiler efficiency and heat-pump COP — an efficiency the reader supplies is not
an invented default — so those are unblocked too and simply not built yet.

**Why the listed calculators did not ship in 0.3.0.** Every one of them needs
numbers this repository does not have a source for:

- *Heating-cost / electricity / gas price calculators* — tariffs are
  per-contract and change constantly; there is no citable dataset that would
  make a shipped number true for any given reader. **Resolved in 0.3.2 by
  taking the rate from the user instead of shipping one.**
- *Boiler efficiency, heat-pump COP* — these are equipment properties with wide
  real spread. Without a cited efficiency table, any DEFAULT would be invented —
  but a figure the reader supplies from their own appliance's data plate is not.
  Unblocked on the same reasoning as prices; not yet built.
- *Well-to-wheel factors* — requires an upstream/lifecycle dataset (e.g. JEC or
  a national equivalent) that has not been researched or licence-checked.
  **Still blocked**, and not by the same argument as prices: a lifecycle factor
  is a published scientific figure, not a reader's own setting, so there is
  nobody to take it from but a source we do not yet have.
- *Country presets* — the same blocker as the US grid factor: a preset per
  country means a cited factor per country/year, and we ship only the ones we
  have (UK 2025, EU-27 2023/2022). **Still blocked**, for the same reason.

**Where 0.3 stands after 0.3.2.** Everything on the list has shipped except
well-to-wheel factors and country presets, and both are blocked on data that has
to be researched and licence-checked rather than on any decision left to make.
The next real work is therefore a research pass, not a code pass.

Reordering the calculators behind a usability release was a deliberate call:
the tool was hard to use *before* it was short of calculators, and the
"no invented numbers" rule makes the calculator work data-first rather than
code-first. The items stay here, with the blocker named, until a source exists.

### 0.4 — Historical industrial units, pressure/flow/temperature, steam/energy engineering calculators, user-defined materials/fuels, offline PWA, embeddable widget

Per spec §15, unchanged.

### 1.0 — Full provenance UI, versioned datasets, public API, exportable calculation reports, multi-language UI (DE/EN), SEO knowledge pages, admin/data-update pipeline, optional CLI, optional npm package

Per spec §15, unchanged.

---

## Candidate additions for right after 0.1

> **Status update (v0.2.0):** items 1, 3 and 4 below shipped in 0.2.0
> (region/year presets, `/api/convert`, uncertainty display). Item 2 (Source
> Diff Viewer) remains open — see the 0.2 section above for why it is blocked
> on the fuel-variants ADR. The list is kept for the original reasoning.

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
