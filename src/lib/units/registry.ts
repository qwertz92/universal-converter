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
 *  - the fallback never changes what an SI prefix letter means. m is milli and
 *    M mega, p is pico and P peta: "ML" is a megalitre even though only "mL"
 *    exists, so it is refused (with an explanation) instead of being read as a
 *    millilitre. That fallback once turned "5 mW" into 5 megawatts.
 *  - the bare tokens "ton" and "gallon" are AMBIGUOUS and returned as such so the
 *    parser can disambiguate rather than silently pick (rulebook D.9, D.10).
 */

import type { Interpretation, Unit } from '#lib/conversion/types.js';
import { levenshtein, normalizeLoose, normalizeSymbol } from './aliases';

/**
 * Tokens that must be treated as ambiguous, with the candidate units + default.
 *
 * Null-prototype: this object is indexed with UNVALIDATED user input. As a
 * plain literal, `AMBIGUOUS_TOKENS['constructor']` returned an inherited
 * function, `.candidates` was undefined and `.map` threw — so `5 constructor`
 * crashed the parser and `/api/convert` answered 500 instead of a parse error.
 */
const AMBIGUOUS_TOKENS: Record<string, { candidates: string[]; note: string }> = Object.assign(
	Object.create(null),
	{
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
	}
);

/**
 * SI prefix letters whose meaning flips with case. Only these: k/K, g/G, t/T
 * and the rest either have no case twin among prefixes or name no unit here.
 */
const CASE_FLIPPED_PREFIXES: Record<string, string> = Object.assign(Object.create(null), {
	m: 'milli (one thousandth)',
	M: 'mega (one million)',
	p: 'pico (10⁻¹²)',
	P: 'peta (10¹⁵)'
});

/** The prefix each case-flipped letter stands for, spelled out as in unit names. */
const PREFIX_WORDS: Record<string, string> = Object.assign(Object.create(null), {
	m: 'milli',
	M: 'mega',
	p: 'pico',
	P: 'peta'
});

export type UnitMatch =
	| { kind: 'match'; unit: Unit; via: 'symbol' | 'name' | 'alias'; note?: string }
	| { kind: 'ambiguous'; token: string; interpretations: Interpretation[] }
	| { kind: 'unknown'; token: string; suggestions: string[] };

/**
 * A symbol-like spelling, where the case of the first letter is an SI prefix:
 * a listed symbol, or a short alias such as "kWh" or "m3". Anything longer
 * is a word ("megawatts") and names the unit in any case.
 */
