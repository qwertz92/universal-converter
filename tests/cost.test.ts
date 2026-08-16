/**
 * User-supplied prices (roadmap 0.3 "electricity/gas price calculator").
 *
 * The roadmap parked these calculators because no citable dataset makes a
 * shipped tariff true for any given reader. That is a reason not to ship a
 * DEFAULT price — not a reason to refuse to multiply by one the reader typed
 * themselves. So: the catalog still carries no tariffs, the currency is a label
 * that is never converted, and a cost is never more exact than the quantity it
 * rests on.
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

function cost(input: string): ConversionResult | undefined {
	return set(input)
		.groups.flatMap((g) => g.results)
		.find((r) => r.category === 'cost');
}

function errorFor(input: string) {
	const out = converter.convertText(input);
	if (!('error' in out)) throw new Error(`"${input}" unexpectedly parsed`);
	return out.error;
}

describe('a price the user typed becomes a cost', () => {
	it('1000 kWh at 0.32 EUR/kWh → 320.00 EUR', () => {
		const c = cost('1000 kWh at 0.32 EUR/kWh');
		expect(c?.raw).toBe('320');
		expect(c?.value).toBe('~320.00');
		expect(c?.unit_label).toBe('EUR');
	});

	it('accepts the @ form, a currency symbol and a comma decimal', () => {
		expect(cost('1000 kWh @ 0,32 €/kWh')?.raw).toBe('320');
		expect(cost('100 kWh at 0.28 $/kWh')?.unit_label).toBe('$');
	});

	it('prices a fuel through the conversion the engine already did', () => {
		// 1 L diesel = 9.905 kWh (DESNZ Net CV) × 0.10 = 0.9905 → 0.99.
		const c = cost('1 L diesel at 0.10 EUR/kWh');
		expect(c?.value).toBe('~0.99');
	});

	it('prices gas per kWh even though the query is in cubic metres', () => {
		// This is the actual heating-bill case: gas is metered in m³ and billed
		// per kWh, so the cost depends on the calorific value in between.
		const c = cost('100 m3 natural gas at 0.09 EUR/kWh');
		expect(c).toBeDefined();
		expect(Number(c!.raw)).toBeGreaterThan(0);
		// A cost always badges `user_assumption`, whatever the rest of the chain
		// was. EXACTNESS_ORDER deliberately ranks a user assumption ABOVE
		// source_based — the reader's own tariff is exact FOR THEM — so the
		// documented floor would have returned `source_based` here, putting a
		// provenance claim on a figure that rests on a tariff nobody sourced. The
		// badge is what a reader scans; the underlying quality goes in the text.
		expect(c!.exactness).toBe('user_assumption');
		expect(c!.explanation).toContain('source based');
	});

	it('rounds money to the cent but keeps full precision in raw', () => {
		const c = cost('3 kWh at 0.333333 EUR/kWh');
		expect(c?.value).toBe('~1.00');
		expect(c?.raw).toBe('0.999999');
	});
});

describe('the price never makes a result look more certain than it is', () => {
	it('a cost on an exact quantity is still only a user assumption', () => {
		expect(cost('1000 kWh at 0.32 EUR/kWh')?.exactness).toBe('user_assumption');
	});

	it('names the rate as the user’s own figure in the assumptions', () => {
		const s = set('1000 kWh at 0.32 EUR/kWh');
		const note = s.assumptions.find((a) => a.kind === 'user_input');
		expect(note?.text).toContain('0.32');
		expect(note?.text).toContain('carries no tariffs');
	});

	it('shows the multiplication it performed', () => {
		expect(cost('1000 kWh at 0.32 EUR/kWh')?.formula).toContain('× 0.32 EUR/kWh');
	});
});

describe('a price it cannot apply says so instead of pricing something else', () => {
	it('a bare volume with a per-kWh price asks for the material', () => {
		const c = cost('100 L at 0.09 EUR/kWh');
		expect(c?.exactness).toBe('context_required');
		expect(c?.value).toBeNull();
		expect(c?.explanation).toMatch(/name it|material|diesel/i);
	});

	it('a per-unit price whose unit is unknown is refused with the reason', () => {
		const e = errorFor('1000 kWh at 0.32 EUR/flurb');
		expect(e.kind).toBe('unknown_unit');
		expect(e.message).toContain('flurb');
	});

	it('a negative price is refused rather than producing a negative bill', () => {
		expect(errorFor('1000 kWh at -0.32 EUR/kWh').kind).toBe('unsupported_value');
	});
});

describe('currency is a label, never a conversion', () => {
	it('echoes whatever currency was written, without interpreting it', () => {
		expect(cost('1 kWh at 5 CHF/kWh')?.unit_label).toBe('CHF');
		expect(cost('1 kWh at 5 zł/kWh')?.unit_label).toBe('zł');
	});

	it('still refuses currency CONVERSION as out of scope', () => {
		// The pricing feature must not be read as "this tool does money now".
		const e = errorFor('100 EUR to USD');
		expect(e.message).toMatch(/currency|price/i);
	});
});

describe('the price clause does not disturb the rest of the grammar', () => {
	it('leaves queries without a price completely alone', () => {
		expect(cost('1000 kWh')).toBeUndefined();
		expect(cost('1 L diesel')).toBeUndefined();
	});

	it('does not mistake "at" in other positions for a price', () => {
		// No slash, so this is not a price clause and must not be eaten.
		const out = converter.convertText('1 kWh at 3 kWh');
		expect('error' in out).toBe(true);
	});

	it('combines with a target and a duration', () => {
		const c = cost('5 kW for 3 h at 0.30 EUR/kWh');
		expect(c?.raw).toBe('4.5');
	});
});
