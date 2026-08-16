/**
 * Fuel variants (ADR 0005): gas oil / red diesel, 100% mineral diesel and
 * petrol, and burning oil ship as first-class fuels rather than footnotes on
 * their parents.
 *
 * The failure mode being guarded against is a variant that resolves to its
 * parent and quietly returns the parent's density and emission factors — the
 * answer looks right, cites a real source, and is wrong by several percent.
 * Every expected number below is quoted from data/fuels.json /
 * data/emission-factors.json, which in turn transcribe docs/research-notes.md
 * §4.4/§4.5 (DESNZ 2025 "Fuels" and "Fuel properties" sheets).
 */

import { describe, expect, it } from 'vitest';
import { FuelRegistry, UnitRegistry, getConverter, parseQuery } from '$lib/index';
import { loadDataBundle } from '$lib/data/load-data';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();
const { units, fuels, emissionFactors } = loadDataBundle();
const unitRegistry = new UnitRegistry(units);
const fuelRegistry = new FuelRegistry(fuels);

const VARIANTS = ['gas-oil', 'mineral-diesel', 'mineral-petrol', 'burning-oil'] as const;

function fuelOf(query: string): string | undefined {
	const parsed = parseQuery(query, unitRegistry, fuelRegistry);
	if (!parsed.ok) throw new Error(`"${query}" failed to parse: ${parsed.error.message}`);
	return parsed.query.fuel_id;
}

function allResults(input: string): ConversionResult[] {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results);
}

function co2ePerLitre(input: string): ConversionResult | undefined {
	return allResults(input).find((r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2e');
}

describe('variants are reachable by the words people actually use', () => {
	it.each([
		['1 L red diesel', 'gas-oil'],
		['1 L gas oil', 'gas-oil'],
		['1 L off-road diesel', 'gas-oil'],
		['1 litre marked gas oil', 'gas-oil'],
		['1 L 100% mineral diesel', 'mineral-diesel'],
		['1 L mineral petrol', 'mineral-petrol'],
		['1 L burning oil', 'burning-oil'],
		['1 L 28 second oil', 'burning-oil'],
		['1 L heating kerosene', 'burning-oil']
	])('%s resolves to %s', (query, expected) => {
		expect(fuelOf(query)).toBe(expected);
	});

	it('leaves the parents alone', () => {
		expect(fuelOf('1 L diesel')).toBe('diesel');
		expect(fuelOf('1 L automotive gas oil')).toBe('diesel');
		expect(fuelOf('1 L petrol')).toBe('gasoline');
		expect(fuelOf('1 L jet fuel')).toBe('kerosene');
	});
});

describe('a variant answers with its own numbers', () => {
	it('red diesel emits more per litre than road diesel (2.75541 vs 2.57082)', () => {
		expect(Number(co2ePerLitre('1 L red diesel')?.raw)).toBeCloseTo(2.75541, 5);
		expect(Number(co2ePerLitre('1 L diesel')?.raw)).toBeCloseTo(2.57082, 5);
	});

	it('red diesel is denser than road diesel (853.971 vs 832.361 kg/m3)', () => {
		const mass = allResults('1 L red diesel').find(
			(r) => r.category === 'mass' && r.unit_id === 'kilogram'
		);
		expect(Number(mass?.raw)).toBeCloseTo(0.853971, 6);
		expect(mass?.source_refs).toContain('uk-desnz-ghg-2025');
	});

	it('burning oil is not answered with aviation-turbine-fuel numbers', () => {
		// Before ADR 0005 the kerosene entry (DESNZ "Aviation Turbine Fuel")
		// claimed "burning oil" as an alias, so a domestic heating query came back
		// with jet-fuel factors AND the high-altitude radiative-forcing warning.
		const out = converter.convertText('1 L burning oil');
		if ('error' in out) throw new Error('burning oil failed to parse');
		expect(Number(co2ePerLitre('1 L burning oil')?.raw)).toBeCloseTo(2.54016, 5);
		expect(out.warnings.join(' ')).not.toMatch(/radiative|altitude|aviation/i);
	});

	it('100% mineral petrol differs from forecourt petrol', () => {
		expect(Number(co2ePerLitre('1 L mineral petrol')?.raw)).toBeCloseTo(2.33984, 5);
		expect(Number(co2ePerLitre('1 L petrol')?.raw)).not.toBeCloseTo(2.33984, 5);
	});
});

describe('gas oil has no per-litre calorific value in the ledger', () => {
	// research-notes §4.3 records gas oil's CV per tonne only — which is a fact
	// about our transcription, not about what DESNZ publishes, and the two must
	// not be confused. The energy answer must still work, through the recorded
	// density, and must not borrow diesel's kWh/L figure.
	it('still converts a volume to energy, and not with diesel’s number', () => {
		// The LHV/NCV row comes first; the HHV/GCV row follows it.
		const kwh = allResults('1 L gas oil').find(
			(r) => r.category === 'energy' && r.unit_id === 'kilowatt_hour'
		);
		expect(kwh).toBeDefined();
		// 42.569 MJ/kg x 0.853971 kg/L = 36.3524... MJ = 10.0979... kWh.
		expect(Number(kwh!.raw)).toBeCloseTo(10.098, 2);
		// Diesel's own published figure is 9.905 kWh/L — it must not appear here.
		expect(Number(kwh!.raw)).not.toBeCloseTo(9.905, 3);
		expect(kwh!.source_refs).toContain('uk-desnz-ghg-2025');
	});
});

describe('catalog integrity for the new entries', () => {
	it('every variant carries density, a calorific value and factors', () => {
		for (const id of VARIANTS) {
			const fuel = fuels.find((f) => f.id === id);
			expect(fuel, id).toBeDefined();
			expect(fuel!.density, `${id} density`).toBeDefined();
			expect(fuel!.heating_values?.length ?? 0, `${id} heating values`).toBeGreaterThan(0);
			expect(fuel!.emission_factor_ids?.length ?? 0, `${id} factors`).toBeGreaterThan(0);
		}
	});

	it('related_fuels link both ways between a variant and its parent', () => {
		const related = (id: string) => fuels.find((f) => f.id === id)?.related_fuels ?? [];
		expect(related('gas-oil')).toContain('diesel');
		expect(related('diesel')).toContain('gas-oil');
		expect(related('kerosene')).toContain('burning-oil');
		expect(related('burning-oil')).toContain('kerosene');
	});

	it('CO2 stays below CO2e for the same variant and litre', () => {
		for (const id of VARIANTS) {
			const co2 = emissionFactors.find((f) => f.id === `${id}-co2-desnz`)!;
			const total = emissionFactors.find((f) => f.id === `${id}-co2e-desnz`)!;
			expect(co2, `${id} CO2 factor`).toBeDefined();
			expect(Number(co2.value), id).toBeLessThan(Number(total.value));
			expect(co2.pollutant).toBe('CO2');
			expect(total.pollutant).toBe('CO2e');
		}
	});
});
