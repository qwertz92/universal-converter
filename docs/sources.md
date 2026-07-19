# Sources — Universal Converter

> Human-readable source register. The machine-readable version lives in
> [`data/sources.json`](../data/sources.json), which every non-exact value in
> `data/units.json`, `data/fuels.json`, and `data/emission-factors.json`
> references by `source_refs` / `source_id`. This document explains, for a
> human reader, *what each source is, why we trust it (or don't), and what we
> use it for*. The underlying research is in
> [`docs/research-notes.md`](research-notes.md); the modeling decisions that
> depend on these sources are in [`docs/conversion-rules.md`](conversion-rules.md).
>
> **Status:** `data/sources.json` is fully populated — **10 sources**,
> covering the shipped unit, fuel, and emission-factor catalogs alike. This
> register is 1:1 with those 10 ids (see the table below).

---

## Provenance rules (summary)

These rules are normative (`AGENTS.md`, spec §12, §18–19) and apply to every
data file in this project:

- **No number without a source.** Every non-exact value carries
  `source_refs` resolving to an entry in `data/sources.json`. If a value
  seems "commonly known," it still gets a citation.
- **Verbatim values, no derivation-by-generic-factor.** Values are stored as
  given by their source, in the source's own unit and basis (with the
  original unit/basis recorded in `notes` where a conversion was applied to
  fit the data schema). We do not derive HHV from LHV, CO2e from CO2, or a
  physical-barrel energy from `boe` via a generic multiplier — each is either
  sourced directly or marked "not available" (rulebook §C.1 rule 4, §C.5,
  §D.17).
- **No silent averaging of diverging sources.** Where DESNZ, IPCC, EPA, and
  EIA disagree on a fuel property (which they do, by design — different
  regions, years, and methodologies), we record each source's value
  separately rather than blending them into one number (rulebook §D.16).
- **"Not available" over guessing.** A missing property is left absent from
  the data file — the UI shows "not available" — rather than filled with an
  invented or interpolated figure (spec §8.5).
- **`retrieved_at` discipline.** Every source's data was retrieved via a
  fetch dated in `docs/research-notes.md` (2026-07-04 for the current
  catalog); if a source is refreshed later, `retrieved_at` is updated so
  staleness is visible rather than implied to be current.

---

## Required attribution

### UK DESNZ 2025 GHG Conversion Factors (Open Government Licence v3.0)

Any page or dataset export that presents DESNZ-derived figures must carry the
standard OGL attribution line:

> Contains public sector information licensed under the Open Government
> Licence v3.0.

Where practical, also link to the specific gov.uk publication page
(`https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025`)
alongside the attribution, per OGL good practice. OGL v3.0 explicitly permits
commercial and non-commercial copying, publishing, distribution, and
adaptation with attribution — this is why DESNZ is usable as the primary
fuel/emissions data source for a public site.

### IPCC 2006 Guidelines

© IPCC 2006. Short excerpts and individual cited figures (which is how this
project uses the Guidelines — specific NCV/CO2-factor rows, not bulk table
reproduction) are used with full attribution: report name ("2006 IPCC
Guidelines for National Greenhouse Gas Inventories"), publisher (IGES for the
IPCC), and the specific table/page number cited. We do not bulk-republish
full multi-page tables as a redistributable dataset — that would require
separate written permission from the IPCC Secretariat.

### US federal sources (EPA, EIA, NIST)

Public domain as US federal government works — freely reusable with no
attribution requirement, though this project cites them by name and URL for
transparency regardless.

---

## Source register

