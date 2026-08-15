/**
 * A requested target must be ANSWERED, or told precisely why it cannot be
 * (rulebook §C.9). These cases all used to claim the catalog was missing data
 * that the very same response was computed from, or drop the request entirely.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import type { ConversionResult, EngineOptions } from '$lib/conversion/types';

const converter = getConverter();

function target(input: string, options?: EngineOptions): ConversionResult | undefined {
	const out = converter.convertText(input, options);
	if ('error' in out) throw new Error(`"${input}" failed: ${JSON.stringify(out.error)}`);
	return out.groups.flatMap((g) => g.results).find((r) => r.is_target);
}

describe('cross-dimension targets outside the display units', () => {
	it('"1 L diesel to t" answers in tonnes instead of claiming there is no density', () => {
		const r = target('1 L diesel to t');
		expect(r?.unit_id).toBe('tonne');
		// 1 L × 832.361 kg/m³ = 0.832361 kg = 0.000832361 t
		expect(Number(r?.raw)).toBeCloseTo(0.000832361, 9);
		expect(r?.exactness).toBe('source_based');
		expect(r?.explanation ?? '').not.toMatch(/not available/i);
	});

	it('the derived row keeps the provenance of the row it came from', () => {
		const r = target('1 L diesel to t');
		expect(r?.source_refs).toContain('uk-desnz-ghg-2025');
		expect(r?.assumptions.length).toBeGreaterThan(0);
	});

	it('"1 L diesel to therm" answers in therms instead of claiming there is no heating value', () => {
		const r = target('1 L diesel to therm');
		expect(r?.unit_id).toBe('therm');
		// 9.905 kWh = 35.658 MJ; 1 therm = 105.505585262 MJ
		expect(Number(r?.raw)).toBeCloseTo(0.33797, 4);
	});

	it('"1 kg diesel to gal" answers a volume', () => {
		const r = target('1 kg diesel to gal');
		expect(r?.unit_id).toBe('us_gallon');
		expect(Number(r?.raw)).toBeGreaterThan(0);
	});

	it('a genuinely missing property is still reported as missing', () => {
		// crude oil deliberately ships no density.
		const r = target('1 L crude oil to t');
		expect(r?.value).toBeNull();
		expect(r?.exactness).toBe('context_required');
	});
});

describe('power targets are answered, not dropped', () => {
	it('"5 kW to MJ" prompts for a duration in the requested unit', () => {
		const r = target('5 kW to MJ');
		expect(r).toBeDefined();
		expect(r?.unit_id).toBe('megajoule');
		expect(r?.exactness).toBe('context_required');
		expect(r?.missing).toContain('time');
	});

	it('"5 kW for 2 h to MJ" answers 36 MJ', () => {
		const r = target('5 kW for 2 h to MJ');
		expect(Number(r?.raw)).toBeCloseTo(36, 6);
		expect(r?.exactness).toBe('exact');
	});
});
