# Open issues

One list of known open defects, by priority. Closed items are deleted — git
keeps them. P1 core function unusable / wrong data; P2 normal flow wrong or
clearly disturbing; P3 minor or rare; P4 not noticeable.

## P2

- **An energy amount of a fuel with a per-litre or per-m³ emission factor shows no
  CO₂ or CO₂e** (2026-10-13). Location: `buildFuelFromEnergy` in
  `src/lib/conversion/engine.ts`, whose mass branch calls
  `addEmissions(…, { massKg, volumeM3: undefined })`. Trigger: `100 kWh diesel`,
  `100 kWh natural gas`, and every oil product, LPG, CNG and LNG, whose DESNZ factor
  is per litre or m³. Evidence: the emissions group says "Not available: diesel has no
  emission factor in the data set", while `10 L diesel` shows ~25.7 kg CO₂e from the
  same catalog entry (it holds a density and a per-litre factor), and
  `100 kWh hard coal` works because its factor is per kg. The sentence also names the
  wrong gap: the factor exists, the engine just never derives a volume from the mass
  it found. Workaround: enter litres or kilograms. `src/lib/ui/fuel-chart.ts` starts
  from 1 kg for this reason. Fix: derive the volume through the density (as the
  kg input path already does), then re-run `tests/fuel-chart.test.ts`, whose
  cross-check against `1 kWh <fuel> to g CO2e` will then cover every fuel.

## P3

None open (2026-10-12).

## P4

None open (2026-10-13).
