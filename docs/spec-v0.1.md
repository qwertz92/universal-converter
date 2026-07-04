# Universal Converter v0.1 — Product & Engineering Specification

> Authoritative spec, provided by the project owner (Thomas) on 2026-07-04.
> All agents working on this repository must follow this document. Where an
> agent makes a justified deviation, it must be documented (ADR or docs).

## 1. Projektidee

Website: `Universal Converter`, wahrscheinliche Domain: `universal-converter.org`.

Die Domainwahl ist bewusst eher `.org`, weil das Projekt als quellenbasiertes,
erklärendes, technisch seriöses Referenz- und Umrechnungswerkzeug positioniert
werden soll. Es soll nicht wie ein billiger Online-Rechner wirken, sondern wie
ein nachvollziehbares Universalwerkzeug für Einheiten, Energie, Brennstoffe,
Emissionen und langfristig weitere physikalische und industrielle Umrechnungen.

Startfokus:

- Energie
- Brennstoffe
- Heizwert/Brennwert
- Energiedichte
- CO2/CO2e
- Öl/Gas/Industrieeinheiten
- Joule, Wattstunden, Kalorien, BTU, therm, toe, boe, Barrel etc.

Langfristiges Ziel: Eine allumfassende Universal-Converter-Website, die
verschiedenste Einheiten und Sachkontexte abdeckt, dabei aber immer transparent
macht, ob eine Umrechnung exakt, standardisiert, kontextabhängig oder nur eine
Schätzung ist.

## 2. Produktziel

Die Website soll nicht nur klassische Einheiten umrechnen wie:

- `1 kWh → 3.6 MJ`
- `1 MWh → 3.6 GJ`
- `1 kcal → 4.184 kJ`

sondern auch kontextabhängige Energie- und Brennstofffragen beantworten wie:

- Wie viel Energie steckt ungefähr in `1 Liter Diesel`?
- Wie viele kg CO2 entstehen bei `1 Liter Benzin`?
- Wie viele kWh entsprechen `1 m³ Erdgas`?
- Wie viele Liter sind `1 Barrel crude oil`?
- Was ist der Unterschied zwischen `barrel` und `boe`?
- Was ist der Unterschied zwischen `HHV/GCV` und `LHV/NCV`?
- Warum ist `m³ Erdgas → kWh` nicht immer exakt?
- Warum ist `CO2` nicht automatisch `CO2e`?
- Warum hängt `1 kWh Strom → gCO2e` von Land, Jahr und Strommix ab?

Die App soll zu einer Eingabe nicht nur eine einzelne Ziel-Einheit ausgeben,
sondern automatisch mehrere sinnvolle Ergebnisgruppen anzeigen.

Beispiel-Eingabe: `1 L diesel` → Ergebnisgruppen:

- Volumen: L, m³, US gal, imperial gal, barrel
- Masse: kg, g, t, lb, abhängig von Dichteannahme
- Energie: MJ, kWh, BTU, toe/boe-Äquivalent, abhängig von LHV/HHV
- Emissionen: kg CO2, kg CO2e, abhängig von Quelle/Faktor
- Energiedichte: MJ/L, kWh/L, MJ/kg, kWh/kg
- Annahmen: Dichte, Heizwertbasis, Quelle, Jahr, Unsicherheit
- Warnungen: Werte sind material- und quellenabhängig, keine exakte Naturkonstante

## 3. Wichtigste Designentscheidung

Baue keinen simplen Unit Converter. Baue eine saubere Conversion-Plattform mit
drei getrennten Schichten:

### 3.1 Exakte Einheiten-Engine

Dimensionsgleiche Konversionen ohne Materialannahme. Beispiele:

- J, kJ, MJ, GJ, TJ, PJ
- Wh, kWh, MWh, GWh, TWh
- cal, kcal, food Calorie
- BTU, kBTU, MMBTU
- therm, quad
- W, kW, MW, GW, TW
- g, kg, t, lb, short ton, long ton
- L, m³, cm³, ft³
- US gallon, imperial gallon
- barrel als Volumeneinheit
- Sekunden, Minuten, Stunden, Tage, Jahre

Diese Werte müssen über feste, testbare Faktoren umgerechnet werden.

### 3.2 Kontextabhängige Brennstoff-/Material-Engine

Ohne Materialkontext nicht eindeutig. Beispiele:

