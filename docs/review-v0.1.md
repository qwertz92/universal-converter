# Review — Universal Converter v0.1

> **Reviewer:** Review agent (adversarial quality gate).
> **Date:** 2026-07-05.
> **Method:** All four gates run locally; engine outputs dumped and hand-checked;
> 9 conversions verified by independent arithmetic from `data/*.json`; data
> provenance traced to `docs/research-notes.md`; guard behaviour probed; UI pages
> fetched from a live `wrangler pages dev` preview; all 30 acceptance criteria
> audited against code/data/render, not against other agents' reports.
> **Verdict:** Ship-ready after the P0 (one true-P0 + the stale-doc cluster).
> The engine and data are sound; the outstanding issues are documentation drift
> and two cosmetic UI items. No invented numbers, no CO2/CO2e conflation, no
> false exactness found in the shipped product.

---

## Gate results (run by the reviewer)

| Gate | Command | Result |
|---|---|---|
| Build | `npm run build` | ✅ green (Cloudflare adapter, built in ~4s) |
| Types | `npm run check` | ✅ green (512 files, 0 errors, 0 warnings) |
| Lint | `npm run lint` | ✅ green (Prettier + ESLint clean) |
| Tests | `npm test` | ✅ green — **324 tests, 16 files** |
| Preview | `wrangler pages dev` | ✅ served; `/`, `/convert?q=…`, `/fuels/crude-oil`, `/learn/co2-vs-co2e`, `/sources`, `/fuels`, `/methodology`, `/units/kilowatt_hour` all HTTP 200 |

Catalog counts (measured): **73 units · 21 fuels · 33 emission factors · 10 sources · 20 examples**.
Factors: 12 CO2 · 16 CO2e · 5 biogenic_CO2 (2 of the 16 CO2e/CO2 are illustrative electricity).

---

## Part 1 — Acceptance criteria audit (spec §17)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Runs locally with documented commands | PASS | `npm run dev/build/preview` in README; all gates ran clean. |
| 2 | Cloudflare-deploy ready | PASS | `adapter-cloudflare`, `wrangler.jsonc`, preview served under workerd. |
| 3 | SvelteKit + TS clean | PASS | strict TS, `check` 0 errors. |
| 4 | Engine framework-independent | PASS | `src/lib/conversion/*` etc. import no Svelte; usable from node (verified via direct import in scratch harness). |
| 5 | Exact unit conversions work | PASS | `1 kWh→3.6 MJ`, `1 m³→6.28981 bbl` verified by hand; golden `exactRaw` asserts. |
| 6 | Context fuel conversions w/ sources | PASS | `1 L diesel` → mass/energy/emissions, each source_based w/ `uk-desnz-ghg-2025`. |
| 7 | Emissions for multiple fuels | PASS | 33 factors across 20 fuels; diesel/gasoline/gas/wood/H2 all produce cited figures. |
| 8 | Multiple result groups | PASS | canonical group order in `result-groups.ts`; diesel shows 6 groups. |
| 9 | Results carry assumptions/sources/warnings | PASS | meta-groups populated; `1 L diesel` carries HV-basis assumption + representative-value warning + source. |
| 10 | Exact vs non-exact distinct | PASS | 8-level `ExactnessBadge` from single `EXACTNESS_META`; source_based never renders as exact. |
| 11 | Fuel catalog exists | PASS | 21 fuels incl. electricity, spec §8.5 list fully covered. |
| 12 | Sources catalog exists | PASS | `data/sources.json` = 10 entries, all referenced ids resolve. |
| 13 | Data validation exists | PASS | Zod strict envelopes + `validate-data.ts`; `data-validation*.test.ts` assert referential integrity. |
| 14 | ≥30 tests pass | PASS | 324 pass. |
| 15 | README usable | PARTIAL | Content good, but **Status section is stale** ("under construction", "79 tests", "UI being built out") — see P0-B. |
| 16 | Architecture doc | PASS | `docs/architecture.md` (228 lines, Mermaid). |
| 17 | Data-model doc | PARTIAL | Exists & thorough, but **counts stale** (fuels 20→21, examples 19→20; electricity row missing from coverage matrix). |
| 18 | Conversion rules documented | PASS | `docs/conversion-rules.md` (564 lines, normative). |
| 19 | Accuracy/limitations documented | PASS | `docs/accuracy-and-limitations.md` (202 lines). |
| 20 | Roadmap documented | PARTIAL | Exists, but **"In progress" section is stale** (claims empty data files + placeholder UI, "79 tests", "67 units") — see P0-B. |
| 21 | Learn pages/content exist | PASS | 14 topics (`learn.ts`) + full prose bodies (`learn-bodies.ts`); matches spec §11 exactly. |
| 22 | UI mobile-first & serious | PASS | no fixed px widths in components; class-based dark mode + `prefers-color-scheme`; `.org` typography. |
| 23 | Quick examples work | PASS | `examples.json` = 20, guarded by `examples.test.ts`; all spec §8.2 inputs convert. |
| 24 | No unverified numbers w/o source | PARTIAL | Shipped data is sourced & non-invented (spot-checked 9 values). BUT two shipped values (H2 HHV 141.79; biogenic CO2 figures) are **not written into `research-notes.md`** — traceable to `sources.json`/factor notes, but the provenance ledger is incomplete — see P1. |
| 25 | No false precision on estimates | PASS | `numbers.ts` caps sig-figs by exactness; estimates get `~`; exact never gets `~`. |
| 26 | No auto power→energy w/o time | PASS | `5 kW` → `context_required missing:["time"]`; `2 kW × 3 h = 6 kWh` exact (guards test). |
| 27 | CO2 and CO2e separated | PASS | separate pseudo-dimensions, no path; separate factor entries; `isCo2Co2eCrossing` guarded. |
| 28 | HHV/LHV clearly marked | PASS | every fuel-energy result labels basis; HHV shown as labeled secondary; no generic derivation. |
| 29 | Gas conversions show warnings/assumptions | PASS | `natural-gas` carries billing + reference-condition warnings; energy is source_based, never exact, with range. |
| 30 | Final review file exists | PASS | this file. |

