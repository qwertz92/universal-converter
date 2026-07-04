/**
 * §13.1 EXACT UNITS — extended coverage beyond tests/exact-conversions.test.ts:
 * round-trip stability (x -> y -> x within decimal.js precision), chained
 * conversions across >2 units, additional energy-unit definitional identities
 * (quad, ktoe, Mtoe, kBTU, Wh/MWh/GWh/TWh family), and additional mass/volume
 * pairs (short ton, long ton, imperial gallon, cubic foot).
 *
 * Does NOT duplicate the base identities already asserted in
 * tests/exact-conversions.test.ts (1 kWh=3.6MJ, 1 barrel=42 US gal, etc.).
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { loadDataBundle } from '$lib/data/load-data';
import { UnitRegistry } from '$lib/units/registry';
import { convertWithinDimension } from '$lib/units/exact-conversions';
import type { Unit } from '$lib/conversion/types';

Decimal.set({ precision: 40 });

const registry = new UnitRegistry(loadDataBundle().units);

function u(id: string): Unit {
	const unit = registry.get(id);
	if (!unit) throw new Error(`unit ${id} missing from catalog`);
	return unit;
}

function conv(value: string, fromId: string, toId: string): string {
	return convertWithinDimension(value, u(fromId), u(toId));
}

describe('§13.1 exact units — additional definitional identities', () => {
	it('1 quad = 10^15 BTU_IT exactly', () => {
		expect(conv('1', 'quad', 'btu')).toBe('1000000000000000');
	});

	it('1 ktoe = 1000 toe exactly', () => {
		expect(conv('1', 'ktoe', 'toe')).toBe('1000');
	});

	it('1 Mtoe = 1,000,000 toe exactly', () => {
		expect(conv('1', 'mtoe', 'toe')).toBe('1000000');
	});

	it('1 kBTU = 1000 BTU exactly', () => {
		expect(conv('1', 'kilobtu', 'btu')).toBe('1000');
	});

	it('1 GWh = 1000 MWh exactly', () => {
		expect(conv('1', 'gigawatt_hour', 'megawatt_hour')).toBe('1000');
	});

	it('1 TWh = 1000 GWh exactly', () => {
		expect(conv('1', 'terawatt_hour', 'gigawatt_hour')).toBe('1000');
	});

	it('1 MWh = 1,000,000 Wh exactly', () => {
		expect(conv('1', 'megawatt_hour', 'watt_hour')).toBe('1000000');
	});

	it('1 toe = 1.428571... tce (rulebook §C.3 cross-check, not stored directly)', () => {
		// 41.868 GJ / 29.3076 GJ = 10/7 exactly (both are exact decimal constants).
		const ratio = new Decimal(conv('1', 'toe', 'joule')).div(
			new Decimal(conv('1', 'tce', 'joule'))
		);
		expect(ratio.toDecimalPlaces(10).toNumber()).toBeCloseTo(10 / 7, 9);
	});
});

describe('§13.1 exact units — additional mass/volume pairs', () => {
	it('1 short ton = 907.18474 kg exactly (US ton, distinct from tonne)', () => {
		expect(conv('1', 'short_ton', 'kilogram')).toBe('907.18474');
	});

	it('1 long ton = 1016.0469088 kg exactly (UK ton, distinct from tonne and short ton)', () => {
		expect(conv('1', 'long_ton', 'kilogram')).toBe('1016.0469088');
	});

	it('short ton != long ton != tonne (three genuinely different masses)', () => {
		const short = Number(conv('1', 'short_ton', 'kilogram'));
		const long = Number(conv('1', 'long_ton', 'kilogram'));
		const metric = Number(conv('1', 'tonne', 'kilogram'));
		expect(new Set([short, long, metric]).size).toBe(3);
	});

	it('1 imperial gallon = 4.54609 L exactly (distinct from US gallon)', () => {
		expect(conv('1', 'imperial_gallon', 'liter')).toBe('4.54609');
	});

	it('US gallon and imperial gallon differ by ~20% (rulebook D.10)', () => {
		const us = Number(conv('1', 'us_gallon', 'liter'));
		const imp = Number(conv('1', 'imperial_gallon', 'liter'));
		expect((imp - us) / us).toBeCloseTo(0.2009, 3);
	});

	it('1 cubic foot converts to litres via the exact NIST factor', () => {
		const liters = Number(conv('1', 'cubic_foot', 'liter'));
		expect(liters).toBeCloseTo(28.316846592, 6);
	});
});

describe('§13.1 round-trip stability (x -> y -> x within decimal.js precision)', () => {
	const pairs: Array<[string, string, string]> = [
		['1', 'kilowatt_hour', 'megajoule'],
		['3.14159', 'btu', 'joule'],
		['1000', 'therm', 'gigajoule'],
		['1', 'boe', 'toe'],
		['0.001', 'barrel', 'us_gallon'],
		['1', 'pound', 'kilogram'],
		['7', 'imperial_gallon', 'cubic_meter'],
		['1', 'short_ton', 'long_ton']
	];

	it.each(pairs)(
		'%s %s -> %s -> back is a no-op (within 1e-25 relative)',
		(value, fromId, toId) => {
			const forward = conv(value, fromId, toId);
			const back = conv(forward, toId, fromId);
			const original = new Decimal(value);
			const roundTripped = new Decimal(back);
			const relError = roundTripped
				.minus(original)
				.abs()
				.div(original.abs().gt(0) ? original.abs() : 1);
			expect(relError.toNumber()).toBeLessThan(1e-25);
		}
	);
});

describe('§13.1 chained conversions (>2 hops stay exact/standard_definition)', () => {
	it('1 GWh -> kWh -> MJ -> GJ chain matches the direct GWh -> GJ conversion', () => {
		const step1 = conv('1', 'gigawatt_hour', 'kilowatt_hour');
		const step2 = conv(step1, 'kilowatt_hour', 'megajoule');
		const step3 = conv(step2, 'megajoule', 'gigajoule');
		const direct = conv('1', 'gigawatt_hour', 'gigajoule');
		expect(new Decimal(step3).toDecimalPlaces(6).toNumber()).toBeCloseTo(
			new Decimal(direct).toDecimalPlaces(6).toNumber(),
			6
		);
	});

	it('1 quad -> MMBTU -> therm -> BTU chain matches the direct quad -> BTU conversion', () => {
		const step1 = conv('1', 'quad', 'mmbtu');
		const step2 = conv(step1, 'mmbtu', 'therm');
		const step3 = conv(step2, 'therm', 'btu');
		const direct = conv('1', 'quad', 'btu');
		expect(new Decimal(step3).toFixed(0)).toBe(new Decimal(direct).toFixed(0));
	});

	it('1 tonne -> lb -> short ton -> kg chain round-trips to 1000 kg', () => {
		const step1 = conv('1', 'tonne', 'pound');
		const step2 = conv(step1, 'pound', 'short_ton');
		const step3 = conv(step2, 'short_ton', 'kilogram');
		expect(new Decimal(step3).toDecimalPlaces(9).toNumber()).toBeCloseTo(1000, 6);
	});
});