- Liter Diesel → kg
- Liter Diesel → kWh
- Liter Benzin → CO2
- m³ Erdgas → kWh
- kg Wasserstoff → kWh
- Barrel Rohöl → Energie
- kg Kohle → MWh
- m³ Biogas → kWh
- kg Holzpellets → kWh
- kWh Strom → CO2e

Diese Konversionen brauchen Datenquellen, Annahmen, Gültigkeitsbereiche und
Warnhinweise.

### 3.3 Quellen-, Annahmen- und Emissions-Engine

Jede nicht-exakte Umrechnung muss erklären:

- Welche Quelle wurde verwendet?
- Von welchem Jahr ist der Wert?
- Welche Einheit hatte der Originalwert?
- Wurde der Wert direkt übernommen oder abgeleitet?
- Handelt es sich um CO2 oder CO2e?
- Handelt es sich um direkte Verbrennung, Scope 1, Scope 2 oder inklusive upstream?
- Wird LHV/NCV oder HHV/GCV verwendet?
- Welche Unsicherheit oder Bandbreite ist sinnvoll?
- Welche Region oder welches Land gilt?
- Welche Normbedingungen gelten bei Gas?
- Ist der Wert allgemein, US-spezifisch, UK-spezifisch, EU-spezifisch oder global?

## 4. Tech-Stack-Entscheidung

Bevorzugter Stack:

- SvelteKit
- TypeScript
- Tailwind CSS
- Zod für Datenvalidierung
- Decimal.js oder Big.js für präzise Zahlenverarbeitung
- Vitest für Unit Tests
- Playwright für E2E Tests, falls sinnvoll
- Markdown oder mdsvex für Learn-/Docs-Seiten
- JSON/YAML/CSV für versionierte Datenfiles
- Cloudflare Pages oder Cloudflare Workers als primäres Hosting-Ziel

### 4.1 Warum SvelteKit?

Viele statische, dokumentierende, SEO-fähige Seiten + interaktive Converter-UI.

Geplante Seitenstruktur (langfristig):

- `/`
- `/convert`
- `/units`, `/units/kwh`, `/units/btu`, `/units/barrel`, `/units/boe`
- `/fuels`, `/fuels/diesel`, `/fuels/gasoline`, `/fuels/natural-gas`, `/fuels/hydrogen`
- `/learn/kwh-vs-kw`, `/learn/hhv-vs-lhv`, `/learn/barrel-vs-boe`, `/learn/co2-vs-co2e`
- `/sources`
- `/methodology`
- `/about`

SvelteKit ist nur UI, Routing und Präsentationsschicht. Die Conversion Engine
darf nicht direkt in Svelte-Komponenten versteckt werden.

### 4.2 Bun, Deno, Node, Rust

- SvelteKit + TypeScript als Hauptstack
- Bun als lokaler Package Manager/Runner, sofern kompatibel (Hinweis: auf der
  aktuellen Entwicklungsmaschine ist Bun nicht installiert → npm verwenden)
- Cloudflare Adapter für Deployment
- Kein separates Rust-/Deno-/Node-Backend in V0.1

Cloudflare Workers laufen nicht als Bun-/Node-Server, sondern in einer eigenen
Workers-Runtime auf Basis von Web-Standard-APIs. Backend-Code (falls nötig)
muss auf Web APIs und den SvelteKit Cloudflare Adapter ausgerichtet sein.

Rust kann später sinnvoll sein (WASM-Engine, CLI, Datenvalidierungs-Tooling),
ist für V0.1 Overengineering. Die Conversion Engine wird in sauberem,
framework-unabhängigem TypeScript implementiert. Korrektheit, Tests und
Datenmodell sind wichtiger als Performance.

### 4.3 Ziel-Deployment

- Cloudflare Pages, optional Cloudflare Workers für API-Endpunkte
- später eventuell D1, KV, R2, Durable Objects
- Vorerst möglichst statisch oder weitgehend statisch deploybar
- Dynamische Endpunkte via SvelteKit server routes, Cloudflare-kompatibel
- VPS-Deployment ist möglich, soll aber jetzt keine Architektur verkomplizieren

## 5. Architekturprinzipien

Modular. Conversion Engine unabhängig von SvelteKit nutzbar. Beispielstruktur:

