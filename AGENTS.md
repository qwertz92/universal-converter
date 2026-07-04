# Universal Converter — Agent Instructions

Source-based unit, energy, fuel and emissions converter (target domain:
universal-converter.org). The authoritative product spec is
`docs/spec-v0.1.md` — read the relevant sections before larger tasks.

## Non-negotiable principles

- The conversion engine (`src/lib/conversion`, `src/lib/units`,
  `src/lib/fuels`, `src/lib/emissions`, `src/lib/data`) stays
  framework-independent TypeScript: no Svelte/SvelteKit imports outside
  `src/lib/components` and `src/routes`.
- Exact and non-exact conversions are always kept distinct (`exactness`
  field on every result). Never present an estimate as exact.
- No invented numbers: every non-exact factor carries `source_refs`
  resolving into `data/sources.json`. Missing data is marked
  "not available" instead of guessed. No silent averaging of diverging
  sources.
- CO2 ≠ CO2e; LHV/NCV ≠ HHV/GCV — the basis must always be labeled on
  data entries and results.
- No automatic power→energy conversion without an explicit time input.

## Stack & commands

- SvelteKit 2 + TypeScript (strict) + Tailwind CSS; Vitest for tests;
  Zod for data validation; decimal.js for precise arithmetic.
- Deployment target: Cloudflare Pages/Workers via `@sveltejs/adapter-cloudflare`.
  Server code must stick to Web-standard APIs (no Node-only APIs).
- Package manager: npm (Bun is not installed on this machine).
- `npm run dev` / `npm run build` / `npm test` / `npm run check` / `npm run lint`

## Conventions

- Conventional Commits (`feat|fix|docs|test|refactor|chore(scope): summary`),
  imperative mood, ≤50 char subject. No AI-attribution footers
  (no `Co-Authored-By: Claude` or "Generated with …").
- Larger architecture decisions get an ADR in `docs/adr/`.
- Tests live in `tests/`, mirroring engine modules; versioned data files
  live in `data/` and are validated with Zod schemas.
- Documentation in `docs/`; Mermaid for diagrams.
