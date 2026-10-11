/**
 * "Did you mean": a misspelled slug or search ("natural gass") finds nothing in
 * the index, whose search matches substrings only. `closestMatches` offers the
 * nearest catalog names as suggestions. It never redirects, and it only compares
 * words (ids and names): unit symbols are short and case carries meaning in them
 * (m is milli, M is mega), so a one-letter slip there names a different unit.
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '#lib/index.js';
import { closestMatches, editDistance } from '#lib/ui/near-miss.js';

const { units, fuels } = loadDataBundle();
const fuelLabels = (f: (typeof fuels)[number]) => [f.id, ...f.names];
const unitLabels = (u: (typeof units)[number]) => [u.id, ...u.names];

describe('editDistance', () => {
	it.each([
		['gas', 'gas', 0],
		['gass', 'gas', 1],
		['gs', 'gas', 1],
		['gxs', 'gas', 1],
		// A swap of two neighbours is one edit, the way people mistype.
		['natrual', 'natural', 1],
		['', 'gas', 3]
	])('%j vs %j = %i', (a, b, d) => {
		expect(editDistance(a, b)).toBe(d);
	});
});

describe('closestMatches on the real catalog', () => {
	const fuelIds = (q: string) => closestMatches(q, fuels, fuelLabels).map((f) => f.id);
	const unitIds = (q: string) => closestMatches(q, units, unitLabels).map((u) => u.id);

	it('suggests the fuel a slug misspells, best first', () => {
		expect(fuelIds('natural_gass')[0]).toBe('natural-gas');
		expect(fuelIds('natrual gas')[0]).toBe('natural-gas');
		expect(fuelIds('Dieel')[0]).toBe('diesel');
		expect(fuelIds('methan')).toContain('methane');
	});

	it('suggests the unit a slug misspells', () => {
		expect(unitIds('kilowat-hour')[0]).toBe('kilowatt_hour');
		expect(unitIds('megawat')[0]).toBe('megawatt');
	});

	it('suggests nothing for a query that is far from every name', () => {
		expect(fuelIds('nonsense')).toEqual([]);
		expect(unitIds('zzzzzz')).toEqual([]);
	});

	it('suggests nothing for a very short query, where one slip names another word', () => {
		expect(fuelIds('lp')).toEqual([]);
		expect(fuelIds('dis')).toEqual([]);
		expect(unitIds('kw')).toEqual([]);
	});

	it('allows more slips in a longer word than in a shorter one', () => {
		// "diesxl" is one edit from diesel; "dixsxl" is two, too many for six letters.
		expect(fuelIds('diesxl')).toContain('diesel');
		expect(fuelIds('dixsxl')).not.toContain('diesel');
		// Two edits are fine in a long name.
		expect(fuelIds('naturl gs')).toContain('natural-gas');
	});

	it('returns at most the requested number, closest first', () => {
		const out = closestMatches('dieseel', fuels, fuelLabels, 1);
		expect(out.map((f) => f.id)).toEqual(['diesel']);
	});

	it('does not repeat an item that several of its names match', () => {
		const out = closestMatches('mineral dieel', fuels, fuelLabels).map((f) => f.id);
		expect(new Set(out).size).toBe(out.length);
	});
});