```
universal-converter/
  README.md
  package.json
  svelte.config.js
  vite.config.ts
  src/
    routes/
      +layout.svelte
      +page.svelte
      convert/+page.svelte
      units/+page.svelte
      units/[unit]/+page.svelte
      fuels/+page.svelte
      fuels/[fuel]/+page.svelte
      learn/+page.svelte
      learn/[slug]/+page.svelte
      sources/+page.svelte
      methodology/+page.svelte
    lib/
      conversion/
        engine.ts parser.ts result-groups.ts formulas.ts precision.ts warnings.ts types.ts
      units/
        registry.ts dimensions.ts exact-conversions.ts aliases.ts
      fuels/
        registry.ts fuel-types.ts density.ts heating-values.ts
      emissions/
        factors.ts scopes.ts co2-vs-co2e.ts
      data/
        load-data.ts validate-data.ts
      formatting/
        numbers.ts units.ts citations.ts
      components/
        converter/ results/ sources/ layout/
  data/
    units.json fuels.json emission-factors.json sources.json examples.json
  docs/
    architecture.md data-model.md conversion-rules.md sources.md
    research-notes.md roadmap.md accuracy-and-limitations.md
    adr/0001-tech-stack.md adr/0002-data-provenance.md
    adr/0003-conversion-engine.md adr/0004-cloudflare-deployment.md
  tests/
    conversion/ units/ fuels/ emissions/ fixtures/
```

Die Struktur darf verbessert werden; größere Entscheidungen in ADRs
dokumentieren.

## 6. Subagenten-Orchestrierung

Rollen (jede Rolle hat definierte Ergebnisartefakte):

### 6.1 Research-Agent

- Existierende Converter analysieren, Konkurrenz-/Vergleichsseiten suchen
- Datenquellen identifizieren, Lizenz-/Nutzbarkeitsrisiken prüfen
- Offizielle Quellen priorisieren, Research Notes schreiben

Insbesondere prüfen: IEA Unit Converter / Energy Statistics, EIA Energy
Conversion Calculator, EIA emission coefficients, EPA GHG Emission Factors Hub,
IPCC Guidelines, UK DESNZ/BEIS GHG conversion factors, NIST SI conversion
factors, UCUM, QUDT, SEAI oder andere nationale Energiequellen, Engineering
ToolBox (nur Plausibilität, nicht primäre Datenquelle), H2Tools für
Wasserstoff, weitere seriöse Quellen.

Ergebnis: `docs/research-notes.md`

### 6.2 Domain-Agent

- Fachliche Modellierung: Energie, Brennstoffe, Heizwerte, Gas, Öl, Emissionen
- Definition der wichtigsten Fallstricke
- Empfehlungen für V0.1-Datenumfang
- Prüfung, wo HHV/LHV/NCV/GCV und Normbedingungen relevant sind
- Empfehlungen zu CO2 vs CO2e und Scope 1/2/3

Ergebnis: `docs/conversion-rules.md`, `docs/accuracy-and-limitations.md`

### 6.3 Data-Agent

- Datenmodell entwerfen, JSON-Struktur anlegen, Quellenmodell bauen
- Zod-Schemas erstellen, Datenvalidierung implementieren
- Initialen Datenkatalog anlegen
- Jede Zahl mit source_id, Jahr, Einheit, Gültigkeitsbereich und Kommentar

Ergebnis: `data/*.json`, `src/lib/data/validate-data.ts`, `docs/data-model.md`

### 6.4 Conversion-Engine-Agent

- Framework-unabhängige TypeScript-Engine, Parser, Unit Registry, Dimensionen
- Exakte + kontextabhängige Konversionen, Ergebnisgruppen
- Formeln, Quellen, Warnungen, Annahmen an Ergebnisse anhängen
- Rundung/Precision sauber behandeln

Ergebnis: `src/lib/conversion/*`, `src/lib/units/*`, `src/lib/fuels/*`,
`src/lib/emissions/*`

### 6.5 Frontend-/UX-Agent

- SvelteKit UI, Converter-Hauptseite, Ergebnisgruppen, Einheiten-/Fuel-Suche
- Info-Karten, Quellen-/Annahmen-Panel, Mobile-first, optional Dark Mode
- Gute leere Zustände/Fehlerzustände, Quick Examples

Ergebnis: `src/routes/*`, `src/lib/components/*`

### 6.6 Test-Agent

