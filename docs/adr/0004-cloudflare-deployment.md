# ADR 0004: Cloudflare deployment

- **Status:** Accepted
- **Date:** 2026-07-04

## Context

The spec (`docs/spec-v0.1.md` §4.3) names Cloudflare Pages/Workers as the
primary deployment target, with a VPS deployment noted as "possible but
should not complicate the architecture now." The project's owner already
operates a multi-project VPS used for other personal projects (OpenClaw,
Voice Compiler, various coding-agent infrastructure). This ADR records why
Cloudflare Pages was chosen over adding this project to that existing VPS,
and the concrete deployment mechanism (`@sveltejs/adapter-cloudflare`,
static-first SSG) that follows from it.

## Decision

- **Deploy via Cloudflare Pages, using its Git integration, in preference to
  the existing VPS.** v0.1 is a static-first profile: every page is
  prerendered against the committed `data/*.json` files at build time, with
  no server-side secrets or database required (see
  `docs/deployment-cloudflare.md`). This is exactly the workload Cloudflare
  Pages is built for — zero-ops static hosting with automatic global CDN
  distribution, automatic production deploys on push to `main`, and
  automatic preview deploys per branch/PR with no additional CI
  configuration required.
- **`@sveltejs/adapter-cloudflare`** is the SvelteKit adapter used
  (`svelte.config.js`), targeting Cloudflare's Pages/Workers runtime.
  `wrangler.jsonc` pins `pages_build_output_dir` to
  `.svelte-kit/cloudflare` (the adapter's actual output directory — verified
  against the committed config, not assumed) and `compatibility_date` to
  `2026-07-04`.
- **SSG (prerendering) is the default rendering mode for v0.1.** Every route
  currently planned (landing, converter, unit/fuel detail pages, Learn
  pages, Sources/Methodology) can be fully prerendered from the static data
  catalog; there is no per-request dynamic data source yet.
- **Server/API routes remain possible later without an architecture
  change.** `adapter-cloudflare` supports SvelteKit server routes running on
  Cloudflare's Workers runtime (Web-standard APIs only, no Node-only APIs —
  already a project-wide constraint per `AGENTS.md`). The roadmap's
  `/api/convert` (0.2 candidate) can be added as a server route within the
  same adapter and deployment pipeline, with no migration required.

## Consequences

- **No VPS ops burden for this project.** Unlike the OpenClaw-VPS tenants
  (systemd services, manual TLS/tunnel configuration, disk/RAM budgeting on
  a shared 2 vCPU / 3.7 GB box), this project needs no server process to
  keep running, no reverse proxy, and no manual update/restart discipline —
  Cloudflare's build pipeline and edge network absorb all of that.
- **Preview deploys come for free per branch/PR**, which the VPS path would
  have needed custom tooling to replicate (a preview-per-branch setup on a
  shared VPS would mean either multiple ports/subdomains manually managed,
  or a bespoke CI script — Cloudflare Pages does this natively).
- **The trade-off is reduced infrastructure control**: no direct filesystem/
  process access to the running site, and Cloudflare-specific constraints
  (Workers runtime = Web-standard APIs only, no arbitrary Node server code)
  apply to any future dynamic route. This is an accepted constraint given
  v0.1's fully-static profile; it would need revisiting only if a future
  phase needs capabilities Cloudflare Workers genuinely can't provide (e.g.
  a stateful long-running process, which nothing in the current roadmap
  requires).
- **Custom domain (`universal-converter.org`) and `www` redirect** are
  configured entirely within the Cloudflare dashboard (see
  `docs/deployment-cloudflare.md`'s handover checklist) — no DNS or TLS
  management needed on the VPS side, and no interaction with the VPS's
  existing Cloudflare Tunnel setup (that tunnel serves different projects
  entirely and is unrelated to this Pages deployment).
- **No server-side secrets are needed today**, simplifying the initial setup
  (only a `NODE_VERSION` build-time environment variable, not a secret, is
  configured) — this will need revisiting (Cloudflare's Environment
  Variables and Secrets UI) the moment a future phase adds a server route
  that calls an external API or credentialed service.

## Alternatives considered

- **Deploy to the existing OpenClaw-VPS**, alongside OpenClaw and Voice
  Compiler. Rejected for v0.1: the VPS is a shared, resource-constrained box
  (2 vCPU, 3.7 GB RAM, ~12 GB free disk, no GPU) already running multiple
  long-lived services; adding a fully-static site there would mean manual
  reverse-proxy/Tunnel configuration and ongoing ops burden (updates,
  process supervision, TLS renewal coordination) for a workload that needs
  none of that. Cloudflare Pages is strictly less operational work for
  exactly the same (currently static) product requirements. This can be
  revisited if the product later needs VPS-only capabilities, but nothing in
  the current roadmap (through 1.0) clearly requires it.
- **Cloudflare Workers directly (without Pages), hand-rolling the static
  asset serving.** Rejected: Pages already provides the Git-integration,
  preview-deploy, and static-asset-serving conveniences on top of the same
  underlying Workers runtime that `adapter-cloudflare` targets — there is no
  benefit to bypassing Pages for a v0.1 SSG site.
- **Vercel or Netlify** (comparable static/Jamstack hosts). Not chosen:
  spec §4.3 names Cloudflare explicitly as the preferred target, and
  SvelteKit's Cloudflare adapter is mature and already the path of least
  friction; there was no concrete requirement pulling toward a different
  host.
- **A fully server-rendered (non-SSG) deployment from day one.** Rejected as
  unnecessary for v0.1: nothing in the current data model or route plan
  needs per-request dynamic rendering, and prerendering is simpler to reason
  about, faster to serve, and cheaper to run — dynamic server routes can be
  introduced incrementally later (see Decision above) without redoing this
  choice.
