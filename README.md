# Universal Converter

A transparent, source-based converter for units, energy, fuels and emissions.

> Convert values, understand assumptions, and trace every non-exact result
> back to its source.

Universal Converter is not "type a number, get a number." Every result states
whether it is an **exact** unit identity, a **standard-defined** convention
(like `toe` or `boe`), a **source-based** measured value (a fuel's density or
calorific value), an **estimate** with genuine real-world spread, a
**region/year-specific** figure (grid electricity CO2e), or something that
needs **more context** before it can be answered at all (`context_required`,
e.g. `kW → kWh` with no time given). Nothing is ever presented as more precise
than its weakest input.

Target domain: `universal-converter.org`.

## What it does

- **Three-layer conversion model** (spec §3): an exact SI/definitional unit
  engine; a context-aware fuel/material engine (density, heating value,
  emission factors); and a sources/assumptions layer that explains every
  non-exact number.
- **Provenance on every non-exact result.** Fuel and emission data carries
  `source_refs` into a sources catalog — no invented numbers, no silent
  averaging of disagreeing sources.
- **An 8-level exactness taxonomy** (`exact`, `standard_definition`,
  `source_based`, `estimated`, `region_year_specific`, `user_assumption`,
  `context_required`, `unsupported`) attached to every conversion result, so
  exact and approximate answers are never visually or semantically conflated.
  See [`docs/conversion-rules.md`](docs/conversion-rules.md) §A.
- **Guards against classic unit-conversion mistakes:** no automatic
  power→energy conversion without an explicit time input; no conversion path
  between CO2 and CO2e; `context_required` (not a guess) when a fuel, region,
  year, or density is missing; hydrogen combustion CO2 is shown as exactly
  zero but explicitly labeled "combustion only" (upstream emissions are a
  separate, cited question); biogenic CO2 is reported on its own line, never
  silently zeroed into a fossil total. Full rationale in
  [`docs/conversion-rules.md`](docs/conversion-rules.md) and
  [`docs/accuracy-and-limitations.md`](docs/accuracy-and-limitations.md).

## Tech stack

- **SvelteKit 2** + **TypeScript** (strict) + **Tailwind CSS 4** for the UI.
- A **framework-independent TypeScript conversion engine**
  (`src/lib/conversion`, `src/lib/units`, `src/lib/fuels`,
  `src/lib/emissions`, `src/lib/data`) with no Svelte/SvelteKit imports —
  usable outside the web app.
- **Zod** for data validation, **decimal.js** for precise arithmetic (no
  float-chain rounding errors), **Vitest** for tests.
- **mdsvex** for Markdown-authored Learn/content pages.
- **npm** as the package manager (Bun is not installed on the reference dev
  machine; see [ADR 0001](docs/adr/0001-tech-stack.md)).
- Deployment target: **Cloudflare Pages** via `@sveltejs/adapter-cloudflare`
  (see [`docs/deployment-cloudflare.md`](docs/deployment-cloudflare.md) and
  [ADR 0004](docs/adr/0004-cloudflare-deployment.md)).

## Quickstart

Requires **Node ≥ 20** and npm.

```bash
npm install
npm run dev
```

This starts the Vite dev server (default `http://localhost:5173`).

## npm scripts

| Script                  | What it does                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Start the Vite dev server.                                                                                                                                             |
| `npm run build`         | Regenerate Cloudflare Worker types (`wrangler types --check`), then build the production bundle via Vite/SvelteKit.                                                    |
| `npm run preview`       | Serve the built output locally through `wrangler pages dev` (`.svelte-kit/cloudflare`, port 4173) — the closest local approximation of the Cloudflare runtime.         |
| `npm run check`         | Regenerate Worker types, sync SvelteKit's generated files, then type-check with `svelte-check`.                                                                        |
| `npm run check:watch`   | Same as `check`, in watch mode.                                                                                                                                        |
| `npm run lint`          | Verify formatting with Prettier (`--check`) and lint with ESLint.                                                                                                      |
| `npm run format`        | Auto-format the repo with Prettier.                                                                                                                                    |
| `npm test`              | Run the Vitest suite once (`--run`).                                                                                                                                   |
| `npm run test:watch`    | Run Vitest in watch mode.                                                                                                                                              |
| `npm run validate:data` | Run only the data-validation test file against `data/*.json`.                                                                                                          |
| `npm run gen`           | Regenerate `worker-configuration.d.ts` from `wrangler types` (Cloudflare bindings/types). Also checked in as `wrangler types --check` runs as part of `build`/`check`. |

`prepare` runs `svelte-kit sync` automatically after `npm install`.

## Project structure

```
universal-converter/
  src/
    lib/
      conversion/   engine.ts, parser.ts, types.ts, result-groups.ts,
                    formulas.ts, precision.ts, warnings.ts
      units/        registry.ts, dimensions.ts, exact-conversions.ts, aliases.ts
      fuels/        registry.ts, fuel-types.ts, density.ts, heating-values.ts
      emissions/    factors.ts, scopes.ts, co2-vs-co2e.ts
      data/         load-data.ts, validate-data.ts, schemas.ts
      formatting/   numbers.ts, units.ts
      index.ts      public $lib export surface
    routes/         SvelteKit pages (UI layer only — see docs/architecture.md)
  data/             units.json, fuels.json, emission-factors.json,
                    sources.json, examples.json (Zod-validated)
  tests/            mirrors the engine modules above
  docs/             this documentation set (see below)
```

The engine (`src/lib/conversion`, `units`, `fuels`, `emissions`, `data`) stays
framework-independent by convention — no Svelte/SvelteKit imports outside
`src/lib/components` and `src/routes` (`AGENTS.md`).

