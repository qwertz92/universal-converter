/**
 * The /fuels comparison chart (src/lib/ui/fuel-chart.ts).
 *
 * The chart plots two figures per fuel. Neither may be typed into the UI: both
 * are the engine's own rows for "1 kg of the fuel", divided where a per-kWh
 * figure is wanted. These tests pin that against the REAL catalog, and pin the
 * edge cases (a fuel that cannot be answered is listed with a reason, never
 * plotted as 0; CO₂ is never passed off as CO₂e) against a small synthetic
 * bundle whose numbers can be checked by hand.
 */

import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { createConverter } from '#lib/conversion/engine.js';
import { loadDataBundle } from '#lib/data/load-data.js';
import { getConverter } from '#lib/index.js';
import { fuelCharts, type FuelChart, type FuelChartInput } from '#lib/ui/fuel-chart.js';
import { testBundle } from './fixtures/fuel-bundle';
import type { DataBundle, EmissionFactor, Fuel } from '#lib/conversion/types.js';

const catalog = loadDataBundle();
const real = fuelCharts();
const co2e = real.co2e_per_kwh;
const energy = real.kwh_per_kg;

function row(chart: FuelChart, fuelId: string) {
	const found = chart.rows.find((r) => r.fuelId === fuelId);
	if (!found) throw new Error(`${fuelId} is not plotted`);
	return found;
}

function fuelIn(fuels: readonly Fuel[], id: string): Fuel {
	const found = fuels.find((f) => f.id === id);
	if (!found) throw new Error(`${id} is not in the bundle`);
	return found;
}

function omittedIds(chart: FuelChart): string[] {
	return chart.omitted.flatMap((o) => o.fuels.map((f) => f.fuelId));
}

/** Compare to a reference computed on paper, to a relative 1e-9. */
function expectClose(actual: string, expected: Decimal.Value): void {
	const diff = new Decimal(actual).minus(expected).abs();
	expect(diff.div(new Decimal(expected).abs()).lt('1e-9')).toBe(true);
}

describe('chart structure', () => {
	it('sorts every metric from the largest value to the smallest', () => {
		for (const chart of [co2e, energy]) {
			const values = chart.rows.map((r) => new Decimal(r.raw));
			for (let i = 1; i < values.length; i++) expect(values[i - 1].gte(values[i])).toBe(true);
		}
	});

	it('plots or omits every catalog fuel, never both and never neither', () => {
		for (const chart of [co2e, energy]) {
			const seen = [...chart.rows.map((r) => r.fuelId), ...omittedIds(chart)];
			expect(seen.toSorted()).toEqual(catalog.fuels.map((f) => f.id).toSorted());
		}
	});

	it('never plots a value that is zero, missing or not a number', () => {
		for (const chart of [co2e, energy]) {
			expect(chart.rows.length).toBeGreaterThan(10);
			for (const r of chart.rows) {
				expect(new Decimal(r.raw).gt(0)).toBe(true);
				expect(r.share).toBeGreaterThan(0);
				expect(r.share).toBeLessThanOrEqual(1);
			}
			expect(chart.rows[0].share).toBe(1);
		}
	});

	it('gives every omission a reason that names what is missing', () => {
		for (const chart of [co2e, energy]) {
			for (const o of chart.omitted) expect(o.reason.length).toBeGreaterThan(10);
		}
	});
});

