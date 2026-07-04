# ADR 0003: Conversion engine

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

The product's central technical risk is not "can we convert units" but "can
we keep exact and approximate results, and structurally distinct concepts
like CO2 vs. CO2e or LHV vs. HHV, from ever being silently conflated" (spec
§3, §9, §18–19; `AGENTS.md` non-negotiable principles). This requires the
engine's type system and pipeline structure to make the wrong thing hard to
write, not just documented as a rule the UI layer has to remember to follow.
`docs/conversion-rules.md` is the normative domain rulebook this ADR
implements in code; this ADR records the engineering shape of that
implementation, not the domain reasoning itself.

## Decision

- **Framework-independent TypeScript.** `src/lib/conversion`, `src/lib/units`,
  `src/lib/fuels`, `src/lib/emissions`, and `src/lib/data` contain no
  Svelte/SvelteKit imports. The engine is usable standalone (tests import it
  directly; a future CLI or npm package could too) and the UI is a pure
  consumer of its public API (`createConverter`, `getConverter`, the
  `Converter` interface: `parse` / `convert` / `convertText`).
- **The engine owns the types and Zod schemas — single owner, no drift.**
  `src/lib/conversion/types.ts` is the single source of truth for every
  domain type (`Dimension`, `Exactness`, `Unit`, `Fuel`, `EmissionFactor`,
  `ConversionResult`, etc.), re-exported through `src/lib/index.ts`. The data
  loader's Zod schemas (`src/lib/data/schemas.ts`) validate against this same
  shape. There is exactly one place that defines what a `Fuel` or an
  `EmissionFactor` looks like — the UI, tests, and data files all conform to
  it, rather than each layer keeping its own parallel notion of the shape.
- **decimal.js on decimal strings, not native floats, end-to-end.**
  `to_base_factor`, heating values, densities, and emission-factor values are
  all stored and passed as decimal strings; all arithmetic runs through
  `decimal.js` (`Decimal.set({ precision: 40 })` in `engine.ts`). Rounding to
  a display form happens only at the very end, in the formatting layer
  (`formatValue`, `roundToSigFigs`), never mid-calculation.
- **The 8-level exactness taxonomy, including the added `context_required`
  level**, is a first-class type (`Exactness`) with an explicit ordering
  (`EXACTNESS_ORDER`) used by `combineExactness` to compute the *floor* of a
  calculation chain — a result is only as exact as its weakest input,
  computed mechanically rather than asserted per call site.
- **Guards are structural, not just documented conventions:**
  - Power→energy requires an explicit `time: Quantity` in `EngineOptions`;
    there is no code path that produces an energy result from a bare power
    input without one — the absence of a time input is what produces the
    `context_required: ["time"]` result.
  - CO2 and CO2e are separate pseudo-dimensions
    (`emission_mass_co2` / `emission_mass_co2e`) with no shared conversion
    function between them; asking for one from the other is handled as
    `unsupported` by the pipeline, not filtered out after the fact.
  - Missing fuel/region/year/density context produces `context_required`
    with a machine-readable `missing: MissingContext[]` field, so the UI
    knows exactly which input control to render rather than parsing a
    free-text explanation.
  - Hydrogen combustion CO2 = 0 is emitted with a dedicated
    `hydrogenCombustionWarning` (`conversion/warnings.ts`) attached, so the
    "combustion only, not lifecycle" caveat travels with the number
    structurally, not as an easily-dropped UI afterthought.
  - Biogenic CO2 is a distinct, always-attached line
    (`biogenicCo2Warning`) rather than a value that can be silently zeroed
    or omitted.
- **LHV/NCV is the default heating-value basis, HHV/GCV shown alongside
  where the data provides it** (`HeatingBasis = 'lhv' | 'hhv'`,
  `EngineOptions.basis` defaulting to `'lhv'` in the pipeline) — matching the
  dominant international convention (`docs/conversion-rules.md` §C.1) while
  never hiding the alternative basis when it exists in data.
- **Data is injected as a validated bundle, not read ad hoc.**
  `createConverter(dataBundle: DataBundle)` takes a fully Zod-validated
  `{ units, fuels, emissionFactors, sources }` object; the engine never reads
  a JSON file itself. This keeps the engine testable with small, synthetic
  data bundles (see `tests/fixtures/fuel-bundle.ts`) independent of the size
  or state of the real `data/*.json` catalog.

## Consequences

- Adding a new guard or exactness rule generally means changing one function
  in `engine.ts`/`precision.ts`/`warnings.ts` plus a type addition in
  `types.ts`, rather than hunting for every UI call site that needs to
  remember the rule — the type system and the single-owner schema make
  regressions structurally harder, not just discouraged by convention.
- The engine's test suite (79 tests as of this writing, across exact
  conversions, parser, fuel pipeline, emissions, formatting, guards, and
  data validation) can run entirely without SvelteKit, a browser, or the
  real data catalog being complete — which is exactly why the engine's
  tests were able to reach green before the fuel/emission-factor data
  catalog (`data/fuels.json`, `data/emission-factors.json`) was fully
  populated: the pipeline logic and a small fixture bundle are sufficient.
- decimal.js everywhere has a real (small) performance cost compared to
  native floats; this is an accepted trade for a project whose entire
  premise is precision-and-honesty over speed, and the data volumes involved
  (a few hundred units/fuels/factors, not large numeric datasets) make the
  cost negligible in practice.
- Because the engine is the single owner of types, any future non-TypeScript
  consumer (e.g. a Rust/WASM port, per roadmap long-term ideas) would need to
  either re-derive an equivalent type/schema pair or treat `types.ts` +
  `schemas.ts` as the spec to port — an explicit, visible task rather than a
  hidden one, since there's only one place those definitions live today.

## Alternatives considered

- **Per-UI-component validation of exactness/guards** (i.e., let Svelte
  components check "did we get a time input" etc.). Rejected: this is
  exactly the kind of rule that silently rots when a new call site forgets
  it; putting the guard in the engine's pipeline makes it apply everywhere
  the engine is called, including future non-UI consumers (CLI, API route).
- **Native JS numbers with careful rounding.** Rejected: the calculation
  chains here (density → heating value → emission factor, potentially
  three or four multiplications deep) are exactly where float error
  compounds; decimal.js removes an entire class of "why is this off by
  0.0000001" bugs for a modest, acceptable performance cost at this data
  scale.
- **Separate type definitions per layer (engine types vs. UI view-models vs.
  Zod schemas maintained independently).** Rejected: three parallel
  definitions of "what is a Fuel" is exactly how the CO2/CO2e or LHV/HHV
  conflation bugs this project is designed to prevent actually happen in
  practice — single ownership in `types.ts` was chosen specifically to
  close that gap.
- **Folding `context_required` into `unsupported`** (the spec's literal
  §7.6 enum only lists `unsupported`). Rejected per
  `docs/conversion-rules.md` §A.2: the two states have fundamentally
  different semantics ("no good answer" vs. "answerable once you tell me one
  more thing") and different UI affordances (dead end vs. an input control),
  and spec §10/§13.4 already require the distinct behavior in practice — this
  is the one documented deliberate deviation from the spec's literal enum,
  made under the spec's own "justified deviation" clause.
