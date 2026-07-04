import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '$lib/data/load-data';
import { UnitRegistry } from '$lib/units/registry';
import { FuelRegistry } from '$lib/fuels/registry';
import { normalizeNumber, parseQuery } from '$lib/conversion/parser';
import { testBundle } from './fixtures/fuel-bundle';

const base = loadDataBundle();
const units = new UnitRegistry(base.units);
const noFuels = new FuelRegistry([]);
const withFuels = new FuelRegistry(testBundle().fuels);

function parse(text: string, fuels = noFuels) {
	return parseQuery(text, units, fuels);
}

describe('parser — numbers (spec §8.2)', () => {
	it('parses "1 kWh"', () => {
		const r = parse('1 kWh');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.query.value).toBe('1');
			expect(r.query.unit_id).toBe('kilowatt_hour');
		}
	});

	it('parses multi-word unit "1 kilowatt hour"', () => {
		const r = parse('1 kilowatt hour');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('parses "1000 kcal"', () => {
		const r = parse('1000 kcal');
		expect(r.ok && r.query.value).toBe('1000');
		expect(r.ok && r.query.unit_id).toBe('kilocalorie');
	});

	it('parses comma decimal "1,5 MJ" as 1.5', () => {
		const r = parse('1,5 MJ');
		expect(r.ok && r.query.value).toBe('1.5');
		expect(r.ok && r.query.unit_id).toBe('megajoule');
	});

	it('parses number glued to unit "1.5MJ"', () => {
		const r = parse('1.5MJ');
		expect(r.ok && r.query.value).toBe('1.5');
		expect(r.ok && r.query.unit_id).toBe('megajoule');
	});

	it('parses "1 m3 test natural gas" (fuel + m3 alias)', () => {
		const r = parse('1 m3 test natural gas', withFuels);
		expect(r.ok && r.query.unit_id).toBe('cubic_meter');
		expect(r.ok && r.query.fuel_id).toBe('test-natural-gas');
	});
});

describe('parser — fuels (spec §8.2)', () => {
	it('parses "1 liter diesel"', () => {
		const r = parse('1 liter test diesel', withFuels);
		expect(r.ok && r.query.unit_id).toBe('liter');
		expect(r.ok && r.query.fuel_id).toBe('test-diesel');
	});

	it('parses trailing multi-word fuel "2 kg wood pellets"', () => {
		const r = parse('2 kg test wood pellets', withFuels);
		expect(r.ok && r.query.unit_id).toBe('kilogram');
		expect(r.ok && r.query.fuel_id).toBe('test-pellets');
		expect(r.ok && r.query.value).toBe('2');
	});
});

describe('parser — errors (spec §8.2, §13.2)', () => {
	it('reports empty input', () => {
		const r = parse('   ');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('empty_input');
	});

	it('reports missing value', () => {
		const r = parse('kWh');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('missing_value');
	});

	it('reports a value with no unit', () => {
		const r = parse('42');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('no_unit');
	});

	it('reports unknown unit with suggestions', () => {
		const r = parse('1 kwhh');
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe('unknown_unit');
			expect(r.error.suggestions && r.error.suggestions.length).toBeGreaterThan(0);
		}
	});

	it('flags ambiguous "ton" with interpretations (rulebook D.9)', () => {
		const r = parse('1 ton');
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe('ambiguous_unit');
			const ids = (r.error.interpretations ?? []).map((i) => i.unit_id);
			expect(ids).toContain('tonne');
			expect(ids).toContain('short_ton');
			expect(ids).toContain('long_ton');
		}
	});

	it('flags ambiguous "gallon" (rulebook D.10)', () => {
		const r = parse('1 gallon');
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe('ambiguous_unit');
			const ids = (r.error.interpretations ?? []).map((i) => i.unit_id);
			expect(ids).toContain('us_gallon');
			expect(ids).toContain('imperial_gallon');
		}
	});

	it('notes the food-Calorie interpretation (rulebook C.4/D.7)', () => {
		const r = parse('1 Cal');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.query.unit_id).toBe('food_calorie');
			expect((r.query.notes ?? []).join(' ')).toMatch(/kcal/i);
		}
	});
});

describe('normalizeNumber', () => {
	it('handles comma decimal', () => {
		expect(normalizeNumber('1,5')).toBe('1.5');
	});
	it('handles thousands with comma', () => {
		expect(normalizeNumber('1,000')).toBe('1000');
	});
	it('handles mixed "1.234,56" (EU) as 1234.56', () => {
		expect(normalizeNumber('1.234,56')).toBe('1234.56');
	});
	it('handles mixed "1,234.56" (US) as 1234.56', () => {
		expect(normalizeNumber('1,234.56')).toBe('1234.56');
	});
});