describe('CO₂e per kWh of fuel energy (net / LHV, direct combustion)', () => {
	it('tells heavy fuel oil, gas oil and road diesel apart', () => {
		const hfo = new Decimal(row(co2e, 'heavy-fuel-oil').raw);
		const gasOil = new Decimal(row(co2e, 'gas-oil').raw);
		const diesel = new Decimal(row(co2e, 'diesel').raw);
		expect(hfo.gt(gasOil)).toBe(true);
		expect(gasOil.gt(diesel)).toBe(true);
	});

	it('equals the catalog arithmetic for diesel: kg CO₂e per L ÷ kg per L ÷ kWh per kg', () => {
		const diesel = fuelIn(catalog.fuels, 'diesel');
		const factor = catalog.emissionFactors.find((f) => f.id === 'diesel-co2e-desnz');
		const lhv = diesel.heating_values?.find((h) => h.basis === 'lhv' && h.unit === 'mj_per_kg');
		expect(factor?.unit).toBe('kg_co2e_per_l');
		expect(diesel.density?.unit).toBe('kg_per_m3');
		const kgPerL = new Decimal(diesel.density?.value ?? 'NaN').div(1000);
		const kgCo2ePerKg = new Decimal(factor?.value ?? 'NaN').div(kgPerL);
		const kwhPerKg = new Decimal(lhv?.value ?? 'NaN').div(3.6);
		expectClose(row(co2e, 'diesel').raw, kgCo2ePerKg.div(kwhPerKg).times(1000));
	});

	it('agrees with the engine’s own per-kWh answer wherever it gives one', () => {
		// "1 kWh <fuel> to g CO2e" is a different engine path (energy → mass → factor)
		// from the one the chart uses (1 kg → factor, 1 kg → kWh). Where both
		// exist they must meet.
		const converter = getConverter();
		let compared = 0;
		for (const r of co2e.rows) {
			const out = converter.convertText(`1 kWh ${r.name} to g CO2e`, { basis: 'lhv' });
			if ('error' in out) continue;
			const direct = out.groups
				.flatMap((g) => g.results)
				.find((x) => x.is_target && x.unit_id === 'gram_co2e' && x.raw !== null);
			if (!direct?.raw) continue;
			expectClose(r.raw, direct.raw);
			compared++;
		}
		// Coal, wood and biogas have a mass-based CO₂e factor the engine can take
		// from kWh; if this drops to 0 the cross-check has silently stopped checking.
		expect(compared).toBeGreaterThanOrEqual(5);
	});

	it('lists what it cannot plot with the reason, grouped', () => {
		const omitted = omittedIds(co2e);
		// no CO₂e factor at all
		expect(omitted).toContain('methane');
		// a CO₂ factor only: CO₂ is never offered as CO₂e
		for (const id of ['crude-oil', 'lignite', 'anthracite']) expect(omitted).toContain(id);
		// hydrogen: the catalog says its combustion emits no CO₂, but holds no CO₂e figure
		expect(omitted).toContain('hydrogen');
		// grid electricity needs a region and a year
		const grid = co2e.omitted.find((o) => o.fuels.some((f) => f.fuelId === 'electricity'));
		expect(grid?.reason).toMatch(/year/i);
		expect(grid?.fuels.map((f) => f.fuelId)).toEqual(['electricity']);
		const co2Only = co2e.omitted.find((o) => o.fuels.some((f) => f.fuelId === 'crude-oil'));
		expect(co2Only?.reason).toMatch(/CO₂e/);
		expect(co2Only?.reason).toMatch(/never mixed|not mixed/i);
	});

	it('keeps biogenic CO₂ apart from the CO₂e bar', () => {
		const wood = row(co2e, 'wood-logs');
		// 0.04698508 kg CO₂e/kg (CH₄ + N₂O) ÷ 4.0861 kWh/kg: a few grams, not the 350 g of CO₂
		expect(new Decimal(wood.raw).lt(20)).toBe(true);
		expect(wood.biogenic).toBeDefined();
		const biogenic = new Decimal(wood.biogenic?.raw ?? 'NaN');
		expect(biogenic.gt(300) && biogenic.lt(400)).toBe(true);
		// fossil fuels carry no such note
		expect(row(co2e, 'diesel').biogenic).toBeUndefined();
		for (const id of ['wood-logs', 'wood-pellets', 'ethanol', 'biodiesel', 'biogas']) {
			expect(row(co2e, id).biogenic).toBeDefined();
		}
	});

	it('shows the number the way the engine does, with its exactness', () => {
		const r = row(co2e, 'diesel');
		expect(r.exactness).toBe('region_year_specific');
		expect(r.value.startsWith('~')).toBe(true);
	});

	it('names the factors’ region and year and the sources behind the figures', () => {
		expect(co2e.factorLabels).toEqual(['UK 2025']);
		expect(co2e.sources).toContain('uk-desnz-ghg-2025');
		for (const id of co2e.sources) expect(catalog.sources.some((s) => s.id === id)).toBe(true);
	});
});

