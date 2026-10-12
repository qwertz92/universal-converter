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

import { splitMaterial, splitMaterialPhrases } from '#lib/conversion/parser.js';

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
 * Spellings that also get a prerendered redirect page under /fuels/, so a
 * static host answers them with a 308 instead of the 404 app shell:
 *  - the underscore form of every hyphenated id ("natural_gas" → natural-gas);
 *  - the hyphenated form of every other name the resolver maps to one fuel
 *    ("fuel-oil" → heavy-fuel-oil, "petrol" → gasoline).
 * Lower case only — "Diesel" and "diesel" would be one file on a
 * case-insensitive filesystem (Windows, macOS) — so case is left to
 * `resolveFuelSlug` at runtime.
 */
export function buildFuelSlugRedirects(fuels: readonly FuelSlugSource[]): Map<string, string> {
	const ids = new Set(fuels.map((f) => f.id));
	const index = buildFuelSlugIndex(fuels);
	const redirects = new Map<string, string>();
	for (const fuel of fuels) {
		if (fuel.id.includes('-')) {
			const alias = fuel.id.replaceAll('-', '_');
			if (!ids.has(alias)) redirects.set(alias, fuel.id);
		}
		for (const name of fuel.names) {
			const slug = normalise(name);
			if (!/^[a-z0-9-]+$/.test(slug) || ids.has(slug)) continue;
			if (index.get(slug) === fuel.id) redirects.set(slug, fuel.id);
		}
	}
	return redirects;
}

/**
 * A slug that names several fuels — /fuels/heating-oil, /fuels/coal — and the
 * grades to offer for it, as the converter offers them for "1 L heating oil".
 * Undefined for any other slug.
 */
export function splitFuelPage(
	slug: string
): { phrase: string; reason: string; candidates: string[] } | undefined {
	return splitMaterial(slug.replace(/[-_]+/g, ' '));
}

/**
 * The prerendered slugs of those words. ASCII only: /fuels/heizöl has no
 * file of its own and reaches the same page at runtime, through the app shell.
 */
export function splitFuelSlugs(): string[] {
	return splitMaterialPhrases()
		.map((p) => p.replace(/\s+/g, '-'))
		.filter((s) => /^[a-z0-9-]+$/.test(s));
}
