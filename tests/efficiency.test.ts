/**
 * User-supplied appliance efficiency (roadmap 0.3 "boiler efficiency, heat pump
 * COP").
 *
 * Same licence as prices: the catalog ships no efficiency table, because real
 * boilers and heat pumps vary far too widely for a default to be true of
 * anyone — but the number on someone's own data plate is theirs to use. The
 * energy going IN is never replaced by the energy delivered; both stay on
 * screen, because they are two different facts.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import type { ConversionResult, ConversionResultSet } from '$lib/conversion/types';

const converter = getConverter();

function set(input: string): ConversionResultSet {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out;
}

function delivered(input: string): ConversionResult | undefined {
	return set(input)
		.groups.flatMap((g) => g.results)
		.find((r) => r.category === 'delivered');
}

describe('a boiler efficiency the user typed', () => {
	it('100 kWh at 85% efficiency delivers 85 kWh', () => {
		const d = delivered('100 kWh at 85% efficiency');
		expect(d?.raw).toBe('85');
		expect(d?.unit_label).toBe('kWh');
	});

	it.each([
		'100 kWh at 85% efficiency',
		'100 kWh 85% efficient',
		'100 kWh with 85% efficiency',
		'100 kWh @ 85 % efficiency'
	])('accepts the phrasing "%s"', (query) => {
		expect(delivered(query)?.raw).toBe('85');
	});

	it('applies to fuel energy derived through the calorific value', () => {
		// 1 L diesel = 9.905 kWh (DESNZ Net CV); at 90% that is 8.9145 kWh.
		const d = delivered('1 L diesel at 90% efficiency');
		expect(d).toBeDefined();
		expect(Number(d!.raw)).toBeCloseTo(8.9145, 3);
	});

	it('keeps the energy going IN alongside the energy delivered', () => {
		const results = set('100 kWh at 85% efficiency').groups.flatMap((g) => g.results);
		expect(results.find((r) => r.category === 'energy' && r.raw === '100')).toBeDefined();
		expect(results.find((r) => r.category === 'delivered')?.raw).toBe('85');
	});
});

describe('a heat-pump COP', () => {
	it('100 kWh at 3.5 COP delivers 350 kWh', () => {
		expect(delivered('100 kWh at 3.5 COP')?.raw).toBe('350');
	});

	it.each(['100 kWh at 3.5 COP', '100 kWh COP 3.5', '100 kWh with a COP of 3.5'])(
		'accepts the phrasing "%s"',
		(query) => {
			expect(delivered(query)?.raw).toBe('350');
		}
	);

	it('does not warn about exceeding 100% — moving heat is not making it', () => {
		const d = delivered('100 kWh at 3.5 COP');
		expect(d?.warnings ?? []).toHaveLength(0);
	});

	it('a percentage above 100 DOES ask which was meant', () => {
		const d = delivered('100 kWh at 350% efficiency');
		expect(d?.raw).toBe('350');
		expect(d?.warnings[0]?.text).toMatch(/heat pump|COP|gross calorific/i);
	});
});

describe('the efficiency never overstates how certain the answer is', () => {
	it('an exact energy at a user efficiency is a user assumption', () => {
		expect(delivered('100 kWh at 85% efficiency')?.exactness).toBe('user_assumption');
	});

	it('names the figure as the user’s own', () => {
		const note = set('100 kWh at 85% efficiency').assumptions.find((a) => a.kind === 'user_input');
		expect(note?.text).toContain('85%');
		expect(note?.text).toContain('ships no efficiency table');
	});

	it('shows the multiplication it performed', () => {
		expect(delivered('100 kWh at 85% efficiency')?.formula).toContain('0.85');
	});
});

describe('refusals and non-interference', () => {
	it('a zero efficiency is refused rather than delivering nothing silently', () => {
		const out = converter.convertText('100 kWh at 0% efficiency');
		expect('error' in out).toBe(true);
	});

	it('a bare percentage is NOT read as an efficiency', () => {
		// Otherwise a stray "%" anywhere would quietly change the answer.
		expect(delivered('100 kWh')).toBeUndefined();
		const out = converter.convertText('100 kWh 85%');
		if (!('error' in out)) {
			expect(out.groups.flatMap((g) => g.results).some((r) => r.category === 'delivered')).toBe(
				false
			);
		}
	});

	it('leaves ordinary queries untouched', () => {
		expect(delivered('1 L diesel')).toBeUndefined();
		expect(delivered('5 kW for 3 h')).toBeUndefined();
	});
});

describe('efficiency and price compose', () => {
	it('100 kWh gas at 90% efficiency at 0.09 EUR/kWh prices the gas, not the heat', () => {
		// The bill is for what you buy; the heat is what you get. Both appear.
		const results = set('100 kWh natural gas at 90% efficiency at 0.09 EUR/kWh').groups.flatMap(
			(g) => g.results
		);
		expect(results.find((r) => r.category === 'delivered')?.raw).toBe('90');
		expect(results.find((r) => r.category === 'cost')?.raw).toBe('9');
	});
});
