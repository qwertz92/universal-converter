import { error } from '@sveltejs/kit';
import { fuelById } from '#lib/ui/engine.js';
import { splitFuelPage, splitFuelSlugs } from '#lib/ui/fuel-slugs.js';
import type { EntryGenerator } from './$types';

export const prerender = true;

/** One page per ASCII word that names several fuels, /fuels/heating-oil among them. */
export const entries: EntryGenerator = () => splitFuelSlugs().map((fuel) => ({ fuel }));

export function load({ params }: { params: { fuel: string } }) {
	const split = splitFuelPage(params.fuel);
	if (!split) throw error(404, `Unknown fuel: ${params.fuel}`);
	const candidates = split.candidates.map((id) => fuelById(id)).filter((f) => f !== undefined);
	return { phrase: split.phrase, reason: split.reason, candidates };
}