- Unit Tests exakte Einheiten, Fuel-Konversionen, Emissionen
- Parser-Tests, Datenvalidierungs-Tests, Golden Tests
- Optional Playwright E2E. Mindestens 30 sinnvolle Tests, lieber mehr.

Ergebnis: `tests/*`

### 6.7 Docs-Agent

- README, Architekturdiagramme, ADRs, Roadmap, Methodik, Deployment,
  Grenzen/Risiken

Ergebnis: `README.md`, `docs/*.md`

### 6.8 Review-Agent

- Projekt gegen Akzeptanzkriterien prüfen; fachliche Fehler, UX-Probleme,
  Datenquellen-Probleme, Testabdeckung, Dokulücken; Verbesserungen priorisieren

Ergebnis: `docs/review-v0.1.md` + finale To-do-Liste

## 7. Datenmodell

Exakte Einheiten, kontextabhängige Stoffdaten und Emissionsfaktoren sauber
trennen.

### 7.1 Unit

```
Unit:
  id, dimension, symbols, names, aliases, base_unit, to_base_factor,
  offset_formula_if_needed, system, is_exact, notes, source_refs
```

Dimensions (Beispiele): energy, power, mass, volume, time, temperature,
pressure, flow_rate, energy_density_mass, energy_density_volume,
emissions_intensity, currency_per_energy (später), dimensionless.

### 7.2 Quantity

```
Quantity: value, unit_id, dimension, original_input
```

### 7.3 Fuel

```
Fuel:
  id, names, aliases, category, density, lhv, hhv, ncv, gcv,
  energy_density_mass, energy_density_volume, emission_factors,
  typical_ranges, source_refs, notes, warnings
```

### 7.4 EmissionFactor

```
EmissionFactor:
  id, fuel_id, pollutant, metric, value, unit, basis, scope, region, year,
  source_id, source_table_or_page, uncertainty, notes
```

Pollutants/Metrics: CO2, CH4, N2O, CO2e, biogenic_CO2.

Scope/Basis: direct_combustion, scope_1, scope_2, scope_3_upstream,
well_to_tank, tank_to_wheel, well_to_wheel, unknown_or_mixed (nur sauber
markiert).

### 7.5 Source

```
Source:
  id, title, publisher, url, retrieved_at, publication_year, license,
  reliability, notes
```

### 7.6 ConversionResult

```
ConversionResult:
  value, unit_id, category, exactness, precision, confidence, formula,
  assumptions, warnings, source_refs
```

Exactness: exact, standard_definition, source_based, estimated,
region_year_specific, user_assumption, unsupported.

## 8. Initialer Funktionsumfang V0.1

V0.1 soll bereits eine ernsthafte Anwendung sein.

### 8.1 Haupt-Converter

- Freitext- oder strukturierte Eingabe; Wert + Einheit
- optionale Fuel-/Material-Auswahl
- Autocomplete/Suche für Einheiten und Brennstoffe
- Erkennung von Synonymen
- Ergebnisgruppen; Formeln/Annahmen/Quellen pro Ergebnis
- Warnungen bei unsicheren Umrechnungen
- Beispiele/Schnellstarter, kopierbare Werte, gute Fehlermeldungen

### 8.2 Eingabebeispiele (müssen funktionieren, notfalls über strukturierte UI)

`1 kWh`, `1 MWh`, `1 MJ`, `1 GJ`, `1 BTU`, `1 MMBTU`, `1 therm`, `1 toe`,
`1 boe`, `1000 kcal`, `1 liter diesel`, `1 L gasoline`, `1 liter heating oil`,
`1 barrel crude oil`, `1 m3 natural gas`, `1 kg hydrogen`, `1 kg hard coal`,
`1 kg lignite`, `1 kg wood pellets`

### 8.3 Ergebnisgruppen

Energy, Power, Mass, Volume, Fuel Equivalents, Emissions, Energy Density,
Industrial Units, Assumptions, Warnings, Sources, Formula/Calculation Path —
abhängig vom Kontext.

### 8.4 Einheitengruppen (mindestens)

- Energy: J, kJ, MJ, GJ, Wh, kWh, MWh, GWh, cal, kcal, BTU, kBTU, MMBTU,
  therm, quad, toe, ktoe, Mtoe, boe, tce (falls sauber definierbar)
