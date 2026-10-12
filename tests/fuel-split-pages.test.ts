/**
 * /fuels/heating-oil used to be the catalog's heavy fuel oil, the residual
 * grade at 983 kg/m³, while most readers searching "heating oil" burn a light
 * distillate ~15% different per litre. The entry is now `heavy-fuel-oil`, and
 * the ambiguous word gets a page offering the grades — the same choice the
 * converter offers for "1 L heating oil".
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '#lib/index.js';
import { buildFuelSlugIndex, resolveFuelSlug, splitFuelPage } from '#lib/ui/fuel-slugs.js';
import { splitFuelSlugs } from '#lib/ui/fuel-slugs.js';
import { splitMaterialPhrases } from '#lib/conversion/parser.js';
import { SPLIT_FUEL_SLUGS } from '../src/params.js';

const { fuels } = loadDataBundle();
const ids = new Set(fuels.map((f) => f.id));
const index = buildFuelSlugIndex(fuels);

describe('pages for ambiguous fuel words', () => {
	it('/fuels/heating-oil offers gas oil, burning oil and heavy fuel oil', () => {
		expect(splitFuelPage('heating-oil')?.candidates).toEqual([
			'gas-oil',
			'burning-oil',
			'heavy-fuel-oil'
		]);
	});

	it('accepts the slug spellings a reader types', () => {
		expect(splitFuelPage('Heating_Oil')?.phrase).toBe('heating oil');
		expect(splitFuelPage('coal')?.candidates).toContain('hard-coal');
		expect(splitFuelPage('diesel')).toBeUndefined();
	});

	it('never takes the URL of a real fuel page', () => {
		for (const slug of splitFuelSlugs()) {
			expect(resolveFuelSlug(slug, index), slug).toBeUndefined();
		}
	});

	it('offers only fuels that exist', () => {
		for (const slug of splitFuelSlugs()) {
			for (const id of splitFuelPage(slug)!.candidates)
				expect(ids.has(id), `${slug} → ${id}`).toBe(true);
		}
	});

	it('the route matcher knows exactly the words the parser splits', () => {
		// src/params.ts cannot import the parser (Node loads it during the build),
		// so it carries its own copy.
		expect([...SPLIT_FUEL_SLUGS].sort()).toEqual(
			splitMaterialPhrases()
				.map((p) => p.replace(/\s+/g, '-'))
				.sort()
		);
	});

	it('prerenders the ASCII slugs, including the old heating-oil URL', () => {
		expect(splitFuelSlugs()).toContain('heating-oil');
		for (const slug of splitFuelSlugs()) expect(slug).toMatch(/^[a-z0-9-]+$/);
	});
});
