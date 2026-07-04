import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '$lib/data/load-data';
import { UnitRegistry } from '$lib/units/registry';
import { convertWithinDimension } from '$lib/units/exact-conversions';
import type { Unit } from '$lib/conversion/types';

const registry = new UnitRegistry(loadDataBundle().units);

function u(id: string): Unit {
	const unit = registry.get(id);
	if (!unit) throw new Error(`unit ${id} missing from catalog`);
	return unit;
}

/** Convert `value` of `fromId` into `toId` and return the exact decimal string. */
function conv(value: string, fromId: string, toId: string): string {
	return convertWithinDimension(value, u(fromId), u(toId));
}

describe('exact energy conversions (rulebook §A, spec §13.1)', () => {
	it('1 kWh = 3.6 MJ', () => {
		expect(conv('1', 'kilowatt_hour', 'megajoule')).toBe('3.6');
	});

	it('1 MWh = 3.6 GJ', () => {
		expect(conv('1', 'megawatt_hour', 'gigajoule')).toBe('3.6');
	});

	it('1 Wh = 3600 J', () => {
		expect(conv('1', 'watt_hour', 'joule')).toBe('3600');
	});

	it('1000 kcal = 4 186 800 J (IT calorie)', () => {
		expect(conv('1000', 'kilocalorie', 'joule')).toBe('4186800');
	});

	it('food Calorie equals kcal (4186.8 J)', () => {
		expect(conv('1', 'food_calorie', 'joule')).toBe('4186.8');
	});

	it('1 BTU = 1055.05585262 J (IT BTU)', () => {
		expect(conv('1', 'btu', 'joule')).toBe('1055.05585262');
	});

	it('1 MMBTU = 1 000 000 BTU', () => {
		expect(conv('1', 'mmbtu', 'btu')).toBe('1000000');
	});

	it('1 therm = 100 000 BTU', () => {
		expect(conv('1', 'therm', 'btu')).toBe('100000');
	});

	it('1 toe = 41.868 GJ', () => {
		expect(conv('1', 'toe', 'gigajoule')).toBe('41.868');
	});

	it('1 tce = 29.3076 GJ', () => {
		expect(conv('1', 'tce', 'gigajoule')).toBe('29.3076');
	});

	it('1 boe = 5.8 MMBTU (US convention)', () => {
		expect(conv('1', 'boe', 'mmbtu')).toBe('5.8');
	});
});

describe('exact mass conversions', () => {
	it('1 tonne = 1000 kg', () => {
		expect(conv('1', 'tonne', 'kilogram')).toBe('1000');
	});

	it('1 kg = 2.204623 lb (approx check to 6 dp)', () => {
		const lb = Number(conv('1', 'kilogram', 'pound'));
		expect(lb).toBeCloseTo(2.2046226, 6);
	});

	it('1 lb = 0.45359237 kg exactly', () => {
		expect(conv('1', 'pound', 'kilogram')).toBe('0.45359237');
	});
});

describe('exact volume conversions', () => {
	it('1 L = 0.001 m³', () => {
		expect(conv('1', 'liter', 'cubic_meter')).toBe('0.001');
	});

	it('1 m³ = 1000 L', () => {
		expect(conv('1', 'cubic_meter', 'liter')).toBe('1000');
	});

	it('1 barrel = 42 US gallons', () => {
		expect(conv('1', 'barrel', 'us_gallon')).toBe('42');
	});

	it('1 barrel = 158.987294928 L', () => {
		expect(conv('1', 'barrel', 'liter')).toBe('158.987294928');
	});
});

describe('exact time conversions', () => {
	it('1 h = 3600 s', () => {
		expect(conv('1', 'hour', 'second')).toBe('3600');
	});

	it('1 year (Julian) = 31 557 600 s', () => {
		expect(conv('1', 'year', 'second')).toBe('31557600');
	});
});
