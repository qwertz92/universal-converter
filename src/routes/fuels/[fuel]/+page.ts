import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { allFuels, fuelById, resolveSources } from '$lib/ui/engine';
import { learnForFuel } from '$lib/content/learn';
import { buildFuelSlugIndex, buildFuelSlugRedirects, resolveFuelSlug } from '$lib/ui/fuel-slugs';
import type { EntryGenerator } from './$types';

export const prerender = true;

const fuelSlugIndex = buildFuelSlugIndex(allFuels());
const fuelSlugRedirects = buildFuelSlugRedirects(allFuels());

/**
 * Prerender one page per fuel id, plus the underscore spelling of each
 * hyphenated id (redirects to the canonical page — see `load`). When the
 * catalog is empty this yields no dynamic pages — the index still renders its
 * "not loaded" state.
 */
export const entries: EntryGenerator = () => [
	...allFuels().map((f) => ({ fuel: f.id })),
	...[...fuelSlugRedirects.keys()].map((alias) => ({ fuel: alias }))
];

export function load({ params }: { params: { fuel: string } }) {
	// Also reached at runtime (the 404.html app shell, the dev server, in-app
	// navigation), where it tolerates the case, space and hyphen/underscore
	// variants that no prerendered file exists for.
	const canonicalId = resolveFuelSlug(params.fuel, fuelSlugIndex);
	if (canonicalId && canonicalId !== params.fuel) {
		redirect(308, resolve(`/fuels/${canonicalId}`));
	}

	const fuel = fuelById(params.fuel);
	if (!fuel) throw error(404, `Unknown fuel: ${params.fuel}`);
	return {
		fuel,
		sources: resolveSources(fuel.source_refs),
		learn: learnForFuel(fuel.id)
	};
}
