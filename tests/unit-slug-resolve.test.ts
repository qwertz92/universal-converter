/**
 * Typed-by-hand unit URLs: /units/kWh, /units/kilowatt-hour, /units/Kilowatt_Hour
 * used to 404 because only the exact id and the lowercased primary symbol existed.
 * `resolveUnitSlug` maps a mistyped slug to the canonical id (used at runtime by
 * the page load); `buildUnitSlugRedirects` adds the hyphenated spelling of every
 * multi-word id so that spelling is prerendered as a redirect (a static host has
 * no runtime to normalise with, so each accepted spelling needs its own file).
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '$lib/index';
import { buildUnitSlugAliases, buildUnitSlugRedirects, resolveUnitSlug } from '$lib/ui/unit-slugs';
import type { Unit } from '$lib/conversion/types';

const { units } = loadDataBundle();
const ids = new Set(units.map((u) => u.id));
const aliases = buildUnitSlugAliases(units);
const redirects = buildUnitSlugRedirects(units);

describe('resolveUnitSlug on the real catalog', () => {
	it.each([
		['kilowatt_hour', 'kilowatt_hour'],
		['kwh', 'kilowatt_hour'],
		['kWh', 'kilowatt_hour'],
		['KWH', 'kilowatt_hour'],
		['kilowatt-hour', 'kilowatt_hour'],
		['Kilowatt-Hour', 'kilowatt_hour'],
		['kilowatt hour', 'kilowatt_hour'],
		['KILOWATT_HOUR', 'kilowatt_hour']
	])('%s → %s', (slug, expected) => {
		expect(resolveUnitSlug(slug, ids, aliases)).toBe(expected);
	});

	it('returns undefined for a slug that names no unit, instead of guessing', () => {
		expect(resolveUnitSlug('kilowatt-hours-per-moon', ids, aliases)).toBeUndefined();
		expect(resolveUnitSlug('', ids, aliases)).toBeUndefined();
	});
});

describe('buildUnitSlugRedirects', () => {
	it('contains every symbol alias', () => {
		for (const [alias, target] of aliases) expect(redirects.get(alias)).toBe(target);
	});

	it('adds the hyphenated spelling of multi-word ids', () => {
		expect(redirects.get('kilowatt-hour')).toBe('kilowatt_hour');
	});

	it('never shadows a real unit id and always lands on one', () => {
		for (const [slug, target] of redirects) {
			expect(ids.has(slug), `redirect '${slug}' collides with a unit id`).toBe(false);
			expect(ids.has(target), `target '${target}' for '${slug}'`).toBe(true);
			expect(slug).toMatch(/^[a-z0-9_+-]+$/);
		}
	});

	it('drops a hyphen spelling that two units would share', () => {
		const fake = (id: string): Unit => ({
			id,
			dimension: 'energy',
			symbols: [id],
			names: [id],
			aliases: [],
			to_base_factor: '1',
			is_exact: true,
			exactness: 'exact',
			source_refs: []
		});
		// 'a_b' and 'a-b' both spell "a-b"; 'a-b' is a real id here, so no redirect.
		const out = buildUnitSlugRedirects([fake('a_b'), fake('a-b')]);
		expect(out.has('a-b')).toBe(false);
	});
});
