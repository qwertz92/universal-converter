/**
 * Short-symbol slug aliases for /units/[unit] (SEO batch): pure builder in
 * src/lib/ui/unit-slugs.ts, consumed by the page's EntryGenerator + redirect.
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '$lib/index';
import { buildUnitSlugAliases } from '$lib/ui/unit-slugs';
import type { Unit } from '$lib/conversion/types';

const { units } = loadDataBundle();
const aliases = buildUnitSlugAliases(units);

describe('buildUnitSlugAliases on the real catalog', () => {
	it('maps kwh → kilowatt_hour and mwh → megawatt_hour (the spec §4.1 URLs)', () => {
		expect(aliases.get('kwh')).toBe('kilowatt_hour');
		expect(aliases.get('mwh')).toBe('megawatt_hour');
	});

	it('never aliases to a slug that equals an existing unit id', () => {
		const ids = new Set(units.map((u) => u.id));
		for (const alias of aliases.keys()) {
			expect(ids.has(alias), `alias '${alias}' collides with a unit id`).toBe(false);
		}
	});

	it('every alias is URL-safe and resolves to a real unit id', () => {
		const ids = new Set(units.map((u) => u.id));
		for (const [alias, target] of aliases) {
			expect(alias).toMatch(/^[a-z0-9_+-]+$/);
			expect(ids.has(target), `target '${target}' for alias '${alias}'`).toBe(true);
		}
	});
});

describe('buildUnitSlugAliases collision handling', () => {
	const fake = (id: string, symbol: string): Unit => ({
		id,
		dimension: 'energy',
		symbols: [symbol],
		names: [id],
		aliases: [],
		to_base_factor: '1',
		is_exact: true,
		exactness: 'exact',
		source_refs: []
	});

	it('drops an alias claimed by two different units instead of guessing', () => {
		const out = buildUnitSlugAliases([fake('alpha_unit', 'X'), fake('beta_unit', 'x')]);
		expect(out.has('x')).toBe(false);
	});

	it('drops unsafe symbols (µ, ³, slashes) entirely', () => {
		const out = buildUnitSlugAliases([fake('micro_thing', 'µT'), fake('cubic_thing', 'm³')]);
		expect(out.size).toBe(0);
	});

	it('skips the self-alias case', () => {
		const out = buildUnitSlugAliases([fake('btu', 'BTU')]);
		expect(out.has('btu')).toBe(false);
	});
});
