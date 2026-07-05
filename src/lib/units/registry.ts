/**
 * Unit registry: build fast lookup indexes over the unit catalog and resolve a
 * free-text token to a unit (or a structured ambiguity/unknown result).
 *
 * Matching rules (spec §8.2):
 *  - symbols AND aliases are first tried as an exact case-SENSITIVE match
 *    (design-forward for mW vs MW, and for SI-style aliases like "Mg"
 *    (megagram/tonne) vs "mg" (milligram) — rulebook B/D). Names are not part
 *    of the case-sensitive pass; they are conventionally written out in full
 *    and matched case-insensitively only.
 *  - if no case-sensitive symbol/alias match is found, we fall back to a
 *    case-INSENSITIVE match over names/aliases/symbols. If that loose key is
 *    shared by MORE THAN ONE unit (e.g. "mg" the milligram symbol and "Mg" the
 *    tonne alias both lowercase to "mg"), the fallback is AMBIGUOUS and is
 *    reported as such rather than silently picking whichever unit happened to
 *    be registered first;
 *  - the bare tokens "ton" and "gallon" are AMBIGUOUS and returned as such so the
 *    parser can disambiguate rather than silently pick (rulebook D.9, D.10).
 */

import type { Interpretation, Unit } from '$lib/conversion/types';
import { levenshtein, normalizeLoose, normalizeSymbol } from './aliases';

/** Tokens that must be treated as ambiguous, with the candidate units + default. */
const AMBIGUOUS_TOKENS: Record<string, { candidates: string[]; note: string }> = {
	ton: {
		candidates: ['tonne', 'short_ton', 'long_ton'],
		note: 'metric tonne (1000 kg) vs US short ton (907 kg) vs UK long ton (1016 kg)'
	},
	tons: {
		candidates: ['tonne', 'short_ton', 'long_ton'],
		note: 'metric tonne vs US short ton vs UK long ton'
	},
	gallon: {
		candidates: ['us_gallon', 'imperial_gallon'],
		note: 'US gallon (3.785 L) vs imperial gallon (4.546 L)'
	},
	gallons: {
		candidates: ['us_gallon', 'imperial_gallon'],
		note: 'US gallon vs imperial gallon'
	}
};

export type UnitMatch =
	| { kind: 'match'; unit: Unit; via: 'symbol' | 'name' | 'alias'; note?: string }
	| { kind: 'ambiguous'; token: string; interpretations: Interpretation[] }
	| { kind: 'unknown'; token: string; suggestions: string[] };

export class UnitRegistry {
	private readonly byId = new Map<string, Unit>();
	/** Case-SENSITIVE exact-string index over symbols AND aliases. */
	private readonly bySymbol = new Map<string, Unit>();
	/** First-registered unit per case-INSENSITIVE (loose) key — for fuzzy suggestions. */
	private readonly byLoose = new Map<string, Unit>();
	/** ALL units sharing a given loose key, so ambiguity can be detected on fallback. */
	private readonly byLooseAll = new Map<string, Unit[]>();
	/** Loose keys of every name/alias/symbol, for fuzzy suggestions. */
	private readonly looseKeys: string[] = [];

	constructor(private readonly units: Unit[]) {
		for (const u of units) {
			this.byId.set(u.id, u);
			for (const sym of u.symbols) {
				this.addExact(sym, u);
				this.addLoose(sym, u);
			}
			for (const name of u.names) this.addLoose(name, u);
			for (const alias of u.aliases) {
				this.addExact(alias, u);
				this.addLoose(alias, u);
			}
			this.addLoose(u.id, u);
		}
	}

	/** Register a case-sensitive symbol/alias key. Exact matches never collide
	 *  silently: if two different units already claim the identical exact
	 *  string, the later one is simply not indexed here (case-sensitive
	 *  collisions on the SAME string across DIFFERENT units are a data bug,
	 *  caught by the data-validation tests, not something to guess at here). */
	private addExact(token: string, unit: Unit): void {
		const key = normalizeSymbol(token);
		if (!this.bySymbol.has(key)) {
			this.bySymbol.set(key, unit);
		}
	}

	private addLoose(token: string, unit: Unit): void {
		const key = normalizeLoose(token);
		if (!this.byLoose.has(key)) {
			this.byLoose.set(key, unit);
			this.looseKeys.push(key);
		}
		const bucket = this.byLooseAll.get(key);
		if (bucket) {
			if (!bucket.includes(unit)) bucket.push(unit);
		} else {
			this.byLooseAll.set(key, [unit]);
		}
	}

	get(id: string): Unit | undefined {
		return this.byId.get(id);
	}

	all(): Unit[] {
		return this.units;
	}

	/** Resolve a token to a unit, ambiguity, or unknown (with suggestions). */
	resolve(token: string): UnitMatch {
		const trimmed = token.trim();
		if (trimmed === '') return { kind: 'unknown', token, suggestions: [] };

		// Ambiguous bare tokens first (case-insensitive).
		const loose = normalizeLoose(trimmed);
		const ambiguous = AMBIGUOUS_TOKENS[loose];
		if (ambiguous) {
			const interpretations: Interpretation[] = ambiguous.candidates
				.map((id) => this.byId.get(id))
				.filter((u): u is Unit => Boolean(u))
				.map((u) => ({ unit_id: u.id, label: u.names[0], note: u.notes }));
			return { kind: 'ambiguous', token: trimmed, interpretations };
		}

		// Case-SENSITIVE match across both symbols and aliases (e.g. "Mg" -> tonne,
		// "mg" -> milligram; "cal" -> calorie, "Cal" -> food_calorie).
		const symMatch = this.bySymbol.get(normalizeSymbol(trimmed));
		if (symMatch) {
			const via = symMatch.symbols.some((s) => normalizeSymbol(s) === normalizeSymbol(trimmed))
				? 'symbol'
				: 'alias';
			return { kind: 'match', unit: symMatch, via };
		}

		// Case-insensitive fallback over names/aliases/symbols. If the loose key is
		// shared by more than one DIFFERENT unit, that's a genuine ambiguity (e.g.
		// "MG" lowercases to "mg", which is claimed by both milligram and tonne) —
		// report it instead of silently picking whichever was registered first.
		const candidates = this.byLooseAll.get(loose);
		if (candidates && candidates.length > 1) {
			const interpretations: Interpretation[] = candidates.map((u) => ({
				unit_id: u.id,
				label: u.names[0],
				note: u.notes
			}));
			return { kind: 'ambiguous', token: trimmed, interpretations };
		}
		const looseMatch = this.byLoose.get(loose);
		if (looseMatch) {
			const via = looseMatch.names.some((n) => normalizeLoose(n) === loose) ? 'name' : 'alias';
			return { kind: 'match', unit: looseMatch, via };
		}

		// Unknown — suggest the closest keys by edit distance.
		return { kind: 'unknown', token: trimmed, suggestions: this.suggest(loose) };
	}

	/** Up to 3 closest unit ids by edit distance (for "did you mean"). */
	private suggest(loose: string): string[] {
		const scored = this.looseKeys
			.map((key) => ({ key, d: levenshtein(loose, key) }))
			.filter(({ key, d }) => d <= Math.max(2, Math.floor(key.length / 3)))
			.sort((a, b) => a.d - b.d)
			.slice(0, 5);
		const ids = new Set<string>();
		for (const { key } of scored) {
			const u = this.byLoose.get(key);
			if (u) ids.add(u.id);
			if (ids.size >= 3) break;
		}
		return [...ids];
	}
}
