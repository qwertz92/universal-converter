import { describe, expect, it } from 'vitest';
import { createConverter } from '$lib/conversion/engine';
import { testBundle } from './fixtures/fuel-bundle';
import type { ConversionResult } from '$lib/conversion/types';

const converter = createConverter(testBundle());

function results(text: string): ConversionResult[] {
	const out = converter.convertText(text);
	if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results);
}

function find(text: string, pred: (r: ConversionResult) => boolean): ConversionResult | undefined {
	return results(text).find(pred);
}

describe('fuel volume → mass via density (rulebook §B.3)', () => {
	it('1 L test diesel → 0.84 kg (density 0.84 kg/L)', () => {
		// 1 L = 0.001 m³ × 840 kg/m³ = 0.84 kg
		const mass = find(
			'1 liter test diesel',
			(r) => r.category === 'mass' && r.unit_id === 'kilogram'
		);
		expect(mass?.raw).toBe('0.84');
		expect(mass?.exactness).toBe('source_based');
		expect(mass?.source_refs).toContain('test-fixture');
	});

	it('the density assumption is attached and labeled', () => {
		const out = converter.convertText('1 liter test diesel');
		if ('error' in out) throw new Error('parse failed');
		const hasDensityAssumption = out.assumptions.some((a) => a.kind === 'density');
		expect(hasDensityAssumption).toBe(true);
	});
});

describe('fuel volume → energy via heating value (rulebook §C.1)', () => {
	it('1 L test diesel → 36 MJ (LHV 36 MJ/L, default basis)', () => {
		const mj = find(
			'1 liter test diesel',
			(r) =>
				r.category === 'energy' &&
				r.unit_id === 'megajoule' &&
				!/secondary/i.test(r.warnings.map((w) => w.text).join(''))
		);
		expect(mj?.raw).toBe('36');
		expect(mj?.exactness).toBe('source_based');
	});

	it('default basis is LHV and it is labeled', () => {
		const out = converter.convertText('1 liter test diesel');
		if ('error' in out) throw new Error('parse failed');
		const basisAssumption = out.assumptions.find((a) => a.kind === 'heating_value_basis');
		expect(basisAssumption?.text).toMatch(/LHV/i);
	});

	it('HHV is shown alongside when data has it (36 MJ LHV vs 38.5 MJ HHV)', () => {
		const energyResults = results('1 liter test diesel').filter(
			(r) => r.category === 'energy' && r.unit_id === 'megajoule'
		);
		const raws = energyResults.map((r) => r.raw);
		expect(raws).toContain('36'); // LHV
		expect(raws).toContain('38.5'); // HHV alongside
	});

	it('honours a user HHV basis toggle (38.5 MJ)', () => {
		const out = converter.convert(
			{
				value: '1',
				unit_id: 'liter',
				dimension: 'volume',
				fuel_id: 'test-diesel',
				confidence: 1,
				original_input: '1 L test diesel'
			},
			{ basis: 'hhv' }
		);
		const primaryMj = out.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.unit_id === 'megajoule' && r.formula);
		expect(primaryMj?.raw).toBe('38.5');
	});
});

describe('fuel mass → energy (rulebook §C.8 fuel+mass)', () => {
	it('1 kg test hydrogen → 120 MJ (LHV 120 MJ/kg)', () => {
		const mj = find(
			'1 kg test hydrogen',
			(r) => r.category === 'energy' && r.unit_id === 'megajoule'
		);
		expect(mj?.raw).toBe('120');
	});

	it('1 kg test hydrogen → 120 MJ ÷ 3.6 = 33.33 kWh', () => {
		const kwh = find(
			'1 kg test hydrogen',
			(r) => r.category === 'energy' && r.unit_id === 'kilowatt_hour'
		);
		expect(Number(kwh?.raw)).toBeCloseTo(120 / 3.6, 6);
	});
});

describe('natural gas m³ → energy carries the billing warning (rulebook §C.2)', () => {
	it('1 m³ test natural gas → 10 kWh with a billing warning', () => {
		const out = converter.convertText('1 m3 test natural gas');
		if ('error' in out) throw new Error('parse failed');
		const kwh = out.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.unit_id === 'kilowatt_hour');
		expect(kwh?.raw).toBe('10');
		expect(kwh?.exactness).toBe('source_based'); // never 'exact' for gas
		expect(out.warnings.some((w) => /billing|Brennwert|Zustandszahl/i.test(w.text))).toBe(true);
	});
});

describe('pure energy input result groups (rulebook §C.8)', () => {
	it('1 kWh shows fuel-equivalent (toe/boe/tce) and industrial (therm/MMBTU/quad) groups', () => {
		const out = converter.convertText('1 kWh');
		if ('error' in out) throw new Error('parse failed');
		const keys = out.groups.map((g) => g.key);
		expect(keys).toContain('energy');
		expect(keys).toContain('fuel_equivalents');
		expect(keys).toContain('industrial_units');
		// No mass/volume/emissions without a fuel context.
		expect(keys).not.toContain('emissions');
	});

	it('groups appear in canonical order', () => {
		const out = converter.convertText('1 kWh');
		if ('error' in out) throw new Error('parse failed');
		const order = ['energy', 'fuel_equivalents', 'industrial_units'];
		const positions = order.map((k) => out.groups.findIndex((g) => g.key === k));
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
	});
});
