import { error } from '@sveltejs/kit';
import { allFuels, fuelById, resolveSources } from '$lib/ui/engine';
import { learnForFuel } from '$lib/content/learn';
import type { EntryGenerator } from './$types';

export const prerender = true;

/**
 * Prerender one page per fuel id. When the catalog is empty this yields no
 * dynamic pages — the index still renders its "not loaded" state.
 */
export const entries: EntryGenerator = () => allFuels().map((f) => ({ fuel: f.id }));

export function load({ params }: { params: { fuel: string } }) {
	const fuel = fuelById(params.fuel);
	if (!fuel) throw error(404, `Unknown fuel: ${params.fuel}`);
	return {
		fuel,
		sources: resolveSources(fuel.source_refs),
		learn: learnForFuel(fuel.id)
	};
}
