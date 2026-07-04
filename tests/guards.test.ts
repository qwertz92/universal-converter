import { describe, expect, it } from 'vitest';
import { createConverter } from '$lib/conversion/engine';
import { isCo2Co2eCrossing } from '$lib/emissions/co2-vs-co2e';
import { testBundle } from './fixtures/fuel-bundle';
import type { ConversionResult } from '$lib/conversion/types';

const converter = createConverter(testBundle());

function allResults(text: string): ConversionResult[] {
	const out = converter.convertText(text);
	if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results);
}

describe('power → energy guard (rulebook D.1, spec §9.1, §17.26)', () => {
	it('1 kW alone yields context_required for energy (no auto kWh)', () => {
		const results = allResults('1 kW');
		const energyCtx = results.find(
			(r) => r.category === 'energy' && r.exactness === 'context_required'
		);
		expect(energyCtx).toBeDefined();
		expect(energyCtx?.missing).toContain('time');
		// Crucially, NO numeric energy result is emitted without a time.
		const numericEnergy = results.find((r) => r.category === 'energy' && r.value !== null);
		expect(numericEnergy).toBeUndefined();
	});

	it('2 kW × 3 h = 6 kWh when a time is supplied', () => {
		const out = converter.convert(
			{
				value: '2',
				unit_id: 'kilowatt',
				dimension: 'power',
				confidence: 1,
				original_input: '2 kW'
			},
			{ time: { value: '3', unit_id: 'hour', dimension: 'time' } }
		);
		const energy = out.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.unit_id === 'kilowatt_hour');
		expect(energy?.raw).toBe('6');
		expect(energy?.exactness).toBe('exact');
	});
});

describe('CO2 ↔ CO2e separation (rulebook B.2, C.5, D.6)', () => {
	it('helper flags a CO2→CO2e crossing as illegal', () => {
		expect(isCo2Co2eCrossing('emission_mass_co2', 'emission_mass_co2e')).toBe(true);
		expect(isCo2Co2eCrossing('emission_mass_co2e', 'emission_mass_co2')).toBe(true);
		expect(isCo2Co2eCrossing('emission_mass_co2', 'emission_mass_co2')).toBe(false);
	});

	it('a kg CO2 input never produces a CO2e result', () => {
		const results = allResults('5 kg CO2');
		const co2e = results.find((r) => r.unit_id === 'kilogram_co2e' && r.value !== null);
		expect(co2e).toBeUndefined();
	});
});

describe('fuel-required context (rulebook §C.8)', () => {
	it('1 L with no fuel asks to pick a material', () => {
		const results = allResults('1 L');
		const ctx = results.find((r) => r.exactness === 'context_required');
		expect(ctx).toBeDefined();
		expect(ctx?.missing).toContain('fuel');
	});
});