| Source | Publisher | License / usability | What we use it for | Reliability note |
|---|---|---|---|---|
| **UK DESNZ 2025 GHG Conversion Factors** (`uk-desnz-ghg-2025`) | UK Department for Energy Security and Net Zero | Open Government Licence v3.0 — commercial + non-commercial reuse with attribution | **Primary source** for fuel density, NCV/GCV heating values, and the CO2/CH4/N2O/CO2e split for nearly every fuel in the v0.1 catalog (petrol, diesel, kerosene/jet fuel, LPG/propane/butane, natural gas/CNG/LNG, coal categories, wood/biomass, ethanol/biodiesel/biogas), plus UK grid electricity intensity (illustrative example only, region+year labeled) | Very high — actively maintained, methodologically transparent, the only source giving density + both CV bases + full gas split + CO2e in one place. [gov.uk publication](https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025) |
| **IPCC 2006 Guidelines, Vol. 2: Energy** (`ipcc-2006-v2`) | IPCC / IGES | © IPCC — free reuse of cited excerpts/figures; no bulk redistribution without permission | **Global fallback** default NCVs and CO2/CH4/N2O emission factors (Tables 1.2, 2.2) for fuels DESNZ doesn't cover cleanly: generic crude oil, anthracite, lignite (DESNZ's coal categories are functional — industrial/domestic/generation — not rank-based), and biofuels' raw combustion CO2 before biogenic netting | Very high — the standard Tier-1 international default when no better regional source exists. Ranges (e.g. lignite NCV 5.50–21.6 TJ/Gg) reflect genuine real-world spread, not measurement error. [ipcc-nggip.iges.or.jp](https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html) |
| **US EPA GHG Emission Factors Hub 2025** (`epa-ghg-hub-2025`) | US EPA (Center for Corporate Climate Leadership) | US federal government work — public domain | **Reserved for 0.2+ US data work** (no shipped value cites it yet): Scope 1/2/3 factors, eGRID electricity intensity by subregion, to sanity-check DESNZ/IPCC order of magnitude and to offer an explicit US alternative, never blended with UK/global figures. A US grid factor ships only after the exact "US Average" row of Table 6 is re-extracted from the Hub's XLSX (`docs/research-notes.md` §4.13 flags the current ~370 gCO2/kWh secondary figure as provisional/unverified — it must NOT be transcribed into `data/`) | High — 435 factors, widely used for corporate GHG reporting; traces to 40 CFR Part 98 / the US GHG Inventory. [epa.gov](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) |
| **US EIA** — Energy units & calculators, heat contents, CO2 coefficients (`eia-heat-contents`) | US Energy Information Administration | US federal government work — public domain | **US-specific cross-check** for heat contents (Btu/gallon, Btu/cubic foot) and CO2 coefficients per fuel | High — standard US reference, but US-national-average scoped with no international generalization; used only as a labeled alternative, never a default |
| **NIST Special Publication 811** (`nist-sp811`) | National Institute of Standards and Technology | US federal government work — public domain | **Exact SI/definitional constants**: IT calorie (4.1868 J), IT BTU (1055.05585262 J), pound (0.45359237 kg), US/imperial gallon, cubic foot — the backbone of `data/units.json`'s exact unit factors | Very high — the canonical US reference for SI usage; 2008 edition (not yet updated for the 2019 SI redefinition, per NIST's own note — does not affect the constants we use) |
| **IEA Unit Converter / unit conventions** (`iea-unit-conventions` / `iea-unit-converter`) | International Energy Agency | CC BY 4.0 for the tool/page itself (**not** IEA's paid statistical datasets — see exclusion below) | Definitions of `toe` (41.868 GJ) and `tce` (29.3076 GJ) as international-energy-balance conventions | Medium-high for definitions; the tool itself shows no per-factor sourcing, so we cite the convention, not the tool's computed output |
| **H2Tools (Hydrogen Tools)** (`h2tools`) | Pacific Northwest National Laboratory for US DOE Hydrogen Safety Panel | US DOE-funded public resource; treat as citable with attribution | Hydrogen physical properties (cross-check): LHV 119.96 MJ/kg (33.3 kWh/kg), HHV ~141.86–141.88 MJ/kg (39.4 kWh/kg) as originally cited, gas/liquid density | High by reputation and cross-source consistency; our own confidence is **medium** because the primary page blocked automated fetch (HTTP 403) during research — figures are cross-verified via independent secondary sources citing DOE/NIST data. The shipped HHV value uses the NIST WebBook-traceable figure instead (see `nist-webbook` below); h2tools remains a cross-check, not the primary citation for that number. Flagged for a manual re-check before being treated as fully first-hand. |
| **NIST Chemistry WebBook** (`nist-webbook`) | National Institute of Standards and Technology (NIST), US Dept. of Commerce | US federal government work — public domain | **Primary source for the shipped hydrogen heating values**: LHV 119.96 MJ/kg, **HHV 141.79 MJ/kg** (≈ 39.4 kWh/kg), derived from the 25 °C heat-of-combustion/formation enthalpies (285.83 kJ/mol); also hydrogen density (gas 0.08988 kg/m³, liquid 70.85 kg/m³) via NIST's "Thermophysical Properties of Hydrogen" | Very high — the authoritative US thermochemical reference. Used in place of h2tools for the HHV figure specifically because it gives a NIST-printed value; cross-checked against DOE GREET/ORNL (~142.18 MJ/kg, noted as a range, not averaged). |
| **Universal Converter — Conversion Rules** (`spec-conversion-rules`) | Universal Converter project (internal) | Internal project document | Normative rulebook reference for the project's own chosen conventions (IT calorie/BTU, toe/tce/boe, therm, Julian year) — cited as a `source_ref` alongside the real external source on the affected units, never as the sole citation | Not an external authority — records that a value follows a documented project convention. Kept alongside the corresponding external source (`nist-sp811` / `iea-unit-conventions`). |
| **EEA electricity emission intensity** (`eea-electricity-intensity`) | European Environment Agency | Generally reusable EU-institution content with attribution (standard practice, not individually re-confirmed) | Illustrative EU-27 electricity grid intensity example (2023: 242 gCO2/kWh), always region+year labeled, never a default | Medium — good EU-aggregate cross-check; the fetched page's 2024 figure was not extractable at full precision, so the 2023 figure is used with an explicit "not yet updated to 2024" caveat |
| **SEAI Conversion & Emission Factors** | Sustainable Energy Authority of Ireland | Irish public-sector data; exact license terms not yet confirmed | *Consulted during research, not currently cited in data.* Potential EU-country cross-check, not yet mined into the data files and not present in `data/sources.json` | Medium-high; verify the license page before bulk reuse if it is added later |
| **Engineering ToolBox** | Private commercial site | Not a licensed dataset | *Consulted during research, not currently cited in data.* Plausibility cross-check only during research — never a primary citation for any shipped value, and not present in `data/sources.json` | Low-medium as a primary source; fine for sanity-checking order of magnitude, per project rules (spec §6.1/§12) |
| **UCUM**, **QUDT** | Regenstrief Institute / QUDT.org | Open specifications | *Consulted during research, not currently cited in data.* Reference vocabularies used for unit id/alias/ontology design — not numeric-factor sources, not present in `data/sources.json` | N/A — design references only |
| **OPEC Annual Statistical Bulletin** | OPEC | Publicly downloadable PDF; license not fully assessed | *Consulted during research, not currently cited in data.* Potential source for an OPEC-specific `boe` convention note, not confirmed and not present in `data/sources.json` | Not fully verified — flagged as a research gap; not currently cited for any shipped value |

### Explicitly excluded

**IEA World Energy Balances / World Energy Statistics** (the detailed,
multi-country statistical dataset) is **paywalled and license-restricted**
for most content — a free extract covers only a subset of
OECD/IEA-Association-country flows, and the full dataset requires a paid,
non-redistributable license. This project uses **only** IEA's free Unit
Converter tool, its glossary, and publicly posted methodology PDFs (Energy
Statistics Manual). No IEA country-level balance figures appear anywhere in
`data/*.json`. See ADR
[0002](adr/0002-data-provenance.md) for the reasoning.

Competitor/comparable converter sites analyzed for positioning
(unitconverters.net, convertunits.com, RapidTables, WolframAlpha,
calculator.net — see `docs/research-notes.md` §1) are **not sources** and are
never cited for any numeric value.

---

## Cross-references

- Raw research findings and per-fuel value tables: `docs/research-notes.md`.
- Modeling decisions that depend on source selection (LHV/HHV default,
  boe convention, CO2/CO2e separation): `docs/conversion-rules.md`.
- Data-provenance architecture decision: `docs/adr/0002-data-provenance.md`.
- Data file schemas: `docs/data-model.md`.