describe('energy per kilogram (net / LHV)', () => {
	it('is the engine’s kWh for one kilogram, hydrogen on top', () => {
		const h2 = fuelIn(catalog.fuels, 'hydrogen');
		const lhv = h2.heating_values?.find((h) => h.basis === 'lhv' && h.unit === 'mj_per_kg');
		expect(energy.rows[0].fuelId).toBe('hydrogen');
		expectClose(energy.rows[0].raw, new Decimal(lhv?.value ?? 'NaN').div(3.6));
	});

	it('keeps the three oils distinct here too', () => {
		const values = ['heavy-fuel-oil', 'gas-oil', 'diesel'].map((id) => row(energy, id).raw);
		expect(new Set(values).size).toBe(3);
	});

	it('omits electricity because it has no heating value, not because it is zero', () => {
		expect(omittedIds(energy)).toEqual(['electricity']);
		expect(energy.omitted[0].reason).toMatch(/LHV/);
	});

	it('carries a different exactness where the catalog’s spread is wide', () => {
		// lignite's heating value spans 5.5–21.6 MJ/kg: an estimate, not a tabulated value
		expect(row(energy, 'lignite').exactness).toBe('estimated');
		expect(row(energy, 'diesel').exactness).toBe('source_based');
	});
});

/* ------------------------------------------------------------------ *
 * Synthetic bundle: hand-checkable numbers and the guard rails
 * ------------------------------------------------------------------ */

function fixtureInput(extra: {
	fuels?: Fuel[];
	factors?: EmissionFactor[];
	dieselFactors?: string[];
}): FuelChartInput {
	const base = testBundle();
	const diesel = fuelIn(base.fuels, 'test-diesel');
	const bundle: DataBundle = {
		...base,
		fuels: [
			...base.fuels.filter((f) => f.id !== 'test-diesel'),
			{ ...diesel, emission_factor_ids: extra.dieselFactors ?? ['test-diesel-co2e'] },
			...(extra.fuels ?? [])
		],
		emissionFactors: [...base.emissionFactors, ...(extra.factors ?? [])]
	};
	return {
		converter: createConverter(bundle),
		fuels: bundle.fuels,
		emissionFactors: bundle.emissionFactors
	};
}

const dieselCo2e: EmissionFactor = {
	id: 'test-diesel-co2e',
	fuel_id: 'test-diesel',
	pollutant: 'CO2e',
	metric: 'mass_per_volume',
	value: '2.52', // kg CO₂e per L; the fixture density is 0.84 kg/L → exactly 3 kg per kg
	unit: 'kg_co2e_per_l',
	scope: 'direct_combustion',
	region: 'XX',
	year: 2024,
	source_id: 'test-fixture'
};

