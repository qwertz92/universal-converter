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

describe('fuel → CO2 (rulebook §C.5, spec §13.4)', () => {
	it('1 L test diesel → 2.6 kg CO2 (factor 2.6 kg/L)', () => {
		const co2 = results('1 liter test diesel').find(
			(r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2'
		);
		expect(co2?.raw).toBe('2.6');
		expect(co2?.exactness).toBe('source_based');
		expect(co2?.source_refs).toContain('test-fixture');
	});

	it('a CO2 factor never produces a CO2e result (no derivation)', () => {
		const co2e = results('1 liter test diesel').find((r) => r.unit_id === 'kilogram_co2e');
		expect(co2e).toBeUndefined();
	});
});

describe('hydrogen combustion CO2 = 0 (rulebook §C.5, §D.15, spec §13.4)', () => {
	it('1 kg test hydrogen → 0 kg CO2, exact, combustion-only warning', () => {
		const rs = results('1 kg test hydrogen');
		const co2 = rs.find((r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2');
		expect(co2?.raw).toBe('0');
		expect(co2?.exactness).toBe('exact');
		const out = converter.convertText('1 kg test hydrogen');
		if ('error' in out) throw new Error('parse failed');
		expect(out.warnings.some((w) => w.kind === 'hydrogen_combustion_only')).toBe(true);
	});
});

describe('biogenic CO2 reported separately (rulebook §C.5, §D.14)', () => {
	it('1 kg test wood pellets → biogenic CO2 line + biogenic warning', () => {
		const rs = results('1 kg test wood pellets');
		const biogenic = rs.find((r) => r.category === 'emissions' && r.raw === '1.8');
		expect(biogenic).toBeDefined();
		const out = converter.convertText('1 kg test wood pellets');
		if ('error' in out) throw new Error('parse failed');
		expect(out.warnings.some((w) => w.kind === 'biogenic_co2')).toBe(true);
	});
});

describe('electricity → context_required (rulebook §C.6, spec §13.4)', () => {
	it('1 kWh test electricity → emissions context_required (region+year)', () => {
		const rs = results('1 kWh test electricity');
		const emissions = rs.find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('context_required');
		expect(emissions?.missing).toEqual(expect.arrayContaining(['region', 'year']));
		// No headline emission number without context.
		expect(emissions?.value).toBeNull();
	});
});

describe('fuel with no emission factor → not available (spec §8.5, §17.24)', () => {
	it('1 kg test hydrogen upstream emissions are not invented', () => {
		// Hydrogen has no upstream factor in the fixture → only the combustion-zero line.
		const emissions = results('1 kg test hydrogen').filter((r) => r.category === 'emissions');
		// Exactly one emissions entry: the exact zero-combustion line.
		expect(emissions.filter((r) => r.value !== null)).toHaveLength(1);
	});
});
