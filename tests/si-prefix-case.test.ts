/**
 * In a unit symbol, case is meaning: m is milli (10^-3) and M is mega (10^6);
 * p is pico (10^-12) and P is peta (10^15). The registry fell back to a
 * case-insensitive match whenever the exact spelling was missing, and the
 * catalog even listed "mw", "mwh", "mj" and "pj" as aliases of the MEGA/PETA
 * units — so "5 mW" was calculated as 5 megawatts (10^9 too much) and "5 ML"
 * as 5 millilitres (10^12 too little), with no warning.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '#lib/index.js';
import { buildUnitSlugAliases } from '#lib/ui/unit-slugs.js';
import { loadDataBundle } from '#lib/index.js';

const converter = getConverter();

function unitOf(input: string): string {
	const out = converter.parse(input);
	if (!out.ok) throw new Error(`${input}: ${out.error.message}`);
	return out.query.unit_id;
}

function errorOf(input: string) {
	const out = converter.parse(input);
	if (out.ok) throw new Error(`${input} parsed as ${out.query.unit_id}`);
	return out.error;
}

describe('milli and mega are different units', () => {
	it.each([
		['5 mW', 'milliwatt'],
		['5 MW', 'megawatt'],
		['5 mJ', 'millijoule'],
		['5 MJ', 'megajoule'],
		['5 mWh', 'milliwatt_hour'],
		['5 MWh', 'megawatt_hour'],
		['5 milliwatt', 'milliwatt'],
		['5 Megawatt', 'megawatt'],
		// Words carry no case meaning: only a symbol's first letter is a prefix.
		['5 Megawatts', 'megawatt'],
		['5 MEGAWATTS', 'megawatt'],
		['5 Milliliters', 'milliliter'],
		['5 Megajoules', 'megajoule'],
		['5 Metric tons', 'tonne']
	])('%s → %s', (input, unit) => {
		expect(unitOf(input)).toBe(unit);
	});

	it('converts milliwatts to watts, not megawatts', () => {
		const out = converter.convertText('5 mW to W');
		if ('error' in out) throw new Error(out.error.message);
		const row = out.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.raw).toBe('0.005');
	});

	it.each(['5 mw', '5 Mw', '5 mwh', '5 MWH', '5 mj'])(
		'%s could be either — the tool asks instead of picking',
		(input) => {
			const error = errorOf(input);
			expect(error.kind).toBe('ambiguous_unit');
			const ids = (error.interpretations ?? []).map((i) => i.unit_id).sort();
			expect(ids.length).toBe(2);
			expect(ids.some((id) => id.startsWith('milli'))).toBe(true);
			expect(ids.some((id) => id.startsWith('mega'))).toBe(true);
		}
	);

	it.each([
		['5 ML', 'mega'],
		['5 pJ', 'pico'],
		// Not an SI-system unit in the catalog (a display unit), same rule:
		// mJ/kg would be a millijoule per kilogram, 10^9 below MJ/kg.
		['5 mJ/kg', 'milli'],
		['5 mJ/L', 'milli'],
		// Any spelling of the rest: the lowercase m before a capital J is the
		// writer using case, so it is read as milli, whatever follows.
		['5 mJ/l', 'milli'],
		['5 mJ/KG', 'milli'],
		['5 mJ/litre', 'milli'],
		['5 mJ/M3', 'milli']
	])(
		'%s names a unit the catalog lacks — refused, never read as its case twin',
		(input, prefix) => {
			const error = errorOf(input);
			expect(error.kind).toBe('unknown_unit');
			expect(`${error.message} ${error.hint ?? ''}`).toMatch(new RegExp(prefix, 'i'));
		}
	);

	it.each([
		['1 kwh', 'kilowatt_hour'],
		['1 KWH', 'kilowatt_hour'],
		['1 ml', 'milliliter'],
		['1 mL', 'milliliter'],
		['1 mg', 'milligram'],
		['1 Mg', 'tonne'],
		['1 PJ', 'petajoule'],
		['1 MMBTU', 'mmbtu'],
		['1 mmbtu', 'mmbtu'],
		['1 Mtoe', 'mtoe'],
		['1 mtoe', 'mtoe']
	])('unchanged: %s → %s', (input, unit) => {
		expect(unitOf(input)).toBe(unit);
	});
});

describe('short unit URLs never cross a prefix', () => {
	const aliases = buildUnitSlugAliases(loadDataBundle().units);
	// Both readings are plausible for a lowercase URL, so neither gets it.
	it.each(['mw', 'mwh', 'mj', 'pj'])('/units/%s is not a shortcut to either prefix', (slug) => {
		expect(aliases.get(slug)).toBeUndefined();
	});
	it('keeps the shortcuts that are not ambiguous', () => {
		expect(aliases.get('kwh')).toBe('kilowatt_hour');
		expect(aliases.get('gwh')).toBe('gigawatt_hour');
	});
});

it('"5 mJ per kg" reads mJ as millijoule, never as the MJ/kg unit', () => {
	const out = converter.parse('5 mJ per kg');
	expect(out.ok && out.query.unit_id === 'mj_per_kg').toBe(false);
});

describe('the lowercase convention for energy density stays', () => {
	it.each([
		['5 MJ/kg', 'mj_per_kg'],
		['5 mj/kg', 'mj_per_kg'],
		['5 Mtoe', 'mtoe'],
		['5 mtoe', 'mtoe'],
		['5 mmBtu', 'mmbtu'],
		['5 Mmbtu', 'mmbtu'],
		['5 MM BTU', 'mmbtu'],
		// The capital belongs to the denominator, not to the prefix.
		['5 mj/L', 'mj_per_l'],
		['5 mj/KG', 'mj_per_kg'],
		['5 MTOE', 'mtoe'],
		// No prefix in sight: minute is not a mega-unit.
		['5 Min', 'minute'],
		['5 MILLIGRAMS', 'milligram'],
		['5 MEGAJOULES', 'megajoule']
	])('%s → %s', (input, unit) => {
		expect(unitOf(input)).toBe(unit);
	});
});
