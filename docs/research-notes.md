# Research Notes — Universal Converter

> Research-Agent deliverable per `docs/spec-v0.1.md` §6.1. All numeric values in this
> document were retrieved via live web search/fetch on **2026-07-04** (`retrieved_at`
> for every source below is 2026-07-04 unless stated otherwise). No value in this file
> was recalled from model memory without a corresponding fetched source; where a
> value could not be verified from a fetched page it is marked **NOT FOUND**.

---

## 1. Competitor / comparable-site analysis

### IEA Unit Converter (`iea.org/data-and-statistics/data-tools/unit-converter`)
Simple three-category converter (energy, mass, volume) for units common in the
energy sector, licensed CC BY 4.0, last updated 2023-12-30. Good for a quick
"is my factor right" plausibility check but the tool itself shows no formulas,
no source citation per factor, and no distinction between exact and
material-dependent conversions (e.g. it will convert litres of "oil" to tonnes
using a single implicit density). No provenance UI at all.

### EIA Energy Conversion Calculators (`eia.gov/energyexplained/units-and-calculators`)
Separate calculators per fuel (coal, electricity, natural gas, crude oil,
gasoline, diesel/heating oil, food calories). Strength: each number links back
to the underlying EIA table (e.g. "Heat contents for fuels and electricity"),
and the whole site is public domain (US federal government work). Weakness: US-
customary-unit-first design, one fuel per page (no combined "1 L diesel → many
things" result), no CO2/CO2e figures integrated into the same calculators
(those live on a separate page), and everything is scoped to US national
averages with no explicit international generalization warning.

### unitconverters.net / convertunits.com
Classic ad-supported "type a number, get a number" converters. unitconverters.net
alone exposes 55 different energy units and is a top competitor of
convertunits.com by traffic. Neither shows formulas, sources, uncertainty, or
any distinction between an SI-exact conversion (e.g. kWh→MJ) and a
material-dependent one (e.g. L diesel→kg). No LHV/HHV concept exists on these
sites at all — if they do fuel↔energy conversions they use one undocumented
factor.

### RapidTables (`rapidtables.com/convert/energy`)
Clean, fast, well-organized per-category converter pages (energy, power,
electrical). No sources cited on the pages themselves, no material/fuel
conversions (pure unit-to-unit only), no provenance or assumptions shown.
Good UX benchmark for speed and clarity of a single conversion, bad benchmark
for transparency.

### WolframAlpha (converter aspect)
Positions itself as "the world's most extensive and accurate unit converter,"
covering thousands of units across historical and modern systems, with a
dedicated energy-conversion widget. Strength: enormous unit coverage and
correct dimensional handling (temperature differences vs. absolute
temperatures, etc.). Weakness for our purposes: it is a general symbolic-computation
engine, not a source-transparent tool — conversion factors are baked into its
internal knowledge base without user-facing citations, and it has no concept of
LHV vs. HHV, CO2 vs. CO2e, or "this number is an estimate."

### calculator.net Conversion Calculator
Simple category-based converter (length, weight, energy, etc.), no
fuel/material context, no sources, no formulas shown — comparable in spirit to
unitconverters.net.

### Engineering ToolBox (`engineeringtoolbox.com`)
Extensive tables of fuel heating values, densities, and conversion factors
aimed at engineers. Useful as a plausibility cross-check (per spec instruction)
but values are frequently unsourced on the page itself (no citation to a
primary standard), mixing textbook approximations with "typical" values without
clear provenance. Per project rules we use it only for sanity-checking, never
as a primary source.

### Differentiation opportunities for Universal Converter
1. **Explicit exactness taxonomy** ("exact", "standard definition",
   "source-based", "estimated", "region/year-specific") shown on every single
   result — none of the competitors above expose this distinction at all.
2. **Combined result groups from one input** (`1 L diesel` → volume + mass +
   energy + emissions + energy-density simultaneously), rather than one
   calculator per fuel per direction (EIA's approach) or one unit-pair per
   page (RapidTables/convertunits.com).
3. **First-class LHV/NCV vs. HHV/GCV labeling** on every energy-from-fuel
   result, with both values shown side by side where available (only DESNZ
   does this among our sources; no competitor site does it in the UI).
4. **CO2 vs. CO2e kept structurally separate**, with scope/basis (direct
   combustion vs. well-to-tank vs. lifecycle) labeled — no competitor site
   makes this distinction visible to end users.
5. **Traceable source citations per number** (source_id, year, table/page,
   original unit) rendered in the UI itself, not just "trust us" — closest
   analog is EIA's per-figure hyperlinks, but even EIA doesn't show table/page
   references inline.
6. **Uncertainty/range surfaced, not hidden** — e.g. IPCC's default factors
   come with lower/upper 95%-CI bounds that every competitor site discards;
   we can show "default value (range: X–Y)" instead of false precision.
7. **Biogenic CO2 handled transparently** (reported separately, not silently
   zeroed) — DESNZ does this internally in its spreadsheets but no public
   converter site surfaces it to a casual user.
8. **Region+year electricity factors shown as explicitly context-bound
   examples**, not as if there's one universal "kWh → CO2" constant — a
   common and unaddressed failure mode across all reviewed competitors.

---

## 2. Source catalog

| source_id | Title | Publisher | URL | Pub. year | Retrieved_at | License / usability | Reliability |
|---|---|---|---|---|---|---|---|
| `nist-sp811` | NIST Special Publication 811: Guide for the Use of the International System of Units (SI) | National Institute of Standards and Technology (US Dept. of Commerce) | https://www.nist.gov/pml/special-publication-811 (DOI: 10.6028/NIST.SP.811e2008) | 2008 (2008 edition; not yet updated for 2019 SI redefinition, per NIST's own note) | 2026-07-04 | US federal government work → public domain, freely citable/reusable | Very high — the canonical US reference for SI usage and exact conversion factors (BTU, calorie, etc.) |
| `iea-unit-converter` | IEA Unit Converter (Data Tools) | International Energy Agency | https://www.iea.org/data-and-statistics/data-tools/unit-converter | tool "last updated 30 Dec 2023" | 2026-07-04 | CC BY 4.0 (the tool/page itself) — reusable with attribution. NOTE: distinct from IEA's paid data products (see §5) | Medium-high for definitions (toe etc.), but shows no per-factor sourcing itself |
| `iea-energy-statistics-manual` | Energy Statistics Manual | International Energy Agency / OECD | https://iea.blob.core.windows.net/assets/67fb0049-ec99-470d-8412-1ed9201e576f/EnergyStatisticsManual.pdf | 2004porient (manual, periodically referenced, no clear newer edition found) | 2026-07-04 | Free PDF; check IEA copyright notice before republishing tables verbatim | High — authoritative methodological reference for energy-balance unit conversions |
| `epa-ghg-hub-2025` | GHG Emission Factors Hub (2025 edition) | US EPA (Center for Corporate Climate Leadership) | https://www.epa.gov/climateleadership/ghg-emission-factors-hub ; PDF: https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf ; XLSX: https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx | 2025 (published Jan 2025; "last modified 15 January 2025") | 2026-07-04 | US federal government work → public domain, freely reusable | High — 435 factors, Scope 1/2/3, widely used for corporate GHG reporting; stationary-combustion factors ultimately trace to 40 CFR Part 98 / EPA's own GHG Inventory |
| `uk-desnz-ghg-2025` | 2025 Government GHG Conversion Factors for Company Reporting (Full Set, Condensed Set, Flat File, Methodology Paper) | UK Department for Energy Security and Net Zero (DESNZ) | https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025 ; full set xlsx: https://assets.publishing.service.gov.uk/media/6846a4f55e92539572806125/ghg-conversion-factors-2025-full-set.xlsx | 2025 (data year 2025, "next publication date June 2026") | 2026-07-04 | Open Government Licence v3.0 — explicit permission for commercial AND non-commercial reuse, adaptation, redistribution, with attribution ("Contains public sector information licensed under the Open Government Licence v3.0") | Very high — **our single most valuable fuel source**: per-fuel density, NCV/GCV, CO2/CH4/N2O split, and derived CO2e, all in one authoritative, actively maintained, licensing-friendly dataset |
| `ipcc-2006-v2` | 2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 2: Energy (Ch.1 Introduction, Ch.2 Stationary Combustion) | IPCC / IGES (Institute for Global Environmental Strategies) | https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf ; https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf | 2006 | 2026-07-04 | © IPCC 2006. Limited free reproduction of short excerpts/figures with full attribution (report name, publisher, page/figure numbers) is authorized without written permission; bulk/other reuse requires written permission from the IPCC Secretariat. We will cite values with full attribution, not bulk-republish full tables verbatim as a redistributable dataset. | Very high — the global Tier-1 default fallback for NCVs and emission factors when no better regional source exists |
| `eia-heat-contents` | Energy units and calculators explained / Energy conversion calculators / CO2 emission coefficients | US Energy Information Administration | https://www.eia.gov/energyexplained/units-and-calculators/ ; https://www.eia.gov/energyexplained/units-and-calculators/energy-conversion-calculators.php ; https://www.eia.gov/environment/emissions/co2_vol_mass.php | Heat-content data year varies by table (Monthly Energy Review, Appendix A, updated annually); CO2 coefficients "based on data from 2022," used for 2023+ estimates; page "Release Date: September 18, 2024" | 2026-07-04 | US federal government work → public domain | High — the standard US-specific cross-check for heat contents and CO2 coefficients |
| `h2tools` | Hydrogen Tools (H2tools.org) — Lower and Higher Heating Values of Hydrogen and Other Fuels; Basic Hydrogen Properties Chart | Pacific Northwest National Laboratory (PNNL) for US DOE Hydrogen Safety Panel / Hydrogen Tools | https://h2tools.org/hyarc/hydrogen-data/lower-and-higher-heating-values-hydrogen-and-other-fuels ; https://h2tools.org/basic-hydrogen-properties-chart | ongoing/maintained reference | 2026-07-04 (site blocks automated fetch with HTTP 403; values below are cross-verified via independent secondary sources that themselves cite DOE/NIST figures — see notes in §3/§4) | US DOE-funded public resource; treat as authoritative for hydrogen physical properties but re-verify exact figures via a manual browser visit before shipping if possible, since we could not directly fetch the page in this research pass | High (by reputation and cross-source consistency), but our own confidence is medium because we could not directly render the primary page — flagged for the Data agent to re-verify by direct page visit if feasible |
| `seai-conversion-factors` | SEAI Conversion & Emission Factors (Ireland) | Sustainable Energy Authority of Ireland (SEAI) | https://www.seai.ie/data-and-insights/seai-statistics/conversion-factors ; xlsx: https://www.seai.ie/data-and-insights/seai-statistics/conversion-factors/SEAI-conversion-and-emission-factors.xlsx | annual, 2001–present time series | 2026-07-04 | Irish public-sector data; check page for explicit license (not fully confirmed in this pass — treat as "verify before bulk reuse") | Medium-high — useful EU-country cross-check, not yet deeply mined in this research pass |
| `eea-electricity-intensity` | Greenhouse gas emission intensity of electricity generation in Europe | European Environment Agency (EEA) | https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1 | indicator updated with 2024 estimate (exact 2024 gCO2/kWh figure not extractable from the fetched page; 2023 figure obtained) | 2026-07-04 | EEA content is generally free to reuse with attribution (standard EU institution practice); not explicitly re-verified on this specific page in this pass | Medium — good EU-aggregate cross-check; figure precision is imperfect (see §4 gap note) |
| `engineering-toolbox` | The Engineering ToolBox (various fuel/heating-value pages) | Engineering ToolBox (private site) | https://www.engineeringtoolbox.com | ongoing | 2026-07-04 | Not a licensed dataset; **plausibility cross-check only per project rules, never a primary citation** | Low-medium as a primary source; fine for sanity-checking order of magnitude |
| `ucum` | Unified Code for Units of Measure (UCUM) | Regenstrief Institute | https://ucum.org | ongoing spec | 2026-07-04 | Open specification | N/A — relevant only as a unit-symbol/ontology reference for our `unit.id`/alias design, not a numeric-factor source |
| `qudt` | QUDT (Quantities, Units, Dimensions and Types) Ontology | QUDT.org | https://qudt.org | ongoing spec | 2026-07-04 | Open (mixed CC licenses per QUDT page) | N/A — relevant only as a unit ontology/vocabulary reference, not a numeric-factor source |
| `opec-asb` | OPEC Annual Statistical Bulletin (conversion factors / definitions sections) | OPEC | https://www.opec.org/assets/assetdb/asb-2025.pdf | 2025 (60th edition) | 2026-07-04 | Publicly downloadable PDF; specific boe methodology text not extracted in this pass (see gap note in §3) | Not fully verified in this pass — flagged as a gap |

---

## 3. Unit-definition constants (exact/standard values with citations)

All "exact" values below are exact by legal/standards definition (boldfaced in
NIST SP 811's own convention), not measured/rounded approximations.

| Constant | Value | Status | Source |
|---|---|---|---|
| BTU (International Table, Btu\_IT) | **1.055 055 852 62 kJ** exactly | exact (by 1956 definition) | `nist-sp811` |
| Calorie (International Table, cal\_IT) | **4.1868 J** exactly | exact — defined at the Fifth International Conference on the Properties of Steam, London, July 1956 | `nist-sp811` |
| Calorie (thermochemical, cal\_th) | **4.184 J** exactly | exact by definition | `nist-sp811` |
| "kcal" as commonly used (food Calorie) | Conventionally the **International Table kcal (4.1868 kJ)** is used in most engineering/energy contexts; nutrition labeling commonly rounds using ~4.184 kJ/kcal (thermochemical) in some regional conventions | **convention-dependent — document both, do not silently pick one**. Spec §9.5 explicitly flags avoiding false precision here. | `nist-sp811` (for both calorie definitions) |
| Therm (US) | **100,000 Btu** | standard/US definition | `eia-heat-contents` (EIA FAQ on Ccf/Mcf/Btu/therms) |
| Therm (EC / UK gas billing) | UK/EC therm ≈ 105,505.585 J via Btu\_IT chain (i.e., 1 therm = 100,000 Btu\_IT); **NOTE: UK domestic gas billing today uses metric kWh, not therms, but the therm-to-kWh factor derives from this Btu\_IT chain.** DESNZ's own "Conversions" tab gives **1 therm = 0.105506 GJ = 29.30711 kWh** (derived, consistent with the Btu\_IT chain) | standard definition; cross-checked, internally consistent | `uk-desnz-ghg-2025` (Conversions tab), `nist-sp811` |
| Quad | **10¹⁵ Btu** (one quadrillion Btu) | standard/US definition | `eia-heat-contents` |
| toe (tonne of oil equivalent) | **41.868 GJ** (= 10 Gcal using the International Table calorie: 41.868 GJ = 10,000 × 4.1868 MJ) | standard IEA/OECD definition, fixed constant (not tied to actual crude oil's real energy content, which varies by grade) | `iea-unit-converter`, cross-checked against `nist-sp811`'s cal\_IT | 
| toe → kWh | **1 toe = 11,629.9998... kWh** (≡ 41.868 GJ ÷ 0.0036 GJ/kWh) | derived exact from the toe definition | `uk-desnz-ghg-2025` (Conversions tab: "Tonne oil equivalent, toe → kWh = 11629.999835793706") |
| ktoe, Mtoe | 1,000 toe and 1,000,000 toe respectively — simple SI prefixing of the toe base unit | standard | derived from `iea-unit-converter` definition |
| boe (barrel of oil equivalent) | **NOT a single universal number — convention-dependent.** Most commonly cited: **1 boe ≈ 5.8 MMBtu** (≈ 6.119 GJ), used by EIA/IEA/SPE convention. USGS uses natural-gas-to-boe ratio of **6,000 scf gas = 1 boe**, vs. the "5.8 MMBtu" convention implying roughly 5,800 scf gas ≈ 1 boe (since typical US natural gas ≈ 1,000–1,036 Btu/scf). **We must document both the 5.8 MMBtu convention and note the 6,000 scf/boe alternative rather than picking one silently**, per spec §12 instruction on divergent sources. | convention-dependent, NOT a physical constant | multiple secondary sources (Wikipedia/industry glossaries) converging on 5.8 MMBtu and separately on 6,000 scf/1 boe (USGS); **OPEC's own exact convention not confirmed in this pass — gap, see §6** |
| tce (tonne of coal equivalent) | **29.3076 GJ** (= 7,000 kcal\_IT ×1000 kg; 7 Gcal per tonne) | standard IEA-style definition, analogous fixed-constant treatment to toe | secondary source convergence (not independently fetched from an IEA primary page in this pass — recommend Data agent spot-check against an IEA glossary page directly) |
| Barrel (petroleum, US) | **42 US gallons exactly = 158.987 289 125 22 L** | exact by definition (US gal is exact; barrel = 42× that) | `uk-desnz-ghg-2025` (Conversions tab: "Barrel (US, petroleum), bbl → 158.98728912522174 L") |
| US gallon | **3.785 411 803 461 373 L** exactly (231 in³ exactly, by US definition) | exact | `uk-desnz-ghg-2025` (Conversions tab) |
| Imperial (UK) gallon | **4.546 090 006 181 227 5 L** exactly (4.54609 L is the UK legal exact definition) | exact | `uk-desnz-ghg-2025` (Conversions tab) |
| lb (avoirdupois pound) | **0.453 592 152 289 682 36 kg** | exact by international 1959 agreement (0.45359237 kg is the internationally agreed exact value; DESNZ's sheet shows a very close derived figure to high precision) | `uk-desnz-ghg-2025` (Conversions tab); cross-check against `nist-sp811` recommended by Data agent for the canonical 0.453 592 37 kg figure |
| Short ton (US) | **907.184 995 885 916 1 kg** (= 2000 lb) | exact, derived from lb definition | `uk-desnz-ghg-2025` (Conversions tab) |
| Long ton (UK) | **1016.046 421 128 888 6 kg** (= 2240 lb) | exact, derived from lb definition | `uk-desnz-ghg-2025` (Conversions tab) |
| ft³ (cubic foot) | **28.316 846 368 677 353 L = 0.028316846368677356 m³** | exact, derived from the exact inch/foot definition | `uk-desnz-ghg-2025` (Conversions tab) |

---

## 4. Fuel values catalog

**Convention used below:** every row states source_id, year, and basis (NCV/LHV
vs GCV/HHV) explicitly. Where UK DESNZ 2025 and IPCC 2006 both give a figure,
**both are recorded, not averaged**, per spec §12/§18. Region applicability is
noted per row. All DESNZ figures below come directly from the downloaded
`ghg-conversion-factors-2025-full-set.xlsx`, sheets **"Fuels"**, **"Bioenergy"**,
**"Fuel properties"**, and **"UK electricity"** (fetched and parsed in this
session).

### 4.1 Crude oil (generic)

- Density: **NOT directly stated in DESNZ fuel-properties sheet** (DESNZ has no
  generic "crude oil" row — it covers refined products, not crude). Typical
  generic literature density range ~800–950 kg/m³ depending on grade (light vs.
  heavy) — this is a plausibility-only figure, not sourced to a serious primary
  source in this pass; **mark "generic crude oil density: NOT FOUND in a
  serious primary source — use IPCC's fixed NCV, avoid inventing a density.**
- NCV (IPCC 2006, global default, region: global): **42.3 TJ/Gg = 42.3 GJ/tonne**
  (95% CI: 40.1–44.8), source `ipcc-2006-v2` Table 1.2.
- CO2 emission factor (IPCC 2006, NCV basis, global default): **73,300 kg
  CO2/TJ** (range 71,100–75,500), source `ipcc-2006-v2` Table 2.2.
- **No DESNZ entry for "crude oil" as such** (DESNZ's fuel list is downstream/
  refined-product oriented) — flagged.

### 4.2 Gasoline / petrol (motor gasoline)

- UK DESNZ 2025, region UK, basis both NCV and GCV given:
  - **Petrol (average biofuel blend)**: density 746.204 kg/m³ (1340.116 L/tonne),
    NCV 43.061 GJ/tonne (11.961 kWh/kg, 8.926 kWh/L, Net CV), GCV 45.46 GJ/tonne
    (12.628 kWh/kg, 9.423 kWh/L, Gross CV). CO2e: **2.05523 kg CO2e/L** (of which
    CO2 = 2.05523's constituent 2.05... — precisely: kg CO2e of CO2 = 2.05523? —
    see exact split below), CH4 = 0.00806 kg CO2e/L, N2O = 0.00587 kg CO2e/L,
    total kgCO2e/L = **2.06916**. Per kWh (Net CV): total 0.23181 kgCO2e/kWh (CO2
    component 0.23026, CH4 0.0009, N2O 0.00065). Source: `uk-desnz-ghg-2025`,
    "Fuels" sheet, "Petrol (average biofuel blend)" row, and "Fuel properties"
    sheet.
  - **Petrol (100% mineral petrol)**: density 741.84 kg/m³ (1348 L/tonne), NCV
    44.65 GJ/tonne (12.403 kWh/kg, 9.201 kWh/L, Net CV), GCV 47.0 GJ/tonne
    (13.056 kWh/kg, 9.685 kWh/L, Gross CV). CO2e per litre = **2.33984
    kgCO2e/L** (CO2 = 2.32567, CH4 = 0.0082, N2O = 0.00597). Source: same sheet.
- IPCC 2006 (global default, Motor Gasoline, NCV basis): NCV **44.3 TJ/Gg**
  (range 42.5–44.8), CO2 factor **69,300 kg CO2/TJ** (range 67,500–73,000).
  Source: `ipcc-2006-v2` Tables 1.2 & 2.2.
- EIA (US, 2022-vintage data used for 2023+ estimates): heat content **120,214
  Btu/gallon** (source: `eia-heat-contents`); CO2 coefficient **9.46 kg
  CO2/gallon** (= 76.11 kg CO2/MMBtu). Source: `eia-heat-contents`
  (co2_vol_mass page).
- **Never average these** — DESNZ (UK, 2025, biofuel-blend-adjusted, splits
  CO2/CH4/N2O and gives CO2e) and EIA (US, 2022 data, CO2-only, mineral-only
  fuel) differ by design, not by error.

### 4.3 Diesel (road diesel / gas oil / DERV)

- UK DESNZ 2025:
  - **Diesel (average biofuel blend)**: density 832.361 kg/m³ (1201.402
    L/tonne), NCV 42.839 GJ/tonne (11.9 kWh/kg, 9.905 kWh/L, Net CV), GCV
    45.545 GJ/tonne (12.651 kWh/kg, 10.531 kWh/L, Gross CV). CO2e:
    **2.57082 kg CO2e/L** total (CO2 = 2.53763, CH4 = 0.00029, N2O = 0.0329).
    Per kWh (Net CV) total = 0.25953 kgCO2e/kWh.
  - **Diesel (100% mineral diesel)**: density 830.565 kg/m³ (1204 L/tonne),
    NCV 43.027 GJ/tonne (11.952 kWh/kg, 9.927 kWh/L, Net CV), GCV 45.774
    GJ/tonne (12.715 kWh/kg, 10.561 kWh/L, Gross CV). CO2e: **2.66155 kg
    CO2e/L** (CO2 = 2.62818, CH4 = 0.00029, N2O = 0.03308).
  - Also listed separately: **"Gas oil"** (UK terminology for non-road/red
    diesel, chemically similar): density 853.971 kg/m³ (1171 L/tonne), NCV
    42.569 GJ/tonne, GCV 45.286 GJ/tonne, CO2e/L total = **2.75541**
    (CO2 = 2.72417, CH4 = 0.00315, N2O = 0.02809).
  - Source for all above: `uk-desnz-ghg-2025`, "Fuels" and "Fuel properties"
    sheets.
- IPCC 2006 (global default, "Gas/Diesel Oil", NCV basis): NCV **43.0 TJ/Gg**
  (range 41.4–43.3), CO2 factor **74,100 kg CO2/TJ** (range 72,600–74,800).
  Source: `ipcc-2006-v2`.
- EIA (US, distillate fuel oil/diesel): CO2 coefficient **10.19 kg
  CO2/gallon** (= 74.14 kg CO2/MMBtu, 2022-vintage). Heat content
  **137,381 Btu/gallon**. Source: `eia-heat-contents`.

### 4.4 Heating oil (light fuel oil)

- UK DESNZ 2025 does not have a specific "heating oil" label distinct from
  "Gas Oil" / "Fuel Oil" — UK domestic heating oil is typically "Gas Oil" (see
  §4.3) or "Burning Oil" (kerosene-type, see §4.5) depending on system.
  **"Fuel Oil"** (heavier, e.g. for larger boilers/industrial): density
  983.284 kg/m³ (1017 L/tonne), NCV 40.752 GJ/tonne (11.32 kWh/kg, 11.131
  kWh/L, Net CV), GCV 43.353 GJ/tonne (12.042 kWh/kg, 11.841 kWh/L, Gross CV).
  CO2e/L total = **3.17492** (CO2 = 3.16262, CH4 = 0.0053, N2O = 0.00701).
  Source: `uk-desnz-ghg-2025`.
- EIA (US, "No. 2 heating oil" is essentially the same product as diesel
  distillate): **138,500 Btu/gallon** heat content per EIA's units page.
  Source: `eia-heat-contents`.
- IPCC: no separate "heating oil" line; use "Gas/Diesel Oil" (§4.3) or
  "Residual Fuel Oil" (NCV 40.4 TJ/Gg, CO2 factor 77,400 kg/TJ, range
  75,500–78,800) depending on grade — **note both, let the Domain/Data agent
  choose the mapping**.

### 4.5 Kerosene / jet fuel

- UK DESNZ 2025:
  - **Burning Oil** (UK heating kerosene): density 802.568 kg/m³ (1246
    L/tonne), NCV 43.865 GJ/tonne (12.185 kWh/kg, 9.779 kWh/L, Net CV), GCV
    46.174 GJ/tonne (12.826 kWh/kg, 10.294 kWh/L, Gross CV). CO2e/L total =
    **2.54016** (CO2 = 2.52782, CH4 = 0.00674, N2O = 0.00559).
  - **Aviation Turbine Fuel** (jet fuel/Jet A-1): density 800 kg/m³ (1250
    L/tonne), NCV 43.905 GJ/tonne (12.196 kWh/kg, 9.757 kWh/L, Net CV), GCV
    46.215 GJ/tonne (12.838 kWh/kg, 10.27 kWh/L, Gross CV). CO2e/L total =
    **2.54269** (CO2 = 2.51973, CH4 = 0.00176, N2O = 0.0212). **NOTE: DESNZ
    explicitly states a 1.7× multiplier should be applied to the CO2 component
    only when accounting for radiative-forcing effects of high-altitude
    aviation emissions — a genuinely important, easy-to-miss caveat.**
  - **Aviation Spirit** (avgas, piston aircraft): density 729.927 kg/m³ (1370
    L/tonne), NCV 44.797 GJ/tonne, GCV 47.155 GJ/tonne. CO2e/L = **2.33116**.
  - Source for all: `uk-desnz-ghg-2025`.
- IPCC 2006 (global default, "Jet Kerosene", NCV basis): NCV **44.1 TJ/Gg**
  (range 42.0–45.0), CO2 factor **71,500 kg CO2/TJ** (range 69,700–74,400).
  "Other Kerosene": NCV 43.8 TJ/Gg, CO2 factor 71,900 kg/TJ. Source:
  `ipcc-2006-v2`.

### 4.6 LPG / propane / butane

- UK DESNZ 2025:
  - **LPG** (mixed): density 529.749 kg/m³ (1887.685 L/tonne), NCV 45.944
    GJ/tonne (12.762 kWh/kg, 6.761 kWh/L, Net CV), GCV 49.333 GJ/tonne (13.704
    kWh/kg, 7.259 kWh/L, Gross CV). CO2e/L total = **1.55713** (CO2 = 1.55491,
    CH4 = 0.00136, N2O = 0.00086).
  - **Propane**: density 514.933 kg/m³ (1942 L/tonne), NCV 46.4 GJ/tonne
    (12.889 kWh/kg, 6.637 kWh/L, Net CV), GCV 50.4 GJ/tonne (14 kWh/kg, 7.209
    kWh/L, Gross CV). CO2e/L total = **1.54358** (CO2 = 1.5414, CH4 = 0.00133,
    N2O = 0.00084).
  - **Butane**: density 575.374 kg/m³ (1738 L/tonne), NCV 45.3 GJ/tonne (12.583
    kWh/kg, 7.24 kWh/L, Net CV), GCV 49.1 GJ/tonne (13.639 kWh/kg, 7.847 kWh/L,
    Gross CV). CO2e/L total = **1.74533** (CO2 = 1.74296, CH4 = 0.00144, N2O =
    0.00092).
  - Source for all: `uk-desnz-ghg-2025`.
- IPCC 2006 (global default, "Liquefied Petroleum Gases", NCV basis): NCV
  **47.3 TJ/Gg** (range 44.8–52.2), CO2 factor **63,100 kg CO2/TJ** (range
  61,600–65,600). "Ethane" separately: NCV 46.4 TJ/Gg, CO2 factor 61,600 kg/TJ.
  Source: `ipcc-2006-v2`.
- EIA (US): propane CO2 coefficient **5.75 kg CO2/gallon** (62.88 kg
  CO2/MMBtu, 2022-vintage). Heat content **91,452 Btu/gallon**. Source:
  `eia-heat-contents`.

### 4.7 Natural gas / methane / CNG / LNG

- UK DESNZ 2025:
  - **Natural gas** (UK grid mix, small biogas content): density
    0.802 kg/m³ (gas phase; "1,246,142.986 litres/tonne" i.e. inverse specific
    volume), NCV 45.745 GJ/tonne (12.707 kWh/kg, 0.01 kWh/L [i.e. per litre of
    gas at that density], Net CV), GCV 50.678 GJ/tonne (14.077 kWh/kg, 0.011
    kWh/L, Gross CV). Per **cubic metre**: CO2e = **2.06672 kg CO2e/m³** (CO2 =
    2.0627, CH4 = 0.00307, N2O = 0.00095). Per **kWh (Gross CV, i.e. the
    typical UK gas-bill basis)**: total **0.18296 kgCO2e/kWh** (CO2 = 0.18259,
    CH4 = 0.00028, N2O = 9e-05); per kWh (Net CV): total 0.2027 kgCO2e/kWh.
  - **Natural gas (100% mineral blend)**: density identical structure; per m³
    CO2e = **2.08906** total; per kWh (Gross CV) = 0.18494 kgCO2e/kWh.
  - **CNG**: density 175 kg/m³ (compressed), NCV 45.745 GJ/tonne (same
    molecular basis as natural gas), per litre CO2e = **0.4507** total
    (as liquid-equivalent litres of the compressed product — same energy
    content per kg as natural gas), per kWh (Gross CV) = 0.18296 kgCO2e/kWh.
  - **LNG**: density 452.489 kg/m³ (liquefied), NCV 45.745 GJ/tonne (same
    chemical basis as natural gas, since LNG *is* natural gas), per litre
    CO2e = **1.17797** total, per kWh (Gross CV) = 0.18494 kgCO2e/kWh.
  - Source for all: `uk-desnz-ghg-2025`, "Fuels" and "Fuel properties" sheets.
  - Pure **Methane (CH4)** listed separately in "Fuel properties": density
    0.716 kg/m³, NCV 50 GJ/tonne (13.889 kWh/kg, Net CV), GCV 55.406 GJ/tonne
    (15.391 kWh/kg, Gross CV). No CO2e figure given for pure methane
    (combustion factor) in this sheet — it's a properties reference row only.
- IPCC 2006 (global default, "Natural Gas", NCV basis): NCV **48.0 TJ/Gg**
  (range 46.5–50.4), CO2 factor **56,100 kg CO2/TJ** (no explicit
  range given in the extracted table row — appears as a single default in our
  fetch; Data agent should re-verify against the full table if the range
  matters). Source: `ipcc-2006-v2`.
- EIA (US): CO2 coefficient **54.81 kg CO2/thousand cubic feet** (52.91 kg
  CO2/MMBtu, 2022-vintage). Heat content **1,036 Btu/cubic foot**. Source:
  `eia-heat-contents`.
- **Reference-condition caveat (important, per spec §9.3):** none of the three
  sources above states the natural-gas reference temperature/pressure (e.g.
  15°C vs 0°C, standard vs normal cubic metre) explicitly in the fetched
  excerpts. This must be flagged as a warning in the UI whenever m³-natural-gas
  conversions are shown — **do not imply false precision on the m³→kWh step.**

### 4.8 Hydrogen

- Physical properties (cross-source-verified, not from a single directly
  fetched primary table since h2tools.org blocked automated fetch with HTTP
  403 in this session):
  - LHV: **119.96 MJ/kg ≈ 33.3 kWh/kg** (also cited as 119.93 kJ/g in one
    secondary source — treat 119.96 MJ/kg / 33.3 kWh/kg as the standard
    rounded reference value)
  - HHV: **141.88 MJ/kg ≈ 39.4 kWh/kg** (also cited as 141.86 kJ/g)
  - Gas density at NTP/STP (0°C, 1 atm): **0.08988 kg/m³**
  - Liquid hydrogen density at boiling point (−252.87 °C): **70.8 kg/m³**
  - Source: `h2tools` (site itself), cross-checked via multiple independent
    secondary sources citing DOE/NIST-derived figures, and via an NREL
    conference paper reference found in search (`docs.nrel.gov/docs/fy10osti/47302.pdf`,
    domain unreachable in this session's network sandbox — **flagged for the
    Data agent to re-fetch directly if possible**, since we could not load the
    primary DOE/NREL PDF ourselves).
- UK DESNZ 2025: **no hydrogen row found** in the "Fuels", "Bioenergy", or
  "Fuel properties" sheets we inspected — **NOT FOUND in DESNZ 2025** (may
  appear in other DESNZ tabs not inspected, e.g. under a different label; Data
  agent should grep the full workbook for "hydrogen").
- IPCC 2006: hydrogen is not listed as a distinct fuel type in Table 1.2/2.2
  (its scope is fossil/biomass/waste stationary combustion) — **NOT FOUND**.
- CO2 factor for hydrogen direct combustion: **0 kg CO2 per unit energy from
  combustion itself** (hydrogen contains no carbon) — this is a chemistry fact,
  not something requiring a numeric citation, but per spec §13.4 the UI must
  explain clearly that **upstream/production-related emissions are NOT
  automatically zero** (grey/blue/green hydrogen have very different
  well-to-tank footprints) — this is a narrative/warning requirement, not a
  numeric one, and no upstream hydrogen emission factor is included in this
  catalog (out of scope for V0.1 per spec, but must not be silently implied
  as zero).

### 4.9 Hard coal / lignite / anthracite

- UK DESNZ 2025 (three coal categories, all NCV/GCV given but **no density/
  volume conversion given for coal** — solid fuel sold by mass only):
  - **Coal (industrial)**: NCV 25.405 GJ/tonne (7.057 kWh/kg, Net CV), GCV
    26.742 GJ/tonne (7.428 kWh/kg, Gross CV). CO2e per tonne = **2395.28994**
    total (CO2 = 2370.72, CH4 = 7.6384, N2O = 16.93154); per kWh (Net CV) =
    0.33944 kgCO2e/kWh.
  - **Coal (domestic)**: NCV 28.613 GJ/tonne (7.948 kWh/kg), GCV 30.119
    GJ/tonne (8.366 kWh/kg). CO2e/tonne = **2904.95234** total (CO2 = 2632, CH4
    = 240.352 [much higher than industrial — reflects less efficient domestic
    combustion], N2O = 32.60034); per kWh (Net CV) = 0.36549 kgCO2e/kWh.
  - **Coking Coal**: NCV 30.24 GJ/tonne (8.4 kWh/kg), GCV 31.832 GJ/tonne
    (8.842 kWh/kg). CO2e/tonne = **3164.65002** total.
  - **Coal (electricity generation)**: NCV 23.826 GJ/tonne (6.618 kWh/kg), GCV
    25.08 GJ/tonne. CO2e/tonne = **2225.22448** total.
  - Source: `uk-desnz-ghg-2025`.
  - **DESNZ does not use the terms "lignite" or "anthracite" explicitly** in
    the sheets inspected — its categories are functional (industrial/
    domestic/electricity-generation/coking), not rank-based. This is a real
    mapping gap the Domain/Data agent must resolve explicitly (e.g. map
    "anthracite" and "lignite" queries to IPCC's rank-based factors instead).
- IPCC 2006 (global default, rank-based, NCV basis):
  - **Anthracite**: NCV 26.7 TJ/Gg (range 21.6–32.2), CO2 factor **98,300 kg
    CO2/TJ** (range 94,600–101,000).
  - **Coking Coal**: NCV 28.2 TJ/Gg (range 24.0–31.0), CO2 factor 94,600 kg/TJ
    (same numeric factor row as "Other Bituminous Coal" in the fetched table).
  - **Other Bituminous Coal**: NCV 25.8 TJ/Gg (range 19.9–30.5), CO2 factor
    **94,600 kg CO2/TJ** (range 89,500–99,700).
  - **Sub-Bituminous Coal**: NCV 18.9 TJ/Gg (range 11.5–26.0), CO2 factor
    **96,100 kg CO2/TJ** (range 92,800–100,000).
  - **Lignite**: NCV **11.9 TJ/Gg** (range 5.50–21.6 — very wide range,
    reflecting lignite's highly variable moisture/ash content), CO2 factor
    **101,000 kg CO2/TJ** (range 90,900–115,000).
  - Source: `ipcc-2006-v2` Tables 1.2 & 2.2.
- **Recommendation**: use IPCC 2006 as the primary source for
  anthracite/lignite specifically (rank-based, global), and DESNZ for generic
  "hard coal" used in the UK domestic/industrial/generation context, with the
  distinction clearly labeled in the data file's `region` and `notes` fields.

### 4.10 Wood (log), wood pellets, wood chips

- UK DESNZ 2025 ("Bioenergy" sheet — **CO2 reported as net "0" for Scope 1
  since biogenic carbon is treated as absorbed during growth; the true CO2
  from combustion is instead published separately as an "outside of scopes"
  factor** — this is exactly the biogenic-CO2 handling called for in spec
  §9.6/§12):
  - **Wood logs**: CO2e (Scope 1, i.e. CH4+N2O only, CO2 = 0) = **46.98508
    kg CO2e/tonne**, or 0.0115 kg CO2e/kWh.
  - **Wood chips**: 43.43964 kg CO2e/tonne, 0.0115 kg CO2e/kWh.
  - **Wood pellets**: 55.19389 kg CO2e/tonne, 0.0115 kg CO2e/kWh.
  - Source: `uk-desnz-ghg-2025`, "Bioenergy" sheet.
  - Physical properties ("Fuel properties" sheet, "Other fuels" section):
    - **Wood Chips**: NCV 13.6 GJ/tonne (3.778 kWh/kg, Net CV), GCV 14.713
      GJ/tonne (4.087 kWh/kg, Gross CV), density 253 kg/m³ (3952.569 L/tonne).
    - **Wood Logs**: NCV 14.71 GJ/tonne (4.086 kWh/kg), GCV 16.256 GJ/tonne
      (4.516 kWh/kg), density 425 kg/m³ (2352.941 L/tonne).
    - **Wood Pellets**: NCV 17.28 GJ/tonne (4.8 kWh/kg), GCV 18.694 GJ/tonne
      (5.193 kWh/kg), density 650 kg/m³ (1538.462 L/tonne).
  - Source: `uk-desnz-ghg-2025`, "Fuel properties" sheet.
- IPCC 2006 (global default, "Wood/Wood Waste", NCV basis): NCV **15.6 TJ/Gg**
  (range 7.90–31.0 — an unusually wide range reflecting real-world moisture
  content variability), CO2 factor **112,000 kg CO2/TJ** (range 95,000–
  132,000; note this is the *combustion* CO2 factor before any biogenic
  accounting is applied). Source: `ipcc-2006-v2`.
- **These two sources are not directly comparable numerically**: DESNZ already
  nets out biogenic CO2 (reports it separately as "outside of scopes"), IPCC's
  Table 2.2 gives the raw combustion CO2 factor without that accounting layer
  applied. **Document this difference explicitly in the data model notes field
  — do not present them side-by-side without this caveat.**

### 4.11 Ethanol / biodiesel / biogas

- UK DESNZ 2025 (Bioenergy sheet, Scope 1, CO2 = 0 net per the biogenic
  convention described in §4.10):
  - **Bioethanol**: 0.00901 kg CO2e/litre (Scope 1, N2O+CH4 only), 0.42339 kg
    CO2e/GJ, 0.01135 kg CO2e/kg.
  - **Biodiesel ME**: 0.16751 kg CO2e/litre, 5.05961 kg CO2e/GJ, 0.18822 kg
    CO2e/kg. (Also listed identically for "from used cooking oil" and "from
    tallow" variants.)
  - **Biodiesel (BtL or HVO)**: 0.03558 kg CO2e/litre.
  - **Biopropane**: 0.00213 kg CO2e/litre.
  - **Biogas**: 1.24314 kg CO2e/tonne, 0.00022 kg CO2e/kWh.
  - **Landfill gas**: 0.69696 kg CO2e/tonne, 0.0002 kg CO2e/kWh.
  - Source: `uk-desnz-ghg-2025`, "Bioenergy" sheet.
  - Physical properties ("Fuel properties" sheet, "Other fuels" section):
    - **Biodiesel (ME)**: NCV 37.2 GJ/tonne (10.333 kWh/kg, Net CV), GCV 38.7
      GJ/tonne (10.75 kWh/kg, Gross CV), density 890 kg/m³ (1123.596 L/tonne).
    - **Biodiesel (BtL or HVO)**: NCV 44 GJ/tonne (12.222 kWh/kg), GCV 45.833
      GJ/tonne (12.731 kWh/kg), density 780 kg/m³ (1282.051 L/tonne).
    - **Bioethanol**: NCV 26.8 GJ/tonne (7.444 kWh/kg), GCV 29.7 GJ/tonne
      (8.25 kWh/kg), density 794 kg/m³ (1259.446 L/tonne).
    - **Biogas**: NCV 20 GJ/tonne (5.556 kWh/kg), GCV 21.978 GJ/tonne (6.105
      kWh/kg), density 1.15 kg/m³ (gas phase).
    - **Biomethane**: NCV 49 GJ/tonne (13.611 kWh/kg), GCV 54.298 GJ/tonne
      (15.083 kWh/kg), density 0.725 kg/m³ (gas phase).
    - **Landfill Gas**: NCV 12.3 GJ/tonne (3.417 kWh/kg), GCV 13.516 GJ/tonne
      (3.755 kWh/kg), density 1.3 kg/m³ (gas phase).
  - Source: `uk-desnz-ghg-2025`, "Fuel properties" sheet.
- IPCC 2006 (global default, NCV basis):
  - **Biogasoline** (ethanol-type, IPCC's category label): NCV 27.0 TJ/Gg
    (range 13.6–54.0 — very wide, "ethanol theoretical number" per the table's
    own footnote, expert-judgement uncertainty), CO2 factor **70,800 kg
    CO2/TJ** (range 59,800–84,300).
  - **Biodiesels**: NCV 27.0 TJ/Gg (same wide range/footnote as biogasoline),
    CO2 factor **70,800 kg CO2/TJ** (range 59,800–84,300).
  - **Other Biogas**: NCV 50.4 TJ/Gg (range 25.4–100 — "methane theoretical
    number," expert judgement), CO2 factor **54,600 kg CO2/TJ** (range
    46,200–66,000).
  - **Landfill Gas**: NCV 50.4 TJ/Gg (same figure as "Other Biogas" in our
    fetched table), CO2 factor 54,600 kg CO2/TJ.
  - Source: `ipcc-2006-v2` Tables 1.2 & 2.2.
- **Biogenic CO2 handling — critical modeling note (spec §9.6, §12):** IPCC's
  Table 2.2 CO2 factors for biofuels are the *raw combustion* factors (before
  biogenic accounting); DESNZ nets biogenic CO2 to zero in its Scope 1
  columns and instead reports the full combustion CO2 separately under its
  "Outside of scopes" tab (not yet extracted in this pass — **flagged as a
  follow-up for the Data agent**: fetch the "Outside of scopes" sheet from the
  same workbook to get DESNZ's own explicit biogenic-CO2 figures per biofuel).

### 4.12 Fuels flagged NOT FOUND in this research pass (do not invent)

- **Crude oil density** (generic, serious-source-backed): NOT FOUND.
- **Methane pure-substance CO2e combustion factor** (DESNZ "Fuel properties"
  sheet lists methane's physical properties but not a combustion CO2e
  factor as a distinct row from "Natural Gas"): treat methane ≈ natural gas
  numerically per DESNZ, but flag this as an approximation, not an identity.
  IPCC has no separate "methane" row either — natural gas is the closest
  analog.
- **Anthracite / lignite mapped to DESNZ's UK-specific coal categories**: NOT
  reconcilable without additional lookup — use IPCC 2006 (§4.9) as primary for
  these two specifically.
- **Hydrogen in DESNZ 2025**: NOT FOUND in the sheets inspected (Fuels,
  Bioenergy, Fuel properties, UK electricity) — may exist elsewhere in the
  workbook (e.g. a "Hydrogen" or "Alternative fuels" tab not in the sheet list
  we captured — recheck the full sheet list in §6 gap notes).
- **OPEC's own exact boe convention**: NOT independently confirmed from a
  primary OPEC page in this pass (only secondary-source convergence obtained).
- **DESNZ "Outside of scopes" biogenic CO2 figures**: not yet extracted (sheet
  exists in the workbook per the sheet-name listing but wasn't parsed in this
  pass).

### 4.13 Illustrative electricity grid-intensity examples (region+year specific — NOT universal constants)

- **UK, 2025** (DESNZ, "UK electricity" sheet, Scope 2, location-based,
  generation only — **excludes transmission & distribution losses**, which
  DESNZ publishes as a separate "Transmission and distribution" factor to be
  added for a full consumption-basis figure): **0.177 kg CO2e/kWh** (CO2 =
  0.17489, CH4 = 0.0009, N2O = 0.00122). DESNZ explicitly notes this is a ~15%
  decrease from 2024 due to reduced gas-fired generation and increased
  renewables/imports. Source: `uk-desnz-ghg-2025`.
- **EU-27, 2023** (European Environment Agency): **242 gCO2/kWh** average
  emissions intensity of electricity generation across the EU (down from 292
  gCO2/kWh in 2022, a 17% drop). The exact 2024 figure was described by the EEA
  as "~9% lower than 2023" but the precise 2024 gCO2/kWh number could not be
  extracted from the fetched page in this pass — **flagged as a gap; the 2023
  figure of 242 gCO2/kWh should be used with an explicit "2023, not yet
  updated to 2024" caveat, or the Data agent should re-fetch the EEA indicator
  page for the exact 2024 number.** Source: `eea-electricity-intensity`.
- **US, national average** (EPA eGRID, from the EPA GHG Emission Factors Hub
  2025 PDF, Table 6, "US Average" row): the Hub's Table 6 lists per-eGRID-
  subregion CO2/CH4/N2O factors in lb/MWh and kg/MWh with an aggregate "U.S.
  Average" row at the bottom — the exact digits were visible in the rendered
  table image but at low resolution; **the Data agent should re-extract Table
  6 of `epa-ghg-hub-2025` at higher fidelity (parse the companion XLSX instead
  of the PDF) to get exact US-average total-output and non-baseload emission
  rates in kg CO2/MWh.** A commonly-cited secondary figure (not independently
  verified to the primary eGRID2023 Rev.2 table in this pass) is **~370
  gCO2/kWh** for 2023 US national average — treat as provisional pending
  direct XLSX extraction.
- **All three figures above must be labeled with region AND year in the UI,
  never presented as "the" electricity emissions factor** (this is a direct,
  explicit requirement of spec §9.6/§13.4).

---

## 5. License & usage summary

| Source | Can we quote/reuse numbers with attribution? | Notes |
|---|---|---|
| NIST SP 811 | **Yes, freely.** | US federal government work = public domain. |
| EPA GHG Emission Factors Hub | **Yes, freely.** | US federal government work = public domain. |
| EIA (energyexplained, calculators, CO2 coefficients) | **Yes, freely.** | US federal government work = public domain. |
| UK DESNZ GHG Conversion Factors 2025 | **Yes, with attribution.** | Open Government Licence v3.0 — permits commercial AND non-commercial copying, publishing, distribution, and adaptation. Must acknowledge the source (standard OGL attribution line, ideally with a link to the licence) and, where practical, link to the specific gov.uk publication page. This is our best-license, best-detail source — safe to build the core fuel dataset on. |
| IPCC 2006 Guidelines | **Cite with full attribution for excerpts/individual values; do not bulk-republish full tables as a redistributable dataset without written permission.** | © IPCC 2006. Free reuse of short excerpts/individual figures with full citation (report name, publisher = IGES for the IPCC, page/table number) is explicitly authorized. Treat our usage as "citing specific default factors with citation," which fits within the permitted free-use case; avoid mechanically re-publishing entire multi-page tables verbatim as a bulk redistributable data file — extract only the specific fuel rows we need, each with its own citation. |
| IEA Unit Converter (tool/page) | **Yes, with attribution (CC BY 4.0).** | Applies to the *tool and its documentation*, not to IEA's paid data products. |
| IEA World Energy Balances / World Energy Statistics (the actual detailed multi-country dataset) | **No — paywalled/restricted for most content.** | Free extract covers only OECD/IEA Association countries' most-requested flows; full multi-country dataset requires a paid licence with per-seat/enterprise tiers and explicit restrictions on redistribution/derived products. **Do not use IEA's paid statistical data as a numeric source for our public site; use only the free Unit Converter tool, glossary, and publicly posted methodology PDFs (Energy Statistics Manual, Key World Energy Statistics methodology).** |
| SEAI (Ireland) | Likely reusable (Irish public-sector data) but **license not explicitly confirmed in this pass** — verify the exact SEAI terms page before treating figures as freely republishable. | Flagged as a to-do. |
| EEA (European Environment Agency) | Generally reusable EU-institution content with attribution, per standard EU open-data practice — **not explicitly re-confirmed on this specific page in this pass.** | Verify before bulk reuse. |
| H2Tools / PNNL | US DOE-funded public resource — treat as citable with attribution; could not confirm an explicit license statement in this pass (site blocked automated fetch). | Re-verify via manual browser visit if a formal license statement is needed. |
| Engineering ToolBox | **Do not cite as a primary numeric source at all** — commercial site, terms unclear, and per project rules (spec §6.1/§12) it is plausibility-check-only. | Never appears in `source_refs` for actual data values. |
| unitconverters.net / convertunits.com / RapidTables / WolframAlpha / calculator.net | **Not sources at all** — these are competitor products analyzed in §1, not data sources. | Never cite these for numeric values. |
| OPEC Annual Statistical Bulletin | Not fully assessed in this pass — the PDF is publicly downloadable; license terms not explicitly confirmed. | Flagged as a gap; re-check before citing OPEC-specific boe conventions. |

---

## 6. Recommendations for the Data agent

### Primary source per data field

- **Fuel density, NCV, GCV, and CO2/CH4/N2O/CO2e emission factors (UK-context
  and as the general-purpose default for the fuel catalog)**: **UK DESNZ 2025
  full-set spreadsheet** (`uk-desnz-ghg-2025`) — it is the only source in this
  catalog that gives density + both CV bases + the full gas split + CO2e in one
  place, under a genuinely reusable license. Use its "Fuels", "Bioenergy", and
  "Fuel properties" sheets directly (already extracted into this document for
  most fuels — see §4).
- **Global/rank-based fallback and for fuels DESNZ doesn't cover cleanly
  (crude oil, anthracite, lignite specifically, biofuels' raw combustion CO2
  before biogenic accounting)**: **IPCC 2006 Guidelines Vol. 2** (`ipcc-2006-v2`),
  Tables 1.2 (NCV) and 2.2 (default CO2/CH4/N2O emission factors, energy
  industries category).
- **US-specific cross-check / secondary confirmation**: **EPA GHG Emission
  Factors Hub 2025** (`epa-ghg-hub-2025`) and **EIA** (`eia-heat-contents`) —
  use these to sanity-check the order of magnitude of DESNZ/IPCC figures and
  to provide an explicit "US-specific" alternative figure where the UI wants
  to show regional variation, never to silently replace or average with the
  UK/global figures.
- **Exact SI/legal unit-definition constants** (BTU, calorie, gallon, pound,
  ton, barrel, therm, quad): **NIST SP 811** (`nist-sp811`) as the master
  reference, cross-checked against DESNZ's own "Conversions" tab (which is
  internally consistent with NIST's definitions to the precision shown).
- **toe/ktoe/Mtoe/tce definitions**: **IEA** (`iea-unit-converter` /
  IEA-glossary convention: toe = 41.868 GJ fixed constant); tce = 29.3076 GJ
  convention (needs one more direct-primary-source confirmation — see gap
  below).
- **boe**: **document as convention-dependent, not a single number** — present
  both the ~5.8 MMBtu (EIA/IEA/SPE) and the ~6,000 scf/boe (USGS) conventions,
  explicitly labeled, never silently pick one.
- **Hydrogen physical properties**: cross-source-verified figures in §4.8
  (LHV 119.96 MJ/kg / 33.3 kWh/kg; HHV 141.88 MJ/kg / 39.4 kWh/kg; gas density
  0.08988 kg/m³ at STP; liquid density 70.8 kg/m³) — re-verify against
  H2Tools/DOE directly if a browser-based fetch becomes possible, since our
  automated fetch was blocked (HTTP 403).
- **Electricity grid-intensity examples**: DESNZ (UK 2025: 0.177 kgCO2e/kWh,
  generation-only), EEA (EU-27 2023: 242 gCO2/kWh), EPA eGRID (US — needs
  re-extraction from the XLSX for precision, see §4.13) — always labeled
  region+year, never as defaults.

### Pitfalls noticed (for Domain and Data agents)

1. **DESNZ vs. IPCC biogenic-CO2 accounting differ structurally**, not just
   numerically, for wood/biodiesel/bioethanol/biogas: DESNZ nets Scope-1 CO2
   to zero and reports true combustion CO2 separately as "outside of scopes";
   IPCC's Table 2.2 gives raw combustion CO2 without that netting. Mixing
   these without a clear `basis`/`scope` field will silently produce wrong or
   misleading "biofuel CO2 ≈ 0" results if the "outside of scopes" figure is
   dropped.
2. **DESNZ's coal categories are functional (industrial/domestic/electricity-
   generation/coking), not rank-based (anthracite/lignite/sub-bituminous)** —
   there is no clean 1:1 mapping from the spec's requested "hard coal,
   lignite, anthracite" catalog to DESNZ's categories. Use IPCC's rank-based
   Table 1.2/2.2 for anthracite and lignite specifically, and treat DESNZ's
   "Coal (industrial)"/"Coal (domestic)" as the "hard coal, UK context"
   entries.
3. **Natural gas reference conditions are not explicit** in any of the three
   sources fetched (standard vs. normal cubic metre, temperature/pressure
   basis) — this must produce a visible warning in the UI per spec §9.3,
   not a silent assumption.
4. **DESNZ gives figures on both NCV and GCV basis for most fuels** — this is
   a major asset (directly matches the spec's HHV/GCV vs LHV/NCV requirement)
   but the data model must carry a `basis` field on every DESNZ-derived value
   or NCV/GCV will get silently conflated during import.
5. **"Petrol/diesel (average biofuel blend)" vs. "100% mineral" DESNZ
   variants**: the spec's fuel catalog doesn't distinguish these, but DESNZ
   does, and they materially differ (e.g. diesel mineral 2.66155 vs. blend
   2.57082 kgCO2e/L). Recommend defaulting the fuel catalog to the "average
   biofuel blend" variant (matches real UK forecourt fuel) but recording both
   as distinct fuel_ids or at least noting the choice explicitly in `notes`.
6. **boe is not a physical constant** — resist the temptation to hardcode
   "1 boe = X GJ" as if it were as exact as "1 barrel = 42 US gal." Show it as
   a documented industry convention with at least the two variants noted in
   §3.
7. **IEA's actual statistical data (World Energy Balances) is NOT freely
   reusable** — only the Unit Converter tool, its glossary, and public
   methodology PDFs are. Do not accidentally cite IEA country-level balance
   figures as if they were open data.
8. **Two research gaps need a follow-up fetch before Data-agent work
   finalizes**: (a) DESNZ's own "Outside of scopes" sheet (for exact biogenic
   CO2 figures per biofuel) was not extracted in this pass; (b) EPA eGRID's
   exact "US Average" row in Table 6 should be re-extracted from the
   companion XLSX (not the low-resolution PDF render) for full numeric
   precision. Both are straightforward re-fetches of files already
   identified/downloaded in this research pass (the DESNZ full-set XLSX is
   saved locally in the research scratch space and can be re-parsed for the
   "Outside of scopes" tab; the EPA hub XLSX URL is in §2).
9. **H2Tools blocked automated WebFetch (HTTP 403)** — all hydrogen figures
   here are cross-source-verified via secondary citations rather than a
   direct primary-page fetch. Acceptable given consistency across independent
   sources, but flagged for a manual re-check if a stricter provenance bar is
   wanted for the hydrogen fuel entry specifically.
10. **Never let "kcal" default silently** — spec explicitly calls this out
    (§9.5); the International Table calorie (4.1868 kJ) and thermochemical
    calorie (4.184 kJ) differ by ~0.04%, small but real, and different
    conventions (food-energy labeling vs. engineering) pick different ones in
    practice. Surface the choice, don't hide it.

---

## Post-review addendum (2026-07-05)

> Added after `docs/review-v0.1.md` (P1-D) found that two classes of shipped
> value — the corrected hydrogen HHV and the DESNZ "Outside of scopes"
> biogenic CO2 figures — were used in `data/fuels.json` /
> `data/emission-factors.json` (properly `source_refs`-cited there and in
> `data/sources.json`) but had never been recorded in this file, breaking the
> "every number traces to research-notes" provenance-ledger contract (spec
> §24 in the review's numbering). Both value sets below are copied verbatim
> from the shipped data/source files — no new research was performed for
> this addendum.

### §4.8 addendum — Hydrogen HHV correction

The original §4.8 entry above recorded HHV as "141.88 MJ/kg ≈ 39.4 kWh/kg
(also cited as 141.86 kJ/g)" from `h2tools` secondary citations. The value
actually **shipped** in `data/fuels.json` is:

- **HHV: 141.79 MJ/kg** (≈ 39.4 kWh/kg), range `{ low: 141.79, high: 142.18 }`.
- **Source:** `nist-webbook` (NIST Chemistry WebBook, NIST Standard Reference
  Database Number 69), derived from the 25 °C heat-of-combustion / formation
  enthalpy for water (285.83 kJ/mol) — a NIST-printed figure, used in place of
  the h2tools secondary citation specifically because it resolves to a primary
  thermochemical constant rather than a cross-cited web figure.
- **Cross-check, not averaged:** DOE GREET/ORNL gives 142.18 MJ/kg (gaseous)
  — hence the `range.high` of 142.18 — recorded as a documented spread, per
  the "diverging sources are never averaged" rule (rulebook §D.16), not
  blended into the 141.79 figure.
- Verbatim from `data/fuels.json` hydrogen heating-value `notes` field: "HHV
  141.79 MJ/kg (≈ 39.4 kWh/kg), NIST Chemistry WebBook (SRD 69)-traceable
  printed value (285.83 kJ/mol). The DOE GREET/ORNL table gives 142.18 MJ/kg
  (gaseous) — hence the range. Earlier project figure 141.88 was between
  these; corrected to the NIST-printed 141.79. The LHV/HHV gap is large for
  hydrogen (~18%) because all combustion product is water."
- LHV is unchanged from the original §4.8 entry: 119.96 MJ/kg (≈ 33.3 kWh/kg),
  still sourced to `h2tools`/`nist-webbook` cross-verification.

### §4.10/§4.11 addendum — DESNZ "Outside of scopes" biogenic CO2 figures

§4.10 and §4.11 above (and pitfall #8 and gap-note §4.12) flagged the DESNZ
"Outside of scopes" sheet as **not yet extracted** in the original research
pass. It has since been extracted and populated into
`data/emission-factors.json` as five `biogenic_CO2` pollutant entries, each
`source_id: "uk-desnz-ghg-2025"`. Recorded verbatim below (values and notes
copied from the shipped `emission-factors.json` entries, not re-derived):

- **Wood logs** (`wood-logs-biogenic-co2-desnz`): **1.43623 kg CO2/kg** (LHV
  basis) — "DESNZ 2025 'Outside of scopes' biogenic combustion CO2 for Wood
  Logs = 1436.23 kg per tonne = 1.43623 kg CO2/kg (and 0.35 kg/kWh). This is
  the true stack CO2 that Scope 1 nets to zero for biogenic carbon; reported
  on a SEPARATE line, never folded into the total or silently zeroed.
  Converted tonne→kg by ÷1000 (exact)." Source table/page: `'Outside
  of scopes' sheet, 'Wood logs' (col 'kg CO2e of CO2 per unit', net CV
  basis)`.
- **Wood pellets** (`wood-pellets-biogenic-co2-desnz`): **1.67718 kg CO2/kg**
  (LHV basis) — "DESNZ 2025 'Outside of scopes' biogenic combustion CO2 for
  Wood Pellets = 1677.18 kg per tonne = 1.67718 kg CO2/kg (and 0.35 kg/kWh).
  Reported separately, never zeroed. Converted tonne→kg by ÷1000 (exact)."
  Source table/page: `'Outside of scopes' sheet, 'Wood pellets' (col 'kg CO2e
  of CO2 per unit', net CV basis)`.
- **Ethanol** (`ethanol-biogenic-co2-desnz`): **1.52 kg CO2/L** (LHV basis) —
  "DESNZ 2025 'Outside of scopes' biogenic combustion CO2 for Bioethanol =
  1.52 kg CO2/L (also 71.37 kg/GJ, 1.91 kg/kg). Reported separately, never
  zeroed." Source table/page: `'Outside of scopes' sheet, 'Bioethanol' (col
  'kg CO2e of CO2 per unit', net CV basis)`.
- **Biodiesel** (`biodiesel-biogenic-co2-desnz`): **2.39 kg CO2/L** (LHV
  basis) — "DESNZ 2025 'Outside of scopes' biogenic combustion CO2 for
  Biodiesel ME = 2.39 kg CO2/L (also 72.16 kg/GJ, 2.68 kg/kg). Reported
  separately, never zeroed." Source table/page: `'Outside of scopes' sheet,
  'Biodiesel ME' (col 'kg CO2e of CO2 per unit', net CV basis)`.
- **Biogas** (`biogas-biogenic-co2-desnz`): **1.1056695 kg CO2/kg** (LHV
  basis) — "DESNZ 2025 'Outside of scopes' biogenic combustion CO2 for Biogas
  = 1105.6695 kg per tonne = 1.1056695 kg CO2/kg (also 0.19902 kg/kWh).
  Reported separately, never zeroed. Converted tonne→kg by ÷1000 (exact)."
  Source table/page: `'Outside of scopes' sheet, 'Biogas' (col 'kg CO2e of
  CO2 per unit', net CV basis)`.

All five are `scope: "outside_of_scopes"` — the value DESNZ's own sheet uses,
and the honest one: biogenic combustion CO2 is a memo item sitting outside the
Scope 1/2/3 columns entirely, not an upstream Scope 3 emission. (They shipped as
`scope_3_upstream` until v0.3.1, which mislabeled them as belonging to a scope.)
They are `region: "UK"`, `year: 2025`, `biogenic: true`. This closes the gap noted
in §4.12 ("DESNZ 'Outside of scopes' biogenic CO2 figures: not yet
extracted") and satisfies the review's provenance-ledger check (P1-D):
every shipped value now resolves to a research-notes entry.