function isSymbolSpelling(spelling: string, unit: Unit): boolean {
	if (unit.symbols.includes(spelling)) return true;
	if (unit.names.includes(spelling)) return false;
	return spelling.replace(/\s+/g, '').length <= 4;
}

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
		if (looseMatch && this.prefixConflict(trimmed, looseMatch)) {
			return { kind: 'unknown', token: trimmed, suggestions: [] };
		}
		if (looseMatch) {
			const via = looseMatch.names.some((n) => normalizeLoose(n) === loose) ? 'name' : 'alias';
			return { kind: 'match', unit: looseMatch, via };
		}

		// Unknown. Suggestions are NOT computed here: resolve() runs once per
		// candidate token length while the parser shrinks its window, and a full
		// Levenshtein sweep over every catalog key on each miss is an easy CPU
		// amplification. Callers that actually present "did you mean" call
		// suggest() explicitly, exactly once, on the final failing token.
		return { kind: 'unknown', token: trimmed, suggestions: [] };
	}

	/**
	 * Why a token that differs from a catalog symbol only by case was refused —
	 * or undefined when it was not. "ML" against "mL": the M makes it a
	 * megalitre, which is a different unit, not a spelling of the millilitre.
	 */
	prefixNote(token: string): string | undefined {
		const trimmed = token.trim();
		const unit = this.byLoose.get(normalizeLoose(trimmed));
		if (!unit || !this.prefixConflict(trimmed, unit)) return undefined;
		const twin = unit.symbols[0];
		return `Unit symbols are case-sensitive. In "${trimmed}", ${trimmed[0]} means ${CASE_FLIPPED_PREFIXES[trimmed[0]]}, and no such unit is in the catalog. "${twin}" (${unit.names[0]}) is a different unit.`;
	}

	/**
	 * True when the case-insensitive fallback would match `unit` only by
	 * changing the case of an SI prefix letter. Only a symbol carries that
	 * meaning: a spelled-out word ("Megawatt", "Megawatts", "Metric tons")
	 * matches whatever its case, so a word spelling is never a conflict.
	 */
	private prefixConflict(token: string, unit: Unit): boolean {
		const loose = normalizeLoose(token);
		const first = token[0];
		if (!(first in CASE_FLIPPED_PREFIXES)) return false;
		// Whatever the unit's system: a unit named with the OTHER prefix
		// ("megajoule per liter" for "mJ/l") is a conflict when the writer is
		// visibly using case — a capital anywhere after the first letter — and
		// did not spell the prefix out ("MILLIGRAMS"). An all-lowercase token
		// ("mj/kg") stays the energy-density convention; "Min" names no prefix.
		const lower = token.toLowerCase();
		const spelledOut = Object.values(PREFIX_WORDS).some((w) => lower.startsWith(w));
		const twinLetter = first === first.toLowerCase() ? first.toUpperCase() : first.toLowerCase();
		// "million tonnes of oil equivalent" starts with "milli" but names no prefix.
		const name = unit.names[0].toLowerCase();
		const namedWithTwin = name.startsWith(PREFIX_WORDS[twinLetter]) && !name.startsWith('million ');
		// Only the numerator shows intent: in "mj/L" the capital is the litre's.
		const numerator = token.split(/\/|\s+per\s+/i)[0];
		if (namedWithTwin && !spelledOut && /[A-Z]/.test(numerator.slice(1))) return true;
		if (unit.system !== 'SI') return false;
		const spellings = [...unit.names, ...unit.symbols, ...unit.aliases].filter(
			(s) => normalizeLoose(s) === loose
		);
		if (spellings.some((s) => !isSymbolSpelling(s, unit))) return false;
		return spellings.length > 0 && spellings.every((s) => s[0] !== first);
	}

	/**
	 * Up to 3 plausible unit ids for a token that did not resolve ("did you
	 * mean"). Prefix relatives rank first ("kilo" → kilojoule, kilowatt hour);
	 * edit-distance candidates must be close RELATIVE TO THE SHORTER STRING, so
	 * a genuinely unrelated word gets no suggestions at all rather than a
	 * nonsense one ("mile" must not suggest "mtoe").
	 */
	suggest(token: string): string[] {
		const loose = normalizeLoose(token.trim());
		// Levenshtein is O(len × key length) per key — don't sweep the whole
		// catalog for garbage tokens no suggestion could ever be close to.
		if (loose.length < 2 || loose.length > 40) return [];

		const prefix: string[] = [];
		const near: { key: string; d: number }[] = [];
		for (const key of this.looseKeys) {
			if (key.startsWith(loose) || loose.startsWith(key)) {
				prefix.push(key);
				continue;
			}
			const d = levenshtein(loose, key);
			const tolerance = Math.max(1, Math.floor(Math.min(loose.length, key.length) / 3));
			if (d <= tolerance) near.push({ key, d });
		}
		near.sort((a, b) => a.d - b.d || a.key.length - b.key.length);
		prefix.sort((a, b) => a.length - b.length);

		const ids = new Set<string>();
		for (const key of [...prefix, ...near.map((n) => n.key)]) {
			const u = this.byLoose.get(key);
			if (u) ids.add(u.id);
			if (ids.size >= 3) break;
		}
		return [...ids];
	}
}
