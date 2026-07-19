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
