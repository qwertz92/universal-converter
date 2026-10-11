/**
 * Typed-by-hand fuel URLs for /fuels/[fuel]: "natural_gas", "Diesel",
 * "natural gas" and "Red Diesel" all reach the canonical /fuels/<id> page.
 *
 * The unit resolver (unit-slugs.ts) must keep symbol case because m is milli
 * and M is mega. Fuel ids and names are words, where case and word separators
 * carry nothing, so this resolver folds both — and does nothing else. No fuzzy
 * matching, no aliases (a short alias like "pellets" can mean several entries):
 * a wrong fuel is worse than a 404.
 *
 * Pure functions of the fuel list, free of SvelteKit/Svelte imports, so they are
 * testable in isolation (tests/fuel-slug-resolve.test.ts).
 */

/** The part of a Fuel the resolver reads. */
export interface FuelSlugSource {
	id: string;
	names: readonly string[];
}

/** Lower-case, and every run of hyphens, underscores and whitespace becomes one hyphen. */
function normalise(slug: string): string {
	return slug
		.trim()
		.toLowerCase()
		.replace(/[-_\s]+/g, '-');
}

/**
 * Normalised id or name → canonical fuel id. An id always wins over a name that
 * another fuel carries; a name two fuels share is dropped, since it names neither.
 */
export function buildFuelSlugIndex(fuels: readonly FuelSlugSource[]): Map<string, string> {
	const index = new Map<string, string>();
	for (const fuel of fuels) index.set(normalise(fuel.id), fuel.id);

	const byName = new Map<string, Set<string>>();
	for (const fuel of fuels) {
		for (const name of fuel.names) {
			const key = normalise(name);
			if (key === '' || index.has(key)) continue;
			let owners = byName.get(key);
			if (!owners) {
				owners = new Set();
				byName.set(key, owners);
			}
			owners.add(fuel.id);
		}
	}
	for (const [key, owners] of byName) {
		if (owners.size === 1) index.set(key, [...owners][0]);
	}
	return index;
}

/** A typed slug → canonical fuel id, or undefined when it names no fuel. */
export function resolveFuelSlug(
	slug: string,
	index: ReadonlyMap<string, string>
): string | undefined {
	const key = normalise(slug);
	return key === '' ? undefined : index.get(key);
}

/**
 * Spellings that also get a prerendered redirect page under /fuels/: the
 * underscore form of every hyphenated id ("natural_gas" → natural-gas). Lower
 * case only — "Diesel" and "diesel" would be one file on a case-insensitive
 * filesystem (Windows, macOS) — so case and the remaining spellings are left to
 * `resolveFuelSlug` at runtime.
 */
export function buildFuelSlugRedirects(fuels: readonly FuelSlugSource[]): Map<string, string> {
	const ids = new Set(fuels.map((f) => f.id));
	const redirects = new Map<string, string>();
	for (const fuel of fuels) {
		if (!fuel.id.includes('-')) continue;
		const alias = fuel.id.replaceAll('-', '_');
		if (!ids.has(alias)) redirects.set(alias, fuel.id);
	}
	return redirects;
}