**Tally: 24 PASS, 6 PARTIAL, 0 FAIL.** All 6 PARTIALs are documentation drift (criteria 15/17/20/24) — none is a code or data defect.

### Independent math checks (all matched engine to rounding)

| Conversion | Hand result | Engine | ✓ |
|---|---|---|---|
| diesel L→MJ (0.832361 kg/L; 9.905 kWh/L·3.6) | 35.658 | 35.66 | ✓ |
| natural gas m³→kWh LHV (0.802·12.707) / HHV (·14.077) | 10.191 / 11.290 | 10.19 / 11.29 | ✓ |
| 1 toe → MMBTU (41.868 GJ ÷ 1055.05585262 J) | 39.6832 | 39.6832 | ✓ |
| 1 boe → kWh (5.8 MMBTU) | 1699.81 | 1699.81 | ✓ |
| 1 boe → GJ | 6.11932 | 6.11932 | ✓ |
| wood pellets kg→biogenic CO2 (1.67718 kg/kg) | 1.67718 | ~1.68 | ✓ |
| diesel L→CO2 / CO2e (2.53763 / 2.57082) | as data | ~2.54 / ~2.57 | ✓ |
| 1 toe → tce | 1.42857 | 1.42857 | ✓ |
| 1 kWh → BTU | 3412.14 | 3412.14 | ✓ |

Biogenic CO2 figures cross-checked against IPCC stoichiometry (e.g. ethanol 1.507 vs shipped 1.52/L; biodiesel 2.344 vs 2.39/L) — plausible, not invented.

### Guard checks (probed directly)
- `5 kW` → `context_required missing:["time"]`, no auto-energy. ✓
- `1 kWh electricity` → energy exact + emissions `context_required missing:["region","year"]` + 2 illustrative examples (UK 2025 177 gCO2e/kWh, EU-27 2023 242 gCO2/kWh, each region+year+source labeled). ✓
- CO2 vs CO2e never conflated (separate factor entries; guard test asserts crossing illegal). ✓
- `1 kg hydrogen` → CO2 = `0` `exact` with "combustion only" warning; no upstream implied. ✓
- `1 ton coal` → `ambiguous_unit` (tonne / short_ton / long_ton). ✓

---

## Part 2 — Findings (prioritised)

### P0 — must fix before calling v0.1 done

**P0-A — `data-model.md` & `golden/cases.ts` claim the electricity fuel does not exist.**
`tests/golden/cases.ts` lines ~496–502 assert in a comment: *"data/fuels.json has NO 'electricity' fuel entry, so this input cannot be parsed against the real catalog (documented gap)."* This is now **false** — `electricity` is a shipped fuel (id `electricity`), `1 kWh electricity` parses and produces the full context_required + illustrative-examples flow. A stale comment claiming a shipped capability is missing is misleading to the next agent and undercuts the electricity acceptance path (§13.4). *Not a runtime bug, but it's a factual falsehood in a test file that the reviewer's own testing contradicts — fix the comment (and the `data-gaps.test.ts` premise if it shares it).* Acceptance check: comment reflects that electricity exists and `1 kWh electricity` is exercised.

