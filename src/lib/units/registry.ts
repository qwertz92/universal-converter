/**
 * Unit registry: build fast lookup indexes over the unit catalog and resolve a
 * free-text token to a unit (or a structured ambiguity/unknown result).
 *
 * Matching rules (spec §8.2):
 *  - symbols match case-SENSITIVELY (design-forward for mW vs MW; rulebook B/D);
 *  - names and aliases match case-INSENSITIVELY;
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
	private readonly bySymbol = new Map<string, Unit>();
	private readonly byLoose = new Map<string, Unit>();
	/** Loose keys of every name/alias/symbol, for fuzzy suggestions. */
	private readonly looseKeys: string[] = [];

	constructor(private readonly units: Unit[]) {
		for (const u of units) {
			this.byId.set(u.id, u);
			for (const sym of u.symbols) {
				this.bySymbol.set(normalizeSymbol(sym), u);
				this.addLoose(sym, u);
			}
			for (const name of u.names) this.addLoose(name, u);
			for (const alias of u.aliases) this.addLoose(alias, u);
			this.addLoose(u.id, u);
		}
	}

	private addLoose(token: string, unit: Unit): void {
		const key = normalizeLoose(token);
		if (!this.byLoose.has(key)) {
			this.byLoose.set(key, unit);
			this.looseKeys.push(key);
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

		// Case-sensitive symbol match.
		const symMatch = this.bySymbol.get(normalizeSymbol(trimmed));
		if (symMatch) return { kind: 'match', unit: symMatch, via: 'symbol' };

		// Case-insensitive name/alias match.
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
