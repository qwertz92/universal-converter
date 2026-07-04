# ADR 0002: Data provenance

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

The product's entire value proposition is transparency: every non-exact
number must be traceable to a source, with its basis, scope, region, and
year labeled (spec §2, §3.3, §12; `AGENTS.md` non-negotiable principles). The
Research agent surveyed the plausible candidate sources
(`docs/research-notes.md` §1–§2) and found that they diverge significantly in
license terms, coverage, and internal consistency (LHV/HHV basis, CO2 vs
CO2e, scope). A single, explicit provenance policy is needed so the Data
agent (and anyone extending the catalog later) makes the same choice the
same way every time, rather than ad hoc per fuel.

## Decision

- **UK DESNZ 2025 GHG Conversion Factors is the primary source** for fuel
  density, heating values (both NCV and GCV), and emission factors
  (CO2/CH4/N2O/CO2e split). It is licensed under the **Open Government
  Licence v3.0**, which explicitly permits commercial and non-commercial
  copying, publishing, distribution, and adaptation with attribution — the
  only source in our candidate set that combines a genuinely reusable
  license with density + both calorific-value bases + a full gas-species
  split + derived CO2e in one authoritative, actively-maintained dataset.
- **IPCC 2006 Guidelines Vol. 2 is the fallback** for fuels or fuel
  categories DESNZ does not cover cleanly (generic crude oil, rank-based
  coal — anthracite/lignite — where DESNZ's categories are functional/UK-
  billing-oriented rather than rank-based, and biofuels' raw combustion CO2
  before biogenic-accounting is applied). Used via specific cited excerpts
  (individual table rows with citation), never as a bulk-republished
  dataset, per IPCC's copyright terms.
- **EPA GHG Emission Factors Hub and EIA are cross-checks**, not primary or
  fallback sources: they provide an explicit US-specific alternative figure
  where useful, and a plausibility check on DESNZ/IPCC's order of magnitude,
  but are never blended with the UK/global figures.
- **NIST SP 811 is the source for exact unit-definition constants** (IT
  calorie, IT BTU, pound, gallons, cubic foot) — these are definitional, not
  measured, and NIST is the canonical US SI-usage reference.
- **Every non-exact data value carries `source_refs`** resolving into
  `data/sources.json`, enforced by Zod schema + cross-file validation
  (`src/lib/data/validate-data.ts`) — a value with no resolvable source
  reference fails validation rather than shipping silently.
- **Verbatim storage, no derivation-by-generic-factor.** Values are stored
  as given by their source (original unit/basis recorded in `notes` where
  relevant). We do not compute HHV from LHV, CO2e from CO2, or a
  physical-barrel energy from `boe` via a generic multiplier — each is
  either directly sourced or shown as "not available."
- **No averaging across diverging sources.** Where DESNZ, IPCC, EPA, and EIA
  disagree (which is expected — different regions/years/methodologies, not
  error), each source's value is recorded and shown with its own provenance,
  or as an explicit range — never silently blended into one number.
- **"NOT AVAILABLE" over guessing.** A fuel property with no serious primary
  source (e.g. a generic, non-DESNZ crude-oil density) is left out of the
  data file entirely; the UI renders its absence as "not available."
- **IEA's detailed statistical datasets (World Energy Balances / World
  Energy Statistics) are excluded.** Only IEA's free Unit Converter tool
  (CC BY 4.0) and public methodology PDFs are used, for unit-convention
  definitions (`toe`, `tce`) only — never for country-level fuel or emission
  data, which sits behind a paid, redistribution-restricted license.

## Consequences

- The fuel/emission catalog will show **multiple entries per fuel property**
  where sources diverge (e.g. diesel CO2e per litre from DESNZ's "average
  biofuel blend" vs. "100% mineral" variants, or IPCC's wider global range
  vs. DESNZ's UK-specific figure) rather than one clean number — this is a
  deliberate transparency feature, not an unresolved data-modeling gap, but
  it does mean the UI and data schema must carry region/scope/variant labels
  on essentially every fuel-derived result, which is a real complexity cost
  the team accepts as the price of honesty.
- Coverage gaps are expected and documented rather than papered over: DESNZ
  has no hydrogen row (as of the 2025 edition sheets inspected) and no
  generic "crude oil" row; these are explicitly flagged in
  `docs/research-notes.md` §4.12 rather than filled with an invented number.
- Because DESNZ is the backbone of the catalog, this project carries a
  **UK-centric default framing** for v0.1 (UK grid electricity as the first
  illustrative example, UK fuel-blend conventions as defaults) — deliberate
  given DESNZ's license and data quality, but a bias to be aware of and to
  balance with EU/US alternatives as the catalog matures (roadmap 0.2/0.3
  country presets).
- Every future addition to the data catalog must go through the same
  primary→fallback→cross-check hierarchy and the same "cite or omit, never
  invent" discipline — this ADR is the standing policy new fuels/factors are
  checked against, not a one-time decision.

## Alternatives considered

- **IEA as the primary source.** Rejected: IEA's actual statistical data is
  paywalled/redistribution-restricted; only the free unit-converter tool and
  glossary are usable, which is far too thin to serve as a fuel/emissions
  catalog backbone.
- **EIA as the primary source.** Rejected: US-only, no combined
  density+HHV+LHV+CO2e-in-one-place structure, and no explicit international
  generalization — would force a US-only v0.1 framing, a narrower default
  audience than DESNZ's more complete, internationally-licensed dataset
  gives us.
- **Averaging DESNZ/IPCC/EPA/EIA into one number per fuel property.**
  Rejected outright: this is precisely the "confidently wrong" failure mode
  the product exists to avoid (spec §12, §18–19; rulebook §D.16) — it would
  hide genuine regional/methodological disagreement behind a fake single
  truth.
- **Treating Engineering ToolBox as a primary source** (it is comprehensive
  and convenient). Rejected: unsourced/unlicensed commercial content: usable
  only for plausibility cross-checks, per the spec's own instruction
  (§6.1/§12), never for a citable data value.