**P0-B — Stale status blocks in README / roadmap contradict shipped reality (release-blocker for a "done" claim).**
These read as "work in progress" on a repo being declared v0.1-done:
- `README.md` §Status (~L160): "**v0.1, under active construction**", "**79 passing Vitest tests**" (actual 324), "the data catalog and the SvelteKit UI routes **are being built out**", "Treat this as a serious work in progress, not a finished product."
- `docs/roadmap.md` §0.1 (L29–L50): "`units.json` populated with **67 units**" (actual 73); "**79 passing** tests" (actual 324); an **"In progress"** list stating `fuels.json`/`emission-factors.json` "exist with a valid empty envelope but **no entries yet**" and "**Only the root layout and a placeholder landing page** exist in `src/routes`". All false — 21 fuels, 33 factors, full UI shipped.

Acceptance check: README Status and roadmap §0.1 describe the shipped state (324 tests, 73 units, 21 fuels, 33 factors, full UI/Learn pages) with no "in progress / not yet populated" language.

### P1 — should fix

**P1-C — `docs/sources.md` is stale and not 1:1 with `data/sources.json`.**
- Status note (L12–L19) still says sources.json "contains the **three seed entries**" and the fuel sources are documented "**ahead of** the Data agent populating" the files — false (10 sources, catalog populated).
- **Missing from the human register but present & actively used in `sources.json`:** `nist-webbook`, `spec-conversion-rules`. So the register omits two real, cited sources.
- `h2tools` row states HHV **141.88 MJ/kg** — the shipped value is **141.79** (`sources.json`/`fuels.json` corrected it to the NIST-printed figure). Stale number in the human doc.
Acceptance check: sources.md status note removed; register lists all 10 `sources.json` ids incl. `nist-webbook` and `spec-conversion-rules`; H2 HHV reads 141.79.

**P1-D — `research-notes.md` provenance ledger is incomplete for post-research-pass values.**
Two classes of shipped value do not appear in research-notes:
- **H2 HHV 141.79** (research-notes §4.8 still says 141.88 / 141.86). The shipped 141.79 is sourced to `nist-webbook` and explained in `fuels.json` notes — sourced, *not invented* — but research-notes wasn't updated.
- **Biogenic CO2 figures** (wood-logs 1.43623, wood-pellets 1.67718, ethanol 1.52, biodiesel 2.39, biogas 1.1056695 kg/kg or /L): research-notes §4.10/§4.11 explicitly **flagged the DESNZ "Outside of scopes" sheet as NOT extracted** in that pass. The values were added later (cited in `emission-factors.json`, stoichiometrically plausible), but the ledger that criterion §24 leans on never recorded them.
Judged **P1, not P0**: these are traceable to a named source and internally consistent — not invented — but the "every number in research-notes" contract is broken. Acceptance check: research-notes §4.8/§4.10/§4.11 record 141.79 and the DESNZ Outside-of-scopes biogenic figures with their source cells.

**P1-E — `data-model.md` counts & coverage matrix stale.**
Table §1 says fuels **20** (actual 21) and examples **19** (actual 20); the §5 coverage matrix omits the `electricity` fuel row. Acceptance check: counts read 21/20; electricity row added to the coverage matrix.

### P2 — nice-to-have / 0.2

**P2-F — `pushUrl()` can emit a trailing-`?` URL.** `Converter.svelte` `submit()` calls `pushUrl()` unconditionally; when `queryText` is empty and basis is default, `buildQueryString` returns `''` and `goto(resolve('/?'))` / `'/convert?'` produces a bare-`?` URL. Cosmetic (empty submit only). Fix: skip `pushUrl` when params is empty, or guard `submit()` on non-empty query.

**P2-G — `page.route.id === '/convert'` cast is a fragile assumption.** `Converter.svelte` L88 assumes the component only mounts on `/` or `/convert` (true today — confirmed both mount points). Any future third mount silently routes URL sync to `/`. Add a defensive fallback or derive the base from `page.url.pathname`.