## Data & provenance

Every non-exact number in this project traces back to a cited, licensed
source — "no number without a source" (spec §12, `AGENTS.md`).

- **Primary fuel/emission source:** UK DESNZ (Department for Energy Security
  and Net Zero) _2025 Government GHG Conversion Factors for Company
  Reporting_, licensed under the **Open Government Licence v3.0**. It is the
  only source in our catalog that gives density, both NCV and GCV heating
  values, and a full CO2/CH4/N2O/CO2e split in one place under a genuinely
  reusable license.

  > Contains public sector information licensed under the Open Government
  > Licence v3.0.

- **Fallback / cross-checks:** IPCC 2006 Guidelines for National Greenhouse
  Gas Inventories Vol. 2 (global rank-based default factors, cited per value,
  not bulk-republished), US EPA GHG Emission Factors Hub and EIA (US-specific
  cross-checks, public domain), NIST SP 811 (exact SI/definitional
  constants).
- **Excluded:** IEA's detailed statistical datasets are paywalled/restricted;
  only IEA's free Unit Converter tool and public methodology PDFs are used.

Full source register, licenses, and attribution requirements:
[`docs/sources.md`](docs/sources.md). Domain modeling decisions and the
exactness taxonomy: [`docs/conversion-rules.md`](docs/conversion-rules.md).
Honest scope of what's exact vs. estimated vs. refused:
[`docs/accuracy-and-limitations.md`](docs/accuracy-and-limitations.md).

## Documentation map

| Document                                                               | Contents                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`docs/spec-v0.1.md`](docs/spec-v0.1.md)                               | Authoritative product & engineering specification.                                                     |
| [`docs/architecture.md`](docs/architecture.md)                         | System architecture, conversion pipeline, and user-flow diagrams; module map; data-file contract.      |
| [`docs/conversion-rules.md`](docs/conversion-rules.md)                 | Normative domain rulebook: exactness taxonomy, dimensional model, modeling decisions, pitfall catalog. |
| [`docs/accuracy-and-limitations.md`](docs/accuracy-and-limitations.md) | Honest statement of what's exact, estimated, and refused.                                              |
| [`docs/data-model.md`](docs/data-model.md)                             | Data file schemas and structure (owned by the Data agent).                                             |
| [`docs/sources.md`](docs/sources.md)                                   | Human-readable source register, licenses, and attribution.                                             |
| [`docs/research-notes.md`](docs/research-notes.md)                     | Raw research findings behind the source catalog.                                                       |
| [`docs/roadmap.md`](docs/roadmap.md)                                   | Phased roadmap, v0.1 scope, candidate next features.                                                   |
| [`docs/deployment-cloudflare.md`](docs/deployment-cloudflare.md)       | Cloudflare Pages deployment paths and operator checklist.                                              |
| [`docs/api.md`](docs/api.md)                                           | `/api/convert` public API draft: parameters, response shape, guarantees.                               |
| [`docs/adr/`](docs/adr/)                                               | Architecture decision records.                                                                         |
| [`docs/review-v0.1.md`](docs/review-v0.1.md)                           | v0.1 review findings (Review agent).                                                                   |
| [`CHANGELOG.md`](CHANGELOG.md)                                         | Versioned change history.                                                                              |

## Status

**v0.3.0, shipped** (see [`CHANGELOG.md`](CHANGELOG.md)) — the release that
made the converter usable without reading the docs first. You can now write
what you mean (`5 kWh to MJ`, `10 L diesel to kg`, `5 kW for 3 h`,
`how many kWh in 1 liter diesel?`); the input completes units as you type and
states what it understood on every keystroke; a requested target is answered as
a headline without hiding the other groups; and quantities the tool does not
model are named honestly instead of guessed at. Plus a mobile pass that removed
up to 451px of horizontal overflow, WCAG-AA badge contrast, and catalog notes
rewritten for readers rather than maintainers.

The foundation underneath is v0.1's conversion engine (units, fuels, emissions,
parser, guards) plus v0.2's grid electricity **region/year picker** (cited
factors only, CO2 vs CO2e labeled), the **`/api/convert` public API draft**
([`docs/api.md`](docs/api.md)), result **export** (JSON/CSV/API link), per-unit
**converted ranges** with an honest `estimated` label for wide-spread fuels, a
Time result group, SEO (sitemap, OG card, breadcrumb JSON-LD, `/units/kwh`-style
short slugs), CI, and an accessibility pass. The sourced catalog is 73 units,
21 fuels, 34 emission factors, 10 sources and 23 quick examples, covered by
**487 Vitest tests**.

Known gaps and honest limitations (e.g. crude-oil density, methane's own
combustion factor, hydrogen upstream emissions, no US grid factor until the
EPA table is re-extracted at full fidelity) are documented in
[`docs/accuracy-and-limitations.md`](docs/accuracy-and-limitations.md);
follow-on work is tracked in [`docs/roadmap.md`](docs/roadmap.md).

## License

**MIT** for the source code — see [`LICENSE`](LICENSE).

The reference data in `data/` is **not** covered by that licence: it carries the
terms of the bodies that published it (Open Government Licence v3.0 for UK
DESNZ, citation-only for IPCC, US public domain for EPA/EIA/NIST, …). Every
figure names its source, and the per-source terms are documented in
[`docs/sources.md`](docs/sources.md). If you reuse a number, follow its source's
licence.

## Found a wrong number?

That is the single most useful thing you can report. Open an issue with the
query you ran and what you expected — every figure on the site names the source
it came from, so a correction can be checked against the primary document.
