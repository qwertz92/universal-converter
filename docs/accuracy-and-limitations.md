# Accuracy & Limitations — Universal Converter v0.1

> **Status:** Honest scope statement for v0.1.
> **Companion to:** `docs/conversion-rules.md` (the normative rulebook) and
> `docs/spec-v0.1.md`.
> **Purpose:** State plainly what the tool answers **exactly**, what it
> **estimates**, and what it **refuses** — and why. This document also seeds the
> user-facing *Methodology* and *Accuracy* pages.
>
> Guiding principle (spec §18–19): *correctness before speed, sources before
> invented numbers, transparency before simple-looking answers, and exact vs
> approximate always kept separate.* This page is where we admit our limits out
> loud, because a converter that hides its uncertainty is worse than useless — it
> is confidently wrong.

---

## 1. What v0.1 answers **exactly**

These conversions rest on SI identities or fixed definitions. They are correct to
full precision (capped only at display, §C.7 of the rulebook) and need no source
beyond the definition itself. They carry exactness `exact` or `standard_definition`.

- **Dimension-internal unit conversions**, e.g.
  `1 kWh = 3.6 MJ`, `1 MWh = 3.6 GJ`, `1 Wh = 3600 J`, `1 L = 0.001 m³`,
  `1 tonne = 1000 kg`, `1 h = 3600 s`, `1 barrel = 42 US gallons`.
- **Convention-defined energy units** (exact *by fiat*, though what they *stand
  for* is a convention, not a natural constant):
  `1 toe = 41.868 GJ`, `1 tce = 29.3076 GJ`,
  `1 boe = 5.8 MMBTU ≈ 6.1 GJ` (US convention — see §4),
  `1 cal_IT = 4.1868 J`, `1 BTU_IT = 1055.05585262 J`,
  `1 therm(US) = 10⁵ BTU_IT`, `1 quad = 10¹⁵ BTU_IT`.
- **Power × time arithmetic** once a time is supplied: `2 kW × 3 h = 6 kWh`
  (the arithmetic is exact; the *inputs'* precision still bounds the displayed
  result).
- **Hydrogen direct-combustion CO2 = 0** — a physical fact (no carbon in H₂),
  shown with an explanation and a "combustion only" label (§5).

**Caveat even here:** a value being *definitionally* exact does not make it the
*right convention* for the user's context. `boe`, `toe`, `therm`, `year` all have
competing definitions; we pick one, **label it**, and document the alternatives.
Exactness is about the arithmetic, not about "this is the number your accountant
will use".

---

## 2. What v0.1 **estimates** (source-based and representative values)

Anything that depends on a material property is **not** a natural constant. These
results carry `source_based` or `estimated`, cite their source, show their basis
and assumptions, and are precision-capped (3–4 sig figs source-based, 2–3 for
estimates, with a leading `~`).

- **Fuel density** (volume ↔ mass): diesel, gasoline, fuel oil, etc. Crude oil has
  none recorded, so a barrel of it converts to neither mass nor energy here.
- **Heating values** (mass/volume → energy): LHV/NCV by default, HHV/GCV alongside
  where data exists (§C.1).
- **Emission factors** (fuel → CO2 / CO2e): source-, basis-, scope-, region-, and
  year-dependent (§C.5).
- **Energy in "wood"/"coal"** — genuine ranges, shown as `~A–B`. (A physical
  barrel of crude was listed here too, against a ~5.6–6.3 GJ range that traced
  to no source; the range was withdrawn in v0.3.4.)

### 2.1 Per-fuel variability (qualitative)

The tool shows a single representative figure (or a range) per fuel, but real
fuels vary. This section describes *where* the variability comes from so users
understand why we hedge. **Numeric ranges live in the data files** (`data/*.json`,
with sources); here we describe the *nature* of the spread. Any specific numbers
below are illustrative of the *kind* of variation, deferred to data for authority.

- **Diesel / gasoline density.** Refinery blend, additives, seasonal grade, and
  **temperature** all move density by a few percent. Density falls as temperature
  rises (thermal expansion), so a "kg per litre" figure is only right near the
  reference temperature the source used. v0.1 uses a single reference-temperature
  density and does **not** model temperature dependence (§3).
- **Natural gas quality.** Composition (methane fraction, higher hydrocarbons,
  inert CO2/N₂) varies by field, by network, and over time, moving the calorific
  value across a band (roughly the ~10–11 kWh/m³ region for typical pipeline gas,
  per data). This is *the* reason `m³ gas → kWh` is never exact (§C.2 of rulebook).
- **Coal grades.** "Coal" spans anthracite → hard coal → sub-bituminous → lignite,
  with heating values differing by a **factor of two or more** and moisture/ash
  content adding further spread. v0.1 treats named grades as **separate fuels**
  (hard coal, lignite, anthracite) rather than one "coal", and still labels each
  as a representative estimate.
- **Wood / wood pellets.** Energy content is dominated by **moisture content**:
  oven-dry wood carries substantially more usable energy per kg than freshly
  felled ("green") wood, because water must be evaporated first (this is exactly
  the LHV/HHV distinction writ large). Species matters secondarily. Pellets are
  more uniform (controlled low moisture) but still vary. v0.1 states the assumed
  moisture basis where the source gives it, and marks the value `estimated`.
- **Biofuels (ethanol, biodiesel, biogas).** Feedstock and process drive both
  energy content and — critically — emission accounting (biogenic vs fossil
  fraction, §5). Biogas methane fraction varies widely with digester feedstock.

The honest summary: for these fuels the tool gives you a **well-sourced
representative value with its assumptions on display**, not a measurement of the
specific fuel in your tank, pipe, or pile.

---

