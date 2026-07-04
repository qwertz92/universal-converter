# ADR 0001: Tech stack

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

The project needs a stack that supports many statically-generated,
SEO-relevant documentation-style pages (unit/fuel detail pages, Learn pages,
Sources/Methodology) alongside an interactive converter UI, while keeping a
correctness-critical conversion engine cleanly separated from the UI
framework (`AGENTS.md` non-negotiable: the engine stays framework-independent
TypeScript). The spec (`docs/spec-v0.1.md` §4) names a preferred stack;
this ADR records the concrete choices made from it and the deviations
required by the actual development environment.

## Decision

- **SvelteKit 2 + TypeScript (strict) + Tailwind CSS 4** for the application
  and UI layer. SvelteKit's file-based routing and first-class support for
  prerendering fit the "many static content pages + one interactive core"
  shape well; TypeScript strict mode catches data-shape and engine-boundary
  errors at compile time, which matters for a project whose core promise is
  "no invented numbers, no silent type confusion between CO2 and CO2e."
- **npm, not Bun**, as the package manager/runner. Bun is the spec's stated
  preference *if compatible* (spec §4.2), but the reference development
  machine does not have Bun installed, and Cloudflare Pages' build
  environment compatibility with Bun is not a solved, well-trodden path the
  way npm is with `@sveltejs/adapter-cloudflare`. npm is the lower-risk
  choice for a project whose deployment target is fixed (Cloudflare).
- **No separate Rust/Deno/Node backend in v0.1.** The conversion engine is
  plain, framework-independent TypeScript (`src/lib/conversion`, `units`,
  `fuels`, `emissions`, `data`). Cloudflare Workers run on a Web-standard-API
  runtime, not a Bun/Node server, so any server-side code must target Web
  APIs regardless — introducing a separate backend language would add a
  second runtime boundary for no benefit at this stage (spec §4.2: "Rust can
  be sensible later — WASM engine, CLI, data-validation tooling — it's
  over-engineering for v0.1").
- **Vitest** for unit/integration tests (fast, native ESM/TS support, and the
  same toolchain family as Vite/SvelteKit).
- **Zod** for data validation — every `data/*.json` file is parsed through a
  Zod schema (`src/lib/data/schemas.ts`) before the engine sees it, so a
  malformed data edit fails loudly at load time rather than producing a
  wrong number silently downstream.
- **decimal.js** for arithmetic. Conversion factors and computed values are
  carried as decimal strings and multiplied via `decimal.js`, never native
  JS floats, to avoid float-accumulation error compounding across a
  multi-step calculation chain (density → heating value → emission factor).
- **mdsvex** for Markdown-authored content pages (Learn pages, and
  potentially Methodology/Sources prose), so long-form domain writing can
  live as Markdown rather than hand-built Svelte markup, while still
  rendering through SvelteKit's routing.

## Consequences

- Any contributor needs Node ≥ 20 and npm; there is no Bun-specific tooling
  or lockfile to maintain, simplifying onboarding and CI.
- The engine/UI boundary is enforced by convention (no Svelte/SvelteKit
  imports outside `src/lib/components` and `src/routes`) rather than by a
  separate package/repo — cheaper to maintain at this scale, but relies on
  code review / linting discipline to not erode over time. If the engine is
  ever published as a standalone npm package (roadmap 1.0), extracting it
  from `src/lib` should require no logic changes, only a package boundary.
- Because there is no Rust/WASM engine, very large or performance-sensitive
  computations (none currently exist) would need a follow-up ADR if that
  changes; today's engine is dominated by string/decimal arithmetic over a
  small, in-memory data catalog, well within plain TypeScript's comfortable
  range.
- Revisiting the Bun decision is low-cost later (Bun can read a
  `package.json`/npm lockfile-compatible project reasonably well) if it
  becomes available on the development machine and Cloudflare's build
  environment is confirmed compatible.

## Alternatives considered

- **Next.js / React** — rejected: heavier runtime for a content-and-forms-
  heavy site, and SvelteKit's prerendering story is at least as strong for
  this use case while producing less client-side JS per page.
- **Astro** — a plausible alternative for the content-heavy pages, but
  weaker fit for the single, fairly stateful interactive converter UI
  (result groups, expandable assumptions/sources panels) that is the
  product's core; SvelteKit handles both content and interactivity in one
  framework without an extra "islands" integration layer.
- **Bun as the runtime/tooling** — rejected for now purely on environment
  grounds (not installed; unverified Cloudflare Pages build compatibility),
  not on technical merit; see Decision above.
- **A separate Rust/WASM conversion engine** — rejected for v0.1 as
  over-engineering per the spec's own guidance; TypeScript + decimal.js +
  Zod is sufficient for the correctness bar this project needs and keeps the
  whole stack in one language for a small team/agent set.
- **JavaScript (no TypeScript)** — rejected: the domain has enough distinct,
  easily-confused concepts (CO2 vs CO2e, LHV vs HHV, exact vs estimated) that
  a structural type system materially reduces a whole class of bugs the spec
  explicitly worries about.