**P2-H — meta-group rows reuse odd exactness badges.** `result-groups.ts` renders every **warning** row with `exactness:'unsupported'` → the "not available ×" badge, and every **assumption** (incl. the "1,500 thousands-separator" parser note) with `user_assumption` → "your assumption ✎". Semantically off (a billing warning is not "not available"; a parser note is not the user's assumption). Cosmetic; consider a neutral meta badge.

**P2-I — `/units/kwh` 404s.** Unit slugs are full ids (`kilowatt_hour`), so the spec §4.1 example path `/units/kwh` returns 404 while `/units/btu`, `/units/boe`, `/units/barrel` work. Add `kwh`/`mwh` etc. as slug aliases if those short URLs are wanted for SEO.

**P2-J — illustrative electricity examples mix metrics.** The two illustrative rows are UK **CO2e** (177) and EU-27 **CO2** (242); shown side by side (unit-labeled, so distinguishable) they invite an apples-to-oranges read. Consider matching metric or annotating the CO2-vs-CO2e difference inline.

### Watch-items from prior agents — reviewer's verdict
- (a) trailing `?` URL → **confirmed real**, P2-F.
- (b) `page.route.id` cast → **confirmed, low risk** (only 2 mount points today), P2-G.
- (c) does UI surface `ParsedQuery.notes`? → **YES** — engine adds them as `parser_note` assumptions → Assumptions meta-group (verified: `1,500 kcal` shows the note, `1500 kcal` does not).
- (d) `Mg`→tonne vs `MG`→ambiguous consistency → **correct & consistent**: `Mg` (case-sensitive symbol) → tonne; `MG` → ambiguous (milligram vs tonne); `mg` → milligram. Matches rulebook D.9.

### Domain-correctness spot-checks (thorough, 8 of 14 Learn pages)
kwh-vs-kw (Julian year defined), joule-vs-wh (`1 Wh=3600 J`, `1 kWh=3.6 MJ` exact), btu-and-mmbtu (IT BTU 1055.05585262 J, MM=million), barrel-vs-boe (42 US gal exact vs 5.8 MMBTU convention; crude ~5.6–6.3 GJ estimate), hhv-vs-lhv (Brennwert/Heizwert, gap 5–20%, no generic derivation), co2-vs-co2e (no path, biogenic separate, H2 combustion-only), natural-gas-m3-to-kwh (Nm³/Sm³, Brennwert/Zustandszahl, never exact), food-calories (`1 Cal=1 kcal=4186.8 J` IT). **All correct; no false exactness; estimates carry `~`.** Exactness badges are trustworthy because the engine assigns the level and the badge derives from it.

### Test quality
Strong. `golden/cases.ts` derives every expected value by hand from the shipped catalog with tolerances tight enough to catch a wrong factor — e.g. the diesel-LHV case asserts 9.905 kWh/L ±0.0005; an LHV↔HHV swap (10.531) is well outside tolerance and **would fail**. `guards.test.ts` asserts the hard rules directly (no auto kW→kWh; exact P·t; CO2↔CO2e crossing illegal; no-fuel→context_required). No hollow category observed.

---

## Part 3 — Prioritised to-do list

**P0 (block "done"):**
1. `tests/golden/cases.ts` (~L496–502) & `tests/golden/data-gaps.test.ts` — remove/replace the "no electricity fuel entry" claim; add a real `1 kWh electricity` golden case exercising context_required + illustrative examples. *Why:* a shipped capability is documented as absent. *Check:* comment matches reality; test exercises the electricity path.
2. `README.md` §Status + `docs/roadmap.md` §0.1 — replace all "under construction / in progress / not yet populated / 79 tests / 67 units / placeholder UI" text with the shipped state (324 tests, 73 units, 21 fuels, 33 factors, full UI + 14 Learn pages). *Why:* a "done" release cannot ship docs that call itself unfinished. *Check:* no WIP language; counts correct.

**P1 (should fix):**
3. `docs/sources.md` — drop the "three seed entries" status note; add `nist-webbook` + `spec-conversion-rules` to the register; correct H2 HHV to 141.79. *Check:* register 1:1 with `sources.json` (10 ids).
4. `docs/research-notes.md` §4.8/§4.10/§4.11 — record the shipped H2 HHV 141.79 and the DESNZ "Outside of scopes" biogenic CO2 figures with their source cells. *Check:* every shipped data value resolves to a research-notes entry (satisfies §24 literally).
5. `docs/data-model.md` §1 + §5 — fuels 20→21, examples 19→20; add the `electricity` row to the coverage matrix. *Check:* counts and matrix match the files.

**P2 (0.2 / nice-to-have):**
6. `Converter.svelte` — guard `pushUrl()`/`submit()` against empty params (no trailing `?`).
7. `Converter.svelte` — make the `/convert` vs `/` base derivation defensive (`page.url.pathname`).
8. `result-groups.ts` — give warning/assumption meta rows a neutral badge instead of `unsupported`/`user_assumption`.
9. `src/routes/units/[unit]` — optional short slug aliases (`kwh`, `mwh`) for SEO parity with spec §4.1.
10. Electricity illustrative examples — align metric (CO2 vs CO2e) or annotate the difference.

---

## Cross-references
- Rulebook: `docs/conversion-rules.md` · Scope/limits: `docs/accuracy-and-limitations.md`
- Data model: `docs/data-model.md` · Provenance: `docs/research-notes.md`, `docs/sources.md`
- Spec & acceptance criteria: `docs/spec-v0.1.md` §17.