- Power: W, kW, MW, GW
- Mass: mg, g, kg, tonne, lb, short ton, long ton
- Volume: mL, L, m³, cm³, ft³, US gallon, imperial gallon, barrel
- Time: second, minute, hour, day, year
- Emissions: g/kg/t CO2, g/kg/t CO2e, gCO2/kWh, kgCO2/GJ, kgCO2/L, kgCO2/kg

### 8.5 Brennstoffkatalog V0.1 (mindestens)

crude oil generic; Brent/WTI (nur falls seriöse Daten ohne Scheingenauigkeit);
gasoline/petrol; diesel; heating oil; kerosene/jet fuel; LPG; propane; butane;
natural gas; methane; LNG; hydrogen; hard coal; lignite; anthracite; wood;
wood pellets; ethanol; biodiesel; biogas (falls Daten sauber verfügbar).

Für jeden Brennstoff soweit möglich: Dichte, LHV/NCV, HHV/GCV, Energie pro kg,
Energie pro Liter/m³, CO2-Faktor, CO2e-Faktor (falls seriös verfügbar),
Unsicherheitsbereich/Hinweis, Quellen, Notizen.

Wenn eine Quelle für einen Wert fehlt: leer lassen und sichtbar als
„not available" markieren, statt Werte zu erfinden.

## 9. Fachliche Regeln

### 9.1 kW vs kWh

kW ist Leistung, kWh ist Energie. Leistung × Zeit = Energie. 1 kW über 1
Stunde = 1 kWh. Keine automatische Umrechnung von kW in kWh ohne Zeitangabe.

### 9.2 HHV/GCV vs LHV/NCV

HHV/GCV enthält Kondensationswärme des Wasserdampfs, LHV/NCV nicht. Besonders
relevant bei Gas, Wasserstoff, Biomasse, Heiztechnik. Ergebnisse müssen
anzeigen, welche Basis verwendet wird.

### 9.3 Gas

Erdgasumrechnungen sind kontextabhängig. Berücksichtigen oder erklären:
Normkubikmeter, standard cubic meter, tatsächlicher m³-Verbrauch,
Temperatur/Druck, Brennwert, Zustandszahl/Korrekturfaktor, Gaszusammensetzung,
länderspezifische Abrechnungslogik. V0.1 pragmatisch mit klaren Annahmen,
aber mit Warnungen.

### 9.4 Öl und Barrel

Barrel als Volumeneinheit ist typischerweise 42 US gallons. boe ist eine
Energieäquivalenzeinheit, nicht dasselbe wie ein physisches Barrel Öl.
Rohöl-Dichten unterscheiden sich je nach Sorte. Liter Rohöl → Energie ist eine
Schätzung.

### 9.5 Kalorien

cal und kcal in Technik/Physik; food Calorie entspricht typischerweise kcal.
Unterschied thermochemical calorie vs International Table calorie, falls
implementiert. Keine unnötige Scheingenauigkeit.

### 9.6 CO2 vs CO2e

CO2 ist nur Kohlendioxid. CO2e enthält andere Treibhausgase nach GWP.
Faktoren können direkte Verbrennung, upstream oder Lifecycle enthalten.
Stromfaktoren hängen von Land, Jahr, Strommix ab. Biogenes CO2 nicht
unsichtbar als null behandeln, sondern separat ausweisen oder erklären.

## 10. UI/UX-Anforderungen

- Mobile-first, gute Desktop-Nutzung, schnelle Eingabe
- Keine Tabellenwüste als Hauptansicht; klare Cards/Sections für Ergebnisgruppen
- Quellen und Annahmen aufklappbar; Rechenweg sichtbar
- Warnungen sichtbar, aber nicht störend; Ergebniswerte kopierbar
- Quick Examples; Suchfunktion für Einheiten und Brennstoffe
- Detailseiten für wichtige Einheiten und Brennstoffe
- Learn-Seiten, Methodology-Seite, Sources-Seite
- Optional Dark Mode; saubere Typografie; seriöse `.org`-Anmutung

Mögliche Startseitenpositionierung:

> Universal Converter — A transparent converter for units, energy, fuels and
> emissions. Convert values, understand assumptions, and trace every non-exact
> result back to its source.

Die UI unterscheidet ausdrücklich: exact conversion, source-based conversion,
estimate, context required, unsupported.

## 11. Learn-/Content-Seiten V0.1