describe('chart on a synthetic bundle', () => {
	it('divides the engine’s kg CO₂e per kg by its kWh per kg', () => {
		// 2.52 kg/L ÷ 0.84 kg/L = 3 kg CO₂e per kg; 43 MJ/kg ÷ 3.6 = 11.944… kWh/kg
		const chart = fuelCharts(fixtureInput({ factors: [dieselCo2e] })).co2e_per_kwh;
		expect(chart.rows.map((r) => r.fuelId)).toEqual(['test-diesel']);
		expectClose(chart.rows[0].raw, new Decimal(3000).div(new Decimal(43).div(3.6)));
		expect(chart.factorLabels).toEqual(['XX 2024']);
	});

	it('does not offer a CO₂-only fuel as CO₂e', () => {
		// the stock fixture's diesel has a CO₂ factor and nothing else
		const chart = fuelCharts(fixtureInput({ dieselFactors: ['test-diesel-co2'] })).co2e_per_kwh;
		expect(chart.rows).toEqual([]);
		const reason = chart.omitted.find((o) => o.fuels.some((f) => f.fuelId === 'test-diesel'));
		expect(reason?.reason).toMatch(/CO₂ factor/);
	});

	it('does not draw a zero CO₂e factor as an empty bar', () => {
		const zero: EmissionFactor = { ...dieselCo2e, value: '0' };
		const chart = fuelCharts(fixtureInput({ factors: [zero] })).co2e_per_kwh;
		expect(chart.rows).toEqual([]);
		const o = chart.omitted.find((x) => x.fuels.some((f) => f.fuelId === 'test-diesel'));
		expect(o).toBeDefined();
	});

	it('does not pick between two CO₂e factors', () => {
		const second: EmissionFactor = { ...dieselCo2e, id: 'test-diesel-co2e-b', value: '3.1' };
		const chart = fuelCharts(
			fixtureInput({
				factors: [dieselCo2e, second],
				dieselFactors: ['test-diesel-co2e', 'test-diesel-co2e-b']
			})
		).co2e_per_kwh;
		expect(chart.rows).toEqual([]);
		const o = chart.omitted.find((x) => x.fuels.some((f) => f.fuelId === 'test-diesel'));
		expect(o?.reason).toMatch(/several/i);
	});

	it('refuses a factor outside direct combustion, so the caption stays true', () => {
		const wtw: EmissionFactor = { ...dieselCo2e, scope: 'well_to_wheel' };
		const chart = fuelCharts(fixtureInput({ factors: [wtw] })).co2e_per_kwh;
		expect(chart.rows).toEqual([]);
		const o = chart.omitted.find((x) => x.fuels.some((f) => f.fuelId === 'test-diesel'));
		expect(o?.reason).toMatch(/direct.combustion/i);
	});

	it('does not plot a neighbour’s numbers under a fuel whose name finds the neighbour', () => {
		// Two catalog entries sharing a name: the converter answers for the first,
		// so the second must be listed as unresolved, not drawn with the first's bar.
		const twin: Fuel = {
			id: 'test-diesel-twin',
			names: ['test diesel'],
			aliases: [],
			category: 'oil',
			density: { value: '0.9', unit: 'kg_per_l', source_refs: ['test-fixture'] },
			heating_values: [
				{ basis: 'lhv', value: '40', unit: 'mj_per_kg', source_refs: ['test-fixture'] }
			],
			source_refs: ['test-fixture']
		};
		const charts = fuelCharts(fixtureInput({ factors: [dieselCo2e], fuels: [twin] }));
		expect(charts.kwh_per_kg.rows.map((r) => r.fuelId)).not.toContain('test-diesel-twin');
		expect(omittedIds(charts.kwh_per_kg)).toContain('test-diesel-twin');
	});

	it('omits a fuel with no net heating value from both metrics', () => {
		const charts = fuelCharts(
			fixtureInput({
				factors: [dieselCo2e],
				fuels: [
					{
						id: 'test-hhv-only',
						names: ['test hhv only'],
						aliases: [],
						category: 'oil',
						heating_values: [
							{ basis: 'hhv', value: '40', unit: 'mj_per_kg', source_refs: ['test-fixture'] }
						],
						source_refs: ['test-fixture']
					}
				]
			})
		);
		expect(omittedIds(charts.kwh_per_kg)).toContain('test-hhv-only');
		expect(omittedIds(charts.co2e_per_kwh)).toContain('test-hhv-only');
		expect(charts.kwh_per_kg.rows.map((r) => r.fuelId)).not.toContain('test-hhv-only');
	});
});
