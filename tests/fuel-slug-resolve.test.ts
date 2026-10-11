/**
 * Typed-by-hand fuel URLs: /fuels/natural_gas, /fuels/Diesel and /fuels/natural%20gas
 * used to 404 because only the exact catalog id existed as a route.
 * `resolveFuelSlug` maps those to the canonical id (used at runtime by the page
 * load); `buildFuelSlugRedirects` lists the lowercase underscore spellings that
 * are also prerendered as redirects, so a static host answers them with a 308.
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '#lib/index.js';
import { buildFuelSlugIndex, buildFuelSlugRedirects, resolveFuelSlug } from '#lib/ui/fuel-slugs.js';

const { fuels } = loadDataBundle();
const index = buildFuelSlugIndex(fuels);

describe('resolveFuelSlug on the real catalog', () => {
	it.each([
		['natural-gas', 'natural-gas'],
		['natural_gas', 'natural-gas'],
		['natural gas', 'natural-gas'],
		['Natural_Gas', 'natural-gas'],
		['NATURAL-GAS', 'natural-gas'],
		['Diesel', 'diesel'],
		['  diesel ', 'diesel'],
		['LPG', 'lpg'],
		['coal_electricity_generation', 'coal-electricity-generation'],
		// A catalog name that is not an id: names are words, so case and
		// separators carry nothing there either.
		['Red Diesel', 'gas-oil'],
		['red_diesel', 'gas-oil'],
		['liquefied-natural-gas', 'lng']
	])('%s → %s', (slug, expected) => {
		expect(resolveFuelSlug(slug, index)).toBe(expected);
	});

	it.each([
		// Never fuzzy: a misspelling or a fragment names no fuel.
		'natural_gass',
		'gas',
		'natural',
		'dieselx',
		// An alias (not an id or a name) is not resolved — "pellets" could mean
		// several catalog entries.
		'pellets',
		'erdgas',
		'',
		'   ',
		'natural--gas-'
	])('%j → undefined', (slug) => {
		expect(resolveFuelSlug(slug, index)).toBeUndefined();
	});

	it('resolves every catalog id and every catalog name to its own fuel', () => {
		for (const fuel of fuels) {
			expect(resolveFuelSlug(fuel.id, index)).toBe(fuel.id);
			for (const name of fuel.names) {
				expect(resolveFuelSlug(name, index), `${fuel.id}: ${name}`).toBe(fuel.id);
			}
		}
	});
});

describe('buildFuelSlugIndex', () => {
	it('lets an id beat a name another fuel carries', () => {
		const idx = buildFuelSlugIndex([
			{ id: 'diesel', names: ['diesel'] },
			{ id: 'road-fuel', names: ['Diesel'] }
		]);
		expect(resolveFuelSlug('diesel', idx)).toBe('diesel');
	});

	it('drops a name two fuels share instead of picking one', () => {
		const idx = buildFuelSlugIndex([
			{ id: 'a', names: ['shared name'] },
			{ id: 'b', names: ['Shared Name'] }
		]);
		expect(resolveFuelSlug('shared-name', idx)).toBeUndefined();
		expect(resolveFuelSlug('a', idx)).toBe('a');
	});
});

describe('buildFuelSlugRedirects', () => {
	const redirects = buildFuelSlugRedirects(fuels);

	it('adds the underscore spelling of every hyphenated id and nothing else', () => {
		const expected = fuels.filter((f) => f.id.includes('-')).map((f) => f.id.replaceAll('-', '_'));
		expect([...redirects.keys()].sort()).toEqual(expected.sort());
		expect(redirects.get('natural_gas')).toBe('natural-gas');
	});

	it('is collision-free on a case-insensitive filesystem', () => {
		const ids = new Set(fuels.map((f) => f.id));
		const files = [...ids, ...redirects.keys()].map((s) => s.toLowerCase());
		expect(new Set(files).size).toBe(files.length);
		for (const alias of redirects.keys()) {
			expect(alias).toBe(alias.toLowerCase());
			expect(ids.has(alias)).toBe(false);
		}
	});
});