## 3. What v0.1 **refuses** (context required or unsupported)

- **Power → energy without a time** → `context_required` (asks for a duration).
  Never a silent kW→kWh (§C.1/§9.1).
- **Electricity → CO2e without region + year** → `context_required`, with a
  region/year picker and clearly-labeled *illustrative* examples only (§C.6).
  v0.1 ships **no** authoritative country-by-year grid factors as defaults.
- **Fuel-dependent conversions without a fuel selected** (e.g. `1 L → kWh` with no
  material) → `context_required` ("pick a material").
- **CO2 ↔ CO2e conversion** → `unsupported` (different metrics, no path; §D.6).
- **A conversion needing data we don't have** → the value is marked
  **"not available"** rather than invented (spec §8.5, §17.24).
- **Dimensionally impossible conversions** (e.g. mass → time) → `unsupported`.

Refusing is a feature. A `context_required` prompt is the tool telling you the
question is answerable *once you pin down one more thing* — which is more useful
than a fake number.

---

## 4. Known limitations (v0.1)

1. **No region/year electricity factors as defaults.** Grid CO2e intensity varies
   by country, year, and time of day; v0.1 returns context-required and (if data
   exists) illustrative examples only. Country presets are roadmap 0.2/0.3.
2. **No real gas-billing model.** v0.1 uses a single displayed volumetric-energy
   assumption at a stated reference condition, with a mandatory warning. It does
   **not** know your supplier's Brennwert or your meter's Zustandszahl, so it
   **cannot reproduce a gas bill** (§C.2).
3. **No temperature dependence of density or volume.** Fuel densities are quoted at
   a single reference temperature; thermal expansion (and gas P/T behaviour beyond
   the stated reference) is not modelled.
4. **boe convention ambiguity.** v0.1 adopts the US/IRS **5.8 MMBTU ≈ 6.1 GJ**
   boe. Other conventions exist (e.g. IEA's ~7.15–7.40 boe per toe implies a
   slightly different figure); results state which convention is used, but a boe
   figure from another source may differ by a few percent.
5. **Single heating-value basis default (LHV/NCV).** Where only one basis is in
   data, the other is shown "not available" and is **not** derived generically —
   correct, but it means some fuels show only one basis in v0.1.
6. **Representative fuel values, not measurements.** All fuel properties are
   representative/sourced, not specific to the user's actual fuel batch (§2.1).
7. **Scope coverage is partial.** v0.1 focuses on direct-combustion / Scope-1-style
   factors where cited data exists; well-to-wheel and full lifecycle factors are
   included only where a source provides them, and are labeled — otherwise
   context-required. Full WTW is roadmap 0.3.
8. **Hydrogen upstream not included by default.** Only combustion CO2 (= 0) is
   asserted; production-pathway upstream emissions are context-required (§5).
9. **No currency / price conversions** (€/MWh, ct/kWh) in v0.1 — roadmap.
10. **GWP set dependence for CO2e.** CO2e depends on the GWP values used (IPCC
    AR4/AR5/AR6, 100-yr vs 20-yr). v0.1 reports the source's stated GWP set where
    known; comparing CO2e figures across sources with different GWP sets is not
    apples-to-apples.
11. **"ton" / "gallon" ambiguity handled by disambiguation, not silent default.**
    Correct behaviour, but it means the tool sometimes asks a clarifying question
    instead of answering immediately.

---

## 5. Emissions: what "zero" and "e" really mean here

- **Biogenic CO2** (wood, ethanol, biodiesel, biogas) is **reported as its own
  labeled line, outside the main scopes** — never silently counted as zero inside a
  fossil total, and never hidden. The carbon *is* emitted at the stack; the
  separate accounting reflects the biological carbon cycle, an accounting
  convention (IPCC / GHG Protocol), not a claim of zero physical emission.
- **Hydrogen combustion CO2 = 0** is exact and physical — but labeled **"combustion
  only"**. Upstream (grey/blue/green production) is **not** included unless a cited
  pathway factor exists; otherwise it is context-required. A bare "hydrogen = 0
  CO2" lifecycle claim is exactly the kind of overclaim this tool refuses to make.
- **CO2 ≠ CO2e**, always. Every emission result states metric + scope + basis +
  region + year. Missing CO2e is "not available", never derived from CO2.

---

## 6. What you must **not** use this tool for

- **Billing disputes.** Especially gas: the tool cannot reproduce your supplier's
  invoice (it lacks your local Brennwert and Zustandszahl). Use your meter data
  and invoice.
- **Regulatory / statutory GHG reporting** (CSRD, GHG Protocol, ETS, national
  inventories) **without checking primary sources.** Use the mandated factor set
  for your jurisdiction and year (e.g. DESNZ/DEFRA for the UK, EPA for the US, the
  national inventory guidance elsewhere) — and mind the Gross-vs-Net CV basis your
  regime requires. This tool is an explanatory aid, not a compliance calculator.
- **Custody transfer, trading settlement, or engineering safety calculations** —
  anywhere a real, measured, jurisdiction-specific value is legally or financially
  binding. Our figures are representative and sourced, not certified for your
  specific transaction.
- **Treating any estimate as a measurement** of your specific fuel. Where the tool
  says `~`, it means it.

When in doubt: follow the **Sources** panel on each result back to the primary
document, and use *that* for anything consequential. That traceability is the
whole point of the product.

---

## Cross-references

- Normative rules, exactness taxonomy, decision flow: `docs/conversion-rules.md`.
- Numeric values, ranges, and provenance: `data/*.json`, `docs/sources.md`,
  `docs/research-notes.md`.
- Product scope and acceptance criteria: `docs/spec-v0.1.md`.
