/**
 * Engine/parser robustness (0.2 stabilization pass): input guards, option
 * clamping, negative/zero/huge values, exactness-labeling fixes (global-region
 * factors, wide-spread heating values), per-target-unit converted ranges, the
 * time group, and defensive convert() behavior. Complements the happy-path
 * suites; every case here traces to an audit finding.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { getConverter } from '$lib/index';
import { formatValue } from '$lib/formatting/numbers';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();

function results(input: string, options = {}): ConversionResult[] {
	const out = converter.convertText(input, options);
	if ('error' in out) throw new Error(`"${input}" failed: ${JSON.stringify(out.error)}`);
	return out.groups.flatMap((g) => g.results);
}

describe('parser input guards', () => {
	it('".5 kWh" parses as 0.5 kWh (leading-dot decimal)', () => {
		const r = results('.5 kWh').find((x) => x.unit_id === 'megajoule');
		expect(r?.raw).toBe('1.8'); // 0.5 kWh = 1.8 MJ
	});

	it('",5 kWh" parses as 0.5 kWh (leading-comma decimal)', () => {
		const r = results(',5 kWh').find((x) => x.unit_id === 'megajoule');
		expect(r?.raw).toBe('1.8');
	});

	it('"5. kWh" tolerates the dangling separator', () => {
		const r = results('5. kWh').find((x) => x.unit_id === 'megajoule');
		expect(r?.raw).toBe('18');
	});

	it('"1e100000 kWh" is rejected as unsupported_value, not processed', () => {
		const out = converter.convertText('1e100000 kWh');
		expect('error' in out && out.error.kind).toBe('unsupported_value');
	});

	it('"1e-100 kWh" (absurdly tiny) is rejected as unsupported_value', () => {
		const out = converter.convertText('1e-100 kWh');
		expect('error' in out && out.error.kind).toBe('unsupported_value');
	});

	it('a 5000-character input is rejected without a Levenshtein sweep', () => {
		const out = converter.convertText('1 ' + 'x'.repeat(5000));
		expect('error' in out && out.error.kind).toBe('unsupported_value');
	});

	it('unknown units still get suggestions (lazy suggest path)', () => {
		const out = converter.convertText('1 kilowatthours');
		if (!('error' in out)) {
			// If the alias actually matches, that's fine too — assert the happy parse.
			expect(out.groups.length).toBeGreaterThan(0);
			return;
		}
		expect(out.error.kind).toBe('unknown_unit');
		expect(out.error.suggestions?.length ?? 0).toBeGreaterThan(0);
	});
});

describe('value edge cases', () => {
	it('"0 kWh" converts to exact zeros without error', () => {
		const r = results('0 kWh').find((x) => x.unit_id === 'megajoule');
		expect(r?.raw).toBe('0');
		expect(r?.exactness).toBe('exact');
	});

	it('"-5 L diesel" flows through the fuel pipeline with negative results', () => {
		const mass = results('-5 L diesel').find(
			(r) => r.category === 'mass' && r.unit_id === 'kilogram'
		);
		expect(Number(mass?.raw)).toBeCloseTo(-4.161805, 5);
	});

	it('negative values format with the ~ after the minus handling intact', () => {
		expect(formatValue('-123.456', 'estimated')).toBe('~-123');
	});

	it('scientific notation "1.5e3 kWh" works end-to-end', () => {
		const r = results('1.5e3 kWh').find((x) => x.unit_id === 'megajoule');
		expect(r?.raw).toBe('5400');
	});
});

describe('EngineOptions hardening', () => {
	it('maxSigFigs: 0 does not throw (clamped) and 3 caps exact display', () => {
		expect(() => results('1 kWh', { maxSigFigs: 0 })).not.toThrow();
		const r = results('1 kWh', { maxSigFigs: 3 }).find((x) => x.unit_id === 'btu');
		// 3412.14 BTU → 3 sig figs → 3,410
		expect(r?.value).toBe('3,410');
	});

	it('maxSigFigs also reaches mass and volume rows (was silently ignored)', () => {
		const r = results('1 pound', { maxSigFigs: 2 }).find((x) => x.unit_id === 'kilogram');
		expect(r?.value).toBe('0.45'); // 0.45359237 capped to 2 sig figs
	});

	it('an unusable time unit falls back to the context_required prompt, not a vanished group', () => {
		const rows = results('5 kW', {
			time: { value: '3', unit_id: 'kilogram', dimension: 'mass' as const }
		});
		const energy = rows.find((r) => r.category === 'energy');
		expect(energy?.exactness).toBe('context_required');
		expect(energy?.missing).toContain('time');
	});

	it('grid region matching is case-insensitive ("uk" finds "UK")', () => {
		const r = results('1 kWh electricity', { region: 'uk', year: 2025 }).find(
			(x) => x.category === 'emissions'
		);
		expect(r?.exactness).toBe('region_year_specific');
		expect(r?.raw).toBe('0.177');
	});

	it('convert() with a hand-built garbage query returns a structured unsupported set, not a throw', () => {
		const out = converter.convert({
			value: 'not-a-number',
			unit_id: 'kilowatt_hour',
			dimension: 'energy',
			confidence: 1,
			original_input: 'garbage'
		});
		const all = out.groups.flatMap((g) => g.results);
		expect(all.some((r) => r.exactness === 'unsupported')).toBe(true);
	});
});

describe('exactness labeling fixes', () => {
	it('global-region IPCC factors are never labeled region_year_specific', () => {
		// "global" is a coverage statement, not a geographic specificity.
		for (const fuelQuery of ['1 kg lignite', '1 kg anthracite', '1 L crude oil']) {
			const fossil = results(fuelQuery)
				.filter((r) => r.category === 'emissions')
				.find((r) => r.unit_id === 'kilogram_co2');
			expect(fossil?.exactness, fuelQuery).not.toBe('region_year_specific');
		}
	});

	it('a per-energy factor inherits the exactness of the energy it was applied to', () => {
		// Lignite's own source records a 5.5–21.6 MJ/kg spread, so its energy is
		// `estimated`. The CO2 is that energy × a factor, and cannot be more
		// precise than its weakest input (rulebook §A, §C.7 rule 1). It used to
		// print as `source_based` with four significant figures.
		const co2 = results('1 kg lignite')
			.filter((r) => r.category === 'emissions')
			.find((r) => r.unit_id === 'kilogram_co2');
		expect(co2?.exactness).toBe('estimated');
		expect(co2?.value?.startsWith('~')).toBe(true);
	});

	it('a per-volume factor is unaffected by the energy path', () => {
		// Diesel's CO2 factor is kg per litre, so no heating value is on the path
		// and the energy spread cannot weaken it. It keeps the exactness its own
		// provenance earns (DESNZ, UK 2025 → region + year).
		const co2 = results('1 L diesel')
			.filter((r) => r.category === 'emissions')
			.find((r) => r.unit_id === 'kilogram_co2');
		expect(co2?.exactness).toBe('region_year_specific');
	});

	it('lignite energy (spread ratio ~3.9) is estimated with ~ and a CONVERTED per-unit range', () => {
		const rows = results('1 kg lignite').filter((r) => r.category === 'energy' && r.value !== null);
		const mj = rows.find((r) => r.unit_id === 'megajoule');
		const kwh = rows.find((r) => r.unit_id === 'kilowatt_hour');
		expect(mj?.exactness).toBe('estimated');
		expect(mj?.value?.startsWith('~')).toBe(true);
		// Range converted into each row's own unit: MJ row 5.5–21.6, kWh row
		// 5.5/3.6 = 1.5277… to 6. Bounds are rounded OUTWARD to the row's cap
		// (§C.7 rule 5), so the low bound floors to 1.52 rather than rounding up
		// to 1.53 and understating the spread.
		expect(mj?.range).toEqual({ low: '5.5', high: '21.6' });
		expect(kwh?.range?.low).toBe('1.52');
		expect(Number(kwh?.range?.low)).toBeLessThan(new Decimal('5.5').div('3.6').toNumber());
		expect(Number(kwh?.range?.high)).toBeGreaterThanOrEqual(6);
	});

	it('diesel (narrow/no spread) stays source_based', () => {
		const kwh = results('1 L diesel').find(
			(r) => r.category === 'energy' && r.unit_id === 'kilowatt_hour'
		);
		expect(kwh?.exactness).toBe('source_based');
	});
});

describe('result-group structure', () => {
	it('a bare time input gets a real Time group with time conversions', () => {
		const out = converter.convertText('2 h');
		if ('error' in out) throw new Error('parse failed');
		const time = out.groups.find((g) => g.key === 'time');
		expect(time).toBeDefined();
		const minutes = time?.results.find((r) => r.unit_id === 'minute');
		expect(minutes?.raw).toBe('120');
	});

	it('the first energy row for a pure energy input is the source unit itself', () => {
		const out = converter.convertText('1 kWh');
		if ('error' in out) throw new Error('parse failed');
		const energy = out.groups.find((g) => g.key === 'energy');
		expect(energy?.results[0]?.unit_id).toBe('kilowatt_hour');
	});

	it('a bare emission-intensity input lands in the Emissions group, not Energy', () => {
		const out = converter.convertText('177 gCO2e/kWh');
		if ('error' in out) throw new Error('parse failed');
		const emissions = out.groups.find((g) => g.key === 'emissions');
		expect(emissions?.results.some((r) => r.unit_id === 'g_co2e_per_kwh')).toBe(true);
	});

	it('"not available" rows carry a machine-readable missing[] marker', () => {
		// crude-oil has no density → volume input can't derive mass.
		const rows = results('1 L crude oil');
		const na = rows.find((r) => r.value === null && r.category === 'mass');
		expect(na?.missing).toEqual(['density']);
	});
});