Mindestens kurze, hochwertige Seiten/Content-Blöcke zu: What is energy?,
kW vs kWh, Joule vs Wh, BTU and MMBTU, What is a therm?, What is a barrel?,
Barrel vs boe, toe and oil equivalent units, HHV/GCV vs LHV/NCV, Natural gas
m³ to kWh, CO2 vs CO2e, Why fuel conversions are approximate, Why electricity
emissions depend on region and year, Food calories vs technical calories.

Korrekt, verständlich, quellenbasiert.

## 12. Datenquellen und Lizenzdisziplin

Priorität:

1. Offizielle Standard-/Regierungs-/Agency-Quellen
2. Internationale Organisationen
3. Norm-/Einheitenquellen
4. Seriöse technische Referenzen
5. Kommerzielle Webseiten nur als Plausibilitätsvergleich

Jede Datenquelle braucht: source_id, Titel, Publisher, URL, Jahr, Abrufdatum,
Lizenz/Nutzbarkeit (soweit ermittelbar), Notiz zu Verlässlichkeit.

Keine Werte ohne Quelle erfinden. Wenn eine Zahl allgemein bekannt scheint,
trotzdem möglichst eine Quelle angeben. Bei abweichenden Quellen nicht blind
mitteln: Datenbasis markieren, Spannbreite anzeigen (falls sinnvoll), Annahme
offenlegen, in V0.1 konservativ bleiben.

## 13. Tests

Mindestens 30 Tests, besser mehr.

### 13.1 Exact Unit Tests

1 kWh = 3.6 MJ; 1 MWh = 3.6 GJ; 1 Wh = 3600 J; 1 kcal ≈ 4184 J (abhängig von
calorie-Basis); 1 BTU in J (abhängig von BTU-Basis); 1 barrel = 42 US gallons;
Liter↔m³; kg↔lb; tonne↔kg; MMBTU↔BTU.

### 13.2 Parser Tests

`1 kWh`, `1 kilowatt hour`, `1000 kcal`, `1 liter diesel`, `1 L diesel`,
`1 barrel crude oil`, unbekannte Einheit, fehlender Wert, mehrdeutige Einheit.

### 13.3 Fuel Tests

Diesel mit Dichteannahme; Diesel mit LHV; Gasoline mit LHV; Natural Gas m³→kWh;
Hydrogen kg→kWh LHV/HHV; Barrel crude oil mit Warnung.

### 13.4 Emissions Tests

Diesel L→kg CO2; Gasoline L→kg CO2; Natural Gas m³→kg CO2; Hydrogen direct
combustion CO2 = 0 bzw. sauber erklärt, upstream nicht automatisch 0;
Electricity ohne Region/Jahr → Warnung oder Context Required.

### 13.5 Data Validation Tests

fuel_id/unit_id eindeutig; jede source_id referenziert existierende Quelle;
jede nicht-exakte Conversion hat source_refs; Werte haben Einheiten; HHV/LHV
nicht verwechselt.

### 13.6 Golden Tests

Beispielrechnungen mit erwarteten Ergebnissen und Toleranzen.

## 14. Dokumentation

Mindestens: `README.md`, `docs/architecture.md`, `docs/data-model.md`,
`docs/conversion-rules.md`, `docs/sources.md`, `docs/research-notes.md`,
`docs/roadmap.md`, `docs/accuracy-and-limitations.md`,
`docs/deployment-cloudflare.md`, `docs/review-v0.1.md`,
`docs/adr/0001-tech-stack.md`, `docs/adr/0002-data-provenance.md`,
`docs/adr/0003-conversion-engine.md`, `docs/adr/0004-cloudflare-deployment.md`.

Mermaid-Diagramme für: Systemarchitektur, Conversion Pipeline, Datenmodell,
User Flow, Deployment Flow.

## 15. Roadmap

- **0.1:** SvelteKit-App, Conversion Core, Energy Units, Basic Fuel Catalog,
  Basic Emissions, Sources/Provenance, Learn Pages, Tests, Cloudflare
  Deployment Readiness
- **0.2:** Bessere Natural-Gas-Modelle, Region/Jahr für Strommix,
  Import/Export, Advanced Search, mehr Brennstoffe, verbesserte
  Unsicherheitsdarstellung, Public API Draft
- **0.3:** Heizkostenrechner, Strom-/Gaspreisrechner, Boiler Efficiency,
  Heat Pump COP, Well-to-Wheel-Faktoren, Country Presets, Saved Scenarios
