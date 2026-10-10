/**
 * Short-symbol slug aliases for unit detail pages (SEO batch). Some units are
 * far more often searched/typed by their symbol than their id — "kwh" rather
 * than "kilowatt_hour", "mj" rather than "megajoule" — so /units/[unit]
 * additionally accepts a lowercased-primary-symbol alias that redirects to
 * the canonical /units/<id> URL (see src/routes/units/[unit]/+page.ts).
 *
 * Pure function of `Unit[]`, no SvelteKit/Svelte imports, so it is testable
 * in isolation (tests/unit-slugs.test.ts) — engine-independence rules (see
 * AGENTS.md): src/lib/ui/*.ts stays free of framework imports beyond what
 * already lives here.
 */
import type { Unit } from '$lib/conversion/types';

/** Alias slugs must be safe to use verbatim as a URL path segment. */
const SLUG_SAFE = /^[a-z0-9_+-]+$/;

/**
 * Build alias → canonical-unit-id pairs from each unit's primary (first)
 * symbol, lowercased. An alias is kept only when it:
 *   - differs from that unit's own id (no pointless self-redirect),
 *   - is URL-safe per {@link SLUG_SAFE} (rejects symbols with "³", "µ", "/",
 *     spaces, etc.), and
 *   - is unique across the whole catalog, and doesn't collide with any
 *     existing unit id.
 * Ambiguous or unsafe aliases are dropped entirely rather than guessed at —
 * no invented redirects (AGENTS.md: no invented numbers/no guessing extends
 * to routing too).
 */
export function buildUnitSlugAliases(units: Unit[]): Map<string, string> {
	const unitIds = new Set(units.map((u) => u.id));

	// alias -> set of unit ids that would claim it (for collision detection).
	const claimants = new Map<string, Set<string>>();

	for (const unit of units) {
		const symbol = unit.symbols[0];
		if (!symbol) continue;
		const alias = symbol.toLowerCase();

		if (alias === unit.id) continue;
		if (!SLUG_SAFE.test(alias)) continue;
		if (unitIds.has(alias)) continue;

		let owners = claimants.get(alias);
		if (!owners) {
			owners = new Set();
			claimants.set(alias, owners);
		}
		owners.add(unit.id);
	}

	const aliases = new Map<string, string>();
	for (const [alias, owners] of claimants) {
		if (owners.size !== 1) continue; // ambiguous across units — drop, don't guess
		aliases.set(alias, [...owners][0]);
	}
	return aliases;
}

/**
 * Everything that gets a prerendered redirect page under /units/: the
 * symbol aliases above plus the hyphenated spelling of every multi-word id
 * ("kilowatt-hour" → kilowatt_hour). People type and share the hyphenated form
 * far more often than the underscore one, and a static host has no runtime to
 * normalise it with — each accepted spelling needs its own prerendered file.
 *
 * Case variants ("kWh") are deliberately NOT enumerated here: a prerendered
 * `/units/kWh` and `/units/kwh` are the same file on a case-insensitive
 * filesystem (Windows, macOS), so the second would overwrite the first.
 * `resolveUnitSlug` handles case at runtime instead.
 */
export function buildUnitSlugRedirects(units: Unit[]): Map<string, string> {
	const unitIds = new Set(units.map((u) => u.id));
	const redirects = buildUnitSlugAliases(units);

	const claimants = new Map<string, Set<string>>();
	for (const unit of units) {
		if (!unit.id.includes('_')) continue;
		const slug = unit.id.replace(/_/g, '-');
		if (unitIds.has(slug) || redirects.has(slug) || !SLUG_SAFE.test(slug)) continue;
		let owners = claimants.get(slug);
		if (!owners) {
			owners = new Set();
			claimants.set(slug, owners);
		}
		owners.add(unit.id);
	}
	for (const [slug, owners] of claimants) {
		if (owners.size === 1) redirects.set(slug, [...owners][0]);
	}
	return redirects;
}

/**
 * Every symbol and alias, exactly as written, to the one unit it names. A
 * string two units share is left out — it names neither.
 */
export function buildExactSymbolMap(units: Unit[]): Map<string, string> {
	const owners = new Map<string, Set<string>>();
	for (const unit of units) {
		for (const s of [...unit.symbols, ...unit.aliases]) {
			let set = owners.get(s);
			if (!set) {
				set = new Set();
				owners.set(s, set);
			}
			set.add(unit.id);
		}
	}
	const out = new Map<string, string>();
	for (const [s, set] of owners) if (set.size === 1) out.set(s, [...set][0]);
	return out;
}

/**
 * Map a typed slug to a canonical unit id. No fuzzy guessing — a wrong unit is
 * worse than a 404 — and no case folding of symbols, because case is meaning
 * there: m is milli, M is mega. Folding sent /units/Mg (a tonne) to milligram
 * and /units/mW to megawatt behind a silent redirect. So:
 *
 *  1. an exact id, or a symbol/alias exactly as written ("kWh", "Mg");
 *  2. the lowercase alias slugs that are prerendered as redirects ("kwh",
 *     "kilowatt-hour") — only when the slug was typed in lowercase;
 *  3. a spelled-out id in any case, with spaces or hyphens for underscores
 *     ("Kilowatt-Hour", "KILOWATT_HOUR"): ids are words, where case carries
 *     nothing.
 */
export function resolveUnitSlug(
	slug: string,
	unitIds: ReadonlySet<string>,
	redirects: ReadonlyMap<string, string>,
	exactSymbols: ReadonlyMap<string, string>
): string | undefined {
	const trimmed = slug.trim();
	if (trimmed === '') return undefined;
	if (unitIds.has(trimmed)) return trimmed;
	const bySymbol = exactSymbols.get(trimmed);
	if (bySymbol) return bySymbol;
	if (trimmed === trimmed.toLowerCase()) {
		const target = redirects.get(trimmed);
		if (target) return target;
	}
	const asId = trimmed.toLowerCase().replace(/[-\s]+/g, '_');
	return unitIds.has(asId) ? asId : undefined;
}