- **0.4:** Historische Industrieeinheiten, Pressure/Flow/Temperature,
  Steam/Energy Engineering Calculators, User-defined Materials/Fuels,
  Offline PWA, Embeddable Widget
- **1.0:** Vollständige Quellen-/Provenance-UI, versionierte Datensätze,
  Public API, Exportable Calculation Reports, Multi-language UI (DE/EN),
  SEO Knowledge Pages, Admin/Data Update Pipeline, optional CLI, optional
  npm package

## 16. Langfristige Feature-Ideen

Heizkostenrechner, CO2-Kostenrechner, Strommix-Faktoren nach Land/Jahr,
Erdgasabrechnungsrechner, Wärmepumpenvergleich, Boiler-/Kesselwirkungsgrad,
EV-Äquivalente, Haushaltsstrom-Äquivalente, Batterie-Energiedichtevergleich,
Wasserstoffspeicher-Vergleich, Power-Plant-Efficiency, Refinery Products
Overview, District Heating Converter, Steam Energy Calculators, Flow Rate
(m³/h Gas → MW thermal), Load/Capacity Factor, Electricity Market Units
(€/MWh, ct/kWh), Emissions Intensity, `/api/convert`, Embeddable Widget,
CLI Converter, CSV/JSON Export, Source Diff Viewer, Equation Renderer,
Calculation Report Export, Confidence Score, User-defined custom factors,
Dataset versioning, Factor change log, Open data contribution workflow.

## 17. Akzeptanzkriterien

1. App läuft lokal mit dokumentierten Befehlen.
2. App ist für Cloudflare Deployment vorbereitet.
3. SvelteKit + TypeScript ist sauber eingerichtet.
4. Conversion Engine ist framework-unabhängig.
5. Exakte Einheitenumrechnungen funktionieren.
6. Kontextabhängige Fuel-Konversionen funktionieren mit Quellen.
7. Emissionsberechnungen funktionieren für mehrere Brennstoffe.
8. Ergebnisse zeigen mehrere sinnvolle Ergebnisgruppen.
9. Ergebniswerte enthalten Annahmen, Quellen und Warnungen.
10. Exakte und nicht-exakte Konversionen sind klar unterscheidbar.
11. Fuel Catalog V0.1 existiert.
12. Sources Catalog existiert.
13. Data Validation existiert.
14. Mindestens 30 Tests laufen erfolgreich.
15. README ist brauchbar.
16. Architektur-Dokumentation existiert.
17. Datenmodell-Dokumentation existiert.
18. Conversion Rules sind dokumentiert.
19. Accuracy/Limitations sind dokumentiert.
20. Roadmap ist dokumentiert.
21. Learn-Seiten oder Learn-Content existieren.
22. UI ist mobile-first und seriös.
23. Quick Examples funktionieren.
24. Keine ungeprüften Zahlen ohne Quelle.
25. Keine Scheingenauigkeit bei Schätzwerten.
26. Keine falsche automatische Umrechnung von Leistung zu Energie ohne Zeit.
27. CO2 und CO2e sind getrennt.
28. HHV/LHV ist sauber markiert.
29. Gasumrechnungen zeigen Warnungen/Annahmen.
30. Finale Review-Datei existiert.

## 18–19. Arbeitsweise, Kreativität

Große produktive Schleifen; vernünftige Annahmen treffen und dokumentieren
statt Rückfragen bei Kleinigkeiten. Kreative Verbesserungen sind erlaubt
(Architektur, UX, Datenmodell, Namen, Feature-Schnitte, Quellen, Tests,
Doku-Struktur), aber:

- Fachliche Korrektheit geht immer vor Geschwindigkeit
- Quellen gehen immer vor erfundenen Werten
- Tests gehen immer vor „sieht ungefähr richtig aus"
- Transparenz geht immer vor scheinbar einfachen Antworten
- Exakt und approximativ müssen immer getrennt bleiben

## 20. Finale Ausgabe (für den Orchestrator)

Am Ende: ehrliche Zusammenfassung — was gebaut wurde, lokaler Start, Tests,
Cloudflare-Deployment, Datenquellen, Annahmen, Einschränkungen, wichtige
Dateien, Architekturentscheidungen, Review-Findings + Behebungen, nächste
Roadmap-Punkte, offene Risiken.
