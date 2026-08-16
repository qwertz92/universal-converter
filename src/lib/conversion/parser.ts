/**
 * Free-text parser (spec §8.2). Grammar:
 *
 *   [filler] <number> <unit> [fuel] [(to|in|→) <target unit>] [(for|×) <duration>]
 *            [(at|@) <amount> <currency>/<unit>] [(at|@) <n>% efficiency | <n> COP]
 *
 * Handles:
 *  - `1 kWh`, `1.5 MJ`, `1,5 MJ` (comma decimal), `1000 kcal`, `1 kilowatt hour`;
 *  - `1 liter diesel`, `1 L gasoline`, `1 barrel crude oil`, `1 m3 natural gas`,
 *    `1 kg hydrogen`, `2 kg wood pellets` (trailing fuel phrase);
 *  - number glued to unit: `1.5MJ`, `1000kcal`;
 *  - an explicit conversion TARGET: `5 kWh to MJ`, `1 kWh in kcal`,
 *    `1 L diesel -> kg`, `1 kWh = kJ` (§C.8: the target is highlighted, it never
 *    replaces the other result groups);
 *  - a DURATION for the power→energy bridge: `5 kW for 3 h`, `2 kW × 30 min`
 *    (rulebook §B.3 — the tool still never assumes a duration on its own);
 *  - a user-supplied PRICE: `1000 kWh at 0.32 EUR/kWh`, `1 L diesel @ 1.75 €/L`.
 *    The catalog holds no tariffs and never will; a price only ever comes from
 *    the person asking, and the currency is a label, never converted;
 *  - a user-supplied EFFICIENCY: `100 kWh at 85% efficiency`, `100 kWh at 3.5
 *    COP`. Same rule — no efficiency table is shipped, because real appliances
 *    vary far too widely for a default to be true of anyone;
 *  - conversational phrasing: `convert 5 kwh to mj`,
 *    `how many kWh in 1 liter diesel?`.
 *
 * Returns a `ParsedQuery` (matched unit + optional fuel/target/duration +
 * confidence) or a structured `ParseError`:
 *  - unknown unit → suggestions (closest matches) and, for common out-of-scope
 *    quantities (temperature, length, pressure, …), an honest "not supported"
 *    hint instead of a nonsense edit-distance guess;
 *  - unknown material → the closest fuels in the catalog;
 *  - missing value / missing unit → an example of the expected shape;
 *  - ambiguous token (e.g. "ton", "gallon") → the competing interpretations.
 *
 * Fuel matching uses the provided registries; it works with an EMPTY fuel
 * catalog (a trailing unknown fuel phrase yields `unknown_fuel`).
 */

import Decimal from 'decimal.js';
import type { Efficiency, ParseError, ParseResult, ParsedQuery, Price, Quantity } from './types';
import type { UnitRegistry } from '$lib/units/registry';
import { normalizeLoose } from '$lib/units/aliases';
import type { FuelRegistry } from '$lib/fuels/registry';

/** Leading number: optional sign, digits with `.` or `,` decimal (leading-dot
 *  decimals like ".5" allowed), optional exponent. */
const NUMBER_RE =
	/^([+-]?(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?)/;

/** Hard input-length guard (a query is a value + a unit + maybe a fuel). */
const MAX_INPUT_LENGTH = 200;
/** Magnitude guard: |value| must stay within 10^±30 (decimal exponent bound).
 *  Anything beyond is physically meaningless here and only inflates the
 *  decimal strings every downstream conversion has to carry (DoS guard). */
const MAX_ABS_EXPONENT = 30;

/** Keywords introducing a target unit. "Strong" ones are unmistakable, so a
 *  tail that fails to resolve is reported as an error rather than silently
 *  re-interpreted as a material. */
const STRONG_TARGET_WORDS = new Set(['to', 'into', '->', '→', '⇒', '=', '=>']);
/** "Weak" ones also occur in ordinary phrasing, so an unresolvable tail is
 *  simply left in place for the fuel/unit matcher. */
const WEAK_TARGET_WORDS = new Set(['in', 'as']);
/** Keywords introducing a duration for the power→energy bridge. */
const DURATION_WORDS = new Set(['for', 'over', 'during', '×', 'x', '*', '·']);
/** Introduces a user-supplied unit price: `1000 kWh at 0.32 EUR/kWh`. */
const PRICE_WORDS = new Set(['at', '@', 'costing']);
/** Articles accepted in a duration ("for an hour" → 1 hour). */
const DURATION_ARTICLES = new Set(['a', 'an', 'one']);
/** Words that carry no meaning between a unit and a material ("10 litres OF diesel"). */
const FILLER_WORDS = new Set(['of', 'the', 'a', 'an']);

/** Filler that can precede the actual query. */
const LEADING_FILLER_RE =
	/^(?:please|convert|calculate|compute|show me|give me|tell me|what(?:'s| is)|whats|how many|how much|is|are)\s+/i;
/**
 * "how many X in Y" / "how much X is in Y" — rewritten to "Y to X" so the
 * ordinary grammar handles it. When X is not a unit at all ("how much CO2 is in
 * 1 L diesel") the wanted half is simply dropped and the source is converted:
 * loose phrasing should still get an answer, never a manufactured error.
 */
const ASK_RE = /^how\s+(?:many|much)\s+(.+?)\s+(?:is\s+in|are\s+in|in|is|are|for|of|from)\s+(.+)$/i;

/**
 * Quantities people plausibly try that this tool deliberately does not cover
 * yet. Consulted ONLY after a token failed to resolve against the catalog, so a
 * real unit/alias always wins and this table can never shadow one.
 */
const OUT_OF_SCOPE: { tokens: string[]; label: string; note: string }[] = [
	{
		tokens: [
			'°c',
			'°f',
			'celsius',
			'fahrenheit',
			'kelvin',
			'degree',
			'degrees',
			'deg',
			'°',
			'grad'
		],
		label: 'Temperature',
		note: 'Temperature is an affine scale (it has an offset, not just a factor), so it needs its own model — planned, not shipped.'
	},
	{
		tokens: [
			'mile',
			'miles',
			'km',
			'kilometer',
			'kilometre',
			'kilometers',
			'kilometres',
			'meter',
			'metre',
			'meters',
			'metres',
			'foot',
			'feet',
			'ft',
			'inch',
			'inches',
			'yard',
			'yards',
			'cm',
			'mm',
			'nautical mile'
		],
		label: 'Length and distance',
		note: 'This tool covers energy, power, mass, volume and time (plus fuels and emissions).'
	},
	{
		tokens: ['bar', 'mbar', 'psi', 'pascal', 'pa', 'hpa', 'atm', 'atmosphere', 'torr'],
		label: 'Pressure',
		note: 'Pressure, flow and steam calculations are planned for a later release.'
	},
	{
		tokens: ['mph', 'kmh', 'km/h', 'knot', 'knots', 'm/s'],
		label: 'Speed',
		note: 'This tool covers energy, power, mass, volume and time (plus fuels and emissions).'
	},
	{
		tokens: ['gb', 'mb', 'tb', 'kb', 'byte', 'bytes', 'bit', 'bits'],
		label: 'Digital storage',
		note: 'This tool is about physical energy quantities, not data sizes.'
	},
	{
		tokens: ['eur', 'usd', 'gbp', 'chf', '€', '$', '£', 'cent', 'euro', 'dollar', 'dollars'],
		label: 'Currency and prices',
		note: 'This tool carries no tariffs and converts no currencies. It will price a quantity at a rate YOU give it, though — try "1000 kWh at 0.32 EUR/kWh".'
	},
	{
		tokens: ['ppm', 'ppb', 'percent', '%'],
		label: 'Concentration',
		note: 'This tool covers energy, power, mass, volume and time (plus fuels and emissions).'
	}
];

/**
 * Everyday words that name a real product class this catalog deliberately
 * splits into several entries with materially different numbers.
 *
 * These must NOT be aliases of any one entry. "heizöl" resolved to DESNZ
 * "Fuel Oil" — the residual bunker grade at 983 kg/m³ — while German/Austrian
 * Heizöl EL is a gasoil-grade distillate, so every answer was about 15% high
 * and looked fully sourced. Offering the candidates costs the reader one click
 * and cannot be wrong; picking one for them can.
 *
 * Null-prototype for the same reason as `AMBIGUOUS_TOKENS`: indexed with raw
 * user input.
 */
const SPLIT_MATERIALS: Record<string, { reason: string; candidates: string[] }> = Object.assign(
	Object.create(null),
	{
		heizöl: {
			reason: 'covers several different oils.',
			candidates: ['gas-oil', 'burning-oil', 'heating-oil']
		},
		heizoel: {
			reason: 'covers several different oils.',
			candidates: ['gas-oil', 'burning-oil', 'heating-oil']
		},
		'heating oil': {
			reason: 'is not one product — the grades differ by up to 15% per litre.',
			candidates: ['gas-oil', 'burning-oil', 'heating-oil']
		},
		'light fuel oil': {
			reason: 'is not a grade this catalog carries under that name.',
			candidates: ['gas-oil', 'burning-oil', 'heating-oil']
		},
		paraffin: {
			reason: 'means heating kerosene in the UK and aviation kerosene elsewhere.',
			candidates: ['burning-oil', 'kerosene']
		},
		coal: {
			// DESNZ publishes four grades spanning 2225–3165 kg CO2e/tonne. Bare
			// "coal" used to be a NAME of the industrial grade, so someone burning
			// coal in a domestic stove was answered 21% low without being told a
			// choice had been made for them.
			reason: 'is not one grade — the published figures differ by up to 42% per tonne.',
			candidates: ['hard-coal', 'coal-domestic', 'coking-coal', 'coal-electricity-generation']
		}
	}
);

/** Offer the grades a split-material phrase covers, naming none of them as the default. */
function splitMaterialError(
	phrase: string,
	split: { reason: string; candidates: string[] },
	fuels: FuelRegistry
): ParseError {
	return {
		kind: 'unknown_fuel',
		message: `"${phrase}" ${split.reason} Pick the one you mean:`,
		token: phrase,
		suggestions: split.candidates
			.map((id) => fuels.get(id)?.names[0])
			.filter((n): n is string => Boolean(n)),
		hint: 'These are different products with different numbers — none of them is a safe default.'
	};
}

export function parseQuery(text: string, units: UnitRegistry, fuels: FuelRegistry): ParseResult {
	const original = text;
	const trimmed = text.trim();
	if (trimmed === '') {
		return err({ kind: 'empty_input', message: 'Enter a value and a unit, e.g. "1 kWh".' });
	}
	if (trimmed.length > MAX_INPUT_LENGTH) {
		return err({
			kind: 'unsupported_value',
			message: `Input is too long (${trimmed.length} characters). Keep queries under ${MAX_INPUT_LENGTH} characters.`
		});
	}

	// 0. Normalise conversational shapes into the core grammar.
	const working = prepare(trimmed, units);

	// 1. Extract the leading numeric literal.
	const numMatch = working.match(NUMBER_RE);
	if (!numMatch) {
		// A bare material ("diesel") is a recognisable intent worth answering well.
		const asFuel = fuels.resolve(working);
		if (asFuel) {
			return err({
				kind: 'missing_value',
				message: `"${asFuel.names[0]}" is a material, not a measurement. Add a value and a unit, e.g. "1 L ${asFuel.names[0]}".`,
				token: working
			});
		}
		return err({
			kind: 'missing_value',
			message: 'Start with a number, e.g. "1 kWh" or "1000 kcal".',
			token: working.split(/\s+/)[0]
		});
	}
	const rawNumber = numMatch[1];
	const { value, warning: numberWarning } = normalizeNumberWithWarning(rawNumber);

	// Magnitude guard: reject values whose decimal exponent is beyond ±30.
	const magnitudeError = checkMagnitude(value, rawNumber);
	if (magnitudeError) return err(magnitudeError);

	let rest = working.slice(numMatch[0].length).trim();
	// A dangling separator right after the number ("5. kWh") has no other
	// reading — drop it rather than reporting a bogus unknown unit ". kWh".
	rest = rest.replace(/^[.,](?=\s|$)/, '').trim();

	if (rest === '') {
		return err({
			kind: 'no_unit',
			message: `Got the value ${value}, but no unit. Every conversion needs one — try "${value} kWh", "${value} L diesel" or "${value} kg".`,
			hint: 'The unit is never guessed: "5" alone could be 5 kWh, 5 litres or 5 kg.'
		});
	}

	const notes: string[] = numberWarning ? [numberWarning] : [];

	// 2. Peel the optional trailing clauses (target unit, duration). Each clause
	//    is only consumed when it actually resolves, so ordinary phrasing that
	//    happens to contain "in" or "for" is left untouched for the fuel matcher.
	let words = rest.split(/\s+/);
	let targetUnitId: string | undefined;
	let time: Quantity | undefined;

	// Efficiency before price: both are introduced by "at", and an efficiency is
	// unambiguous (a percentage or an explicit COP), so recognising it first
	// keeps "at 85% efficiency at 0.32 EUR/kWh" readable in either order.
	const efficiencyClause = peelEfficiency(words);
	if (efficiencyClause && 'error' in efficiencyClause) return err(efficiencyClause.error);
	const efficiency = efficiencyClause?.efficiency;
	if (efficiencyClause) words = efficiencyClause.rest;

	// A price clause is peeled next: it ends in a unit ("…/kWh") that the target
	// and fuel matchers would otherwise try to claim.
	const priceClause = peelPrice(words, units);
	if (priceClause && 'error' in priceClause) return err(priceClause.error);
	const price = priceClause?.price;
	if (priceClause) {
		words = priceClause.rest;
		if (priceClause.note) notes.push(`price: ${priceClause.note}`);
	}

	for (;;) {
		const duration = peelDuration(words, units);
		if (duration && 'error' in duration) return err(duration.error);
		if (duration) {
			// A SECOND duration is a contradiction, not a correction. "5 kW for 3 h
			// for 2 h" silently kept the first and answered 15 kWh; the target
			// branch below already refuses the equivalent "5 kWh to MJ to GJ".
			if (time) {
				return err({
					kind: 'unsupported_value',
					message: `Two durations were given ("${duration.time.value}" and "${time.value}"). Keep one — energy = power × a single time.`
				});
			}
			words = duration.rest;
			time = duration.time;
			continue;
		}
		if (targetUnitId === undefined) {
			const target = peelTarget(words, units);
			if (target && 'error' in target) return err(target.error);
			if (target) {
				words = target.rest;
				targetUnitId = target.unitId;
				continue;
			}
		}
		break;
	}

	if (words.length === 0) {
		return err({
			kind: 'no_unit',
			message: `Got the value ${value}, but no unit to convert FROM. Try "${value} kWh${targetUnitId ? ' to ' + (units.get(targetUnitId)?.symbols[0] ?? '') : ''}".`
		});
	}

	const restWithoutClauses = words.join(' ');

	// 3. Try to interpret the whole remainder as a unit ("kilowatt hour").
	const wholeMatch = units.resolve(restWithoutClauses);
	if (wholeMatch.kind === 'match') {
		return ok({
			value,
			unit_id: wholeMatch.unit.id,
			dimension: wholeMatch.unit.dimension,
			target_unit_id: targetUnitId,
			time,
			price,
			efficiency,
			confidence: wholeMatch.via === 'symbol' ? 1 : 0.95,
			notes: aliasNote(wholeMatch, notes),
			original_input: original
		});
	}
	if (wholeMatch.kind === 'ambiguous') {
		return err({
			kind: 'ambiguous_unit',
			message: `"${wholeMatch.token}" is ambiguous — pick the one you mean:`,
			token: wholeMatch.token,
			interpretations: wholeMatch.interpretations
		});
	}

	// 4. Peel a trailing fuel phrase, then match the leading words as the unit.
	//
	// A split-material phrase is checked FIRST, because the trailing matcher is
	// greedy from the left and would read "light fuel oil" as "fuel oil" with
	// "light" noted as ignored — answering with the residual grade for a phrase
	// that says, in the word it dropped, that it is not the residual grade.
	for (let start = 1; start < words.length; start++) {
		const phrase = words.slice(start).join(' ');
		const split = SPLIT_MATERIALS[normalizeLoose(phrase)];
		// The words BEFORE it must resolve as a unit on their own — that is what
		// makes this suffix the whole material phrase rather than the tail of a
		// longer one. Without the check, "1 kg coking coal" ends with "coal" and
		// was answered with the ambiguity prompt for bare coal, even though
		// "coking coal" names exactly one grade.
		if (split && units.resolve(words.slice(0, start).join(' ')).kind === 'match') {
			return err(splitMaterialError(phrase, split, fuels));
		}
	}

	const fuelMatch = fuels.matchTrailingFuel(words);
	let unitWords = words;
	let fuelId: string | undefined;
	if (fuelMatch) {
		unitWords = words.slice(0, words.length - fuelMatch.consumed);
		fuelId = fuelMatch.fuel.id;
	}

	if (unitWords.length === 0) {
		// e.g. "1 diesel" — a material but no unit token.
		const fuelName = fuelId ? (fuels.get(fuelId)?.names[0] ?? fuelId) : '';
		return err({
			kind: 'no_unit',
			message:
				`Add a unit before the material, e.g. "${value} L ${fuelName}" or "${value} kg ${fuelName}".`.trim(),
			hint: 'Materials answer "how much energy / CO₂ is in this amount" — so we need the amount first.'
		});
	}

	// Try progressively shorter leading runs so "kilowatt hour diesel" works even
	// when the fuel peel above missed (defensive; fuel peel is primary).
	for (let len = unitWords.length; len >= 1; len--) {
		const candidate = unitWords.slice(0, len).join(' ');
		const match = units.resolve(candidate);
		if (match.kind === 'match') {
			// Any leftover words after the unit that we couldn't assign?
			const leftover = unitWords.slice(len);
			if (leftover.length > 0 && fuelId) {
				// A material matched, but words in front of it did not. Those words
				// may well name a DIFFERENT product — "red diesel" (gas oil) has its
				// own density, calorific value and emission factor. Answering with
				// plain diesel and saying nothing is exactly the silent guess this
				// tool exists to avoid, so the omission is stated.
				const meaningful = leftover.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
				if (meaningful.length > 0) {
					const fuelName = fuels.get(fuelId)?.names[0] ?? fuelId;
					notes.push(
						`ignored "${meaningful.join(' ')}" — it is not a unit or a material in the catalog; the answer is for plain ${fuelName}`
					);
				}
			}
			if (leftover.length > 0 && !fuelId) {
				const phrase = leftover.join(' ');
				// A dangling "to" / "for" is an unfinished thought, not a material.
				const allKeywords = leftover.every((w) => {
					const k = w.toLowerCase();
					return STRONG_TARGET_WORDS.has(k) || WEAK_TARGET_WORDS.has(k) || DURATION_WORDS.has(k);
				});
				if (allKeywords) {
					const isDuration = DURATION_WORDS.has(leftover[0].toLowerCase());
					return err({
						kind: 'no_unit',
						message: isDuration
							? `"${phrase}" needs a duration after it, e.g. "${value} ${match.unit.symbols[0]} for 3 h".`
							: `"${phrase}" needs a unit after it, e.g. "${value} ${match.unit.symbols[0]} to MJ".`,
						token: phrase
					});
				}
				// A word that names a real product class the catalog splits into
				// several entries gets those entries offered, rather than a bare
				// "unknown material" — and rather than one of them being picked,
				// which is how "heizöl" used to return residual bunker oil.
				const split = SPLIT_MATERIALS[normalizeLoose(phrase)];
				if (split) return err(splitMaterialError(phrase, split, fuels));
				// Otherwise the leftover is most likely an unknown fuel phrase.
				return err({
					kind: 'unknown_fuel',
					message: `The unit ${match.unit.symbols[0] ?? match.unit.names[0]} was understood, but "${phrase}" is not a material in the catalog.`,
					token: phrase,
					suggestions: fuels.suggest(phrase),
					hint: 'Pick a material from the list, or drop it to convert the plain unit.'
				});
			}
			return ok({
				value,
				unit_id: match.unit.id,
				dimension: match.unit.dimension,
				fuel_id: fuelId,
				target_unit_id: targetUnitId,
				time,
				price,
				efficiency,
				confidence: match.via === 'symbol' ? 1 : 0.9,
				notes: aliasNote(match, notes),
				original_input: original
			});
		}
		if (match.kind === 'ambiguous') {
			return err({
				kind: 'ambiguous_unit',
				message: `"${match.token}" is ambiguous — pick the one you mean:`,
				token: match.token,
				interpretations: match.interpretations
			});
		}
	}

	// 5. Nothing matched the unit slot — unknown unit, with suggestions
	//    (computed exactly once, here, on the failing token — see registry).
	return err(unknownUnitError(unitWords.join(' '), unitWords[0], units));
}

/* ------------------------------------------------------------------ *
 * Clause peeling
 * ------------------------------------------------------------------ */

/**
 * Split off a trailing `to <unit>` clause. Returns `undefined` when there is no
 * usable target, `{ error }` when a strong keyword was used with a tail that is
 * not a unit (so the user gets a precise message instead of a bogus
 * "unknown material").
 */
function peelTarget(
	words: string[],
	units: UnitRegistry
): { rest: string[]; unitId: string } | { error: ParseError } | undefined {
	for (let i = words.length - 2; i >= 0; i--) {
		const w = words[i].toLowerCase();
		const strong = STRONG_TARGET_WORDS.has(w);
		const weak = WEAK_TARGET_WORDS.has(w);
		if (!strong && !weak) continue;

		const tail = words.slice(i + 1).join(' ');
		const match = units.resolve(tail);
		if (match.kind === 'match') {
			return { rest: words.slice(0, i), unitId: match.unit.id };
		}
		if (match.kind === 'ambiguous') {
			return {
				error: {
					kind: 'ambiguous_unit',
					message: `The target "${match.token}" is ambiguous — pick the one you mean:`,
					token: match.token,
					interpretations: match.interpretations
				}
			};
		}
		if (strong) {
			return { error: unknownUnitError(tail, words[i + 1], units, true) };
		}
	}
	return undefined;
}

/**
 * Split off an appliance efficiency: `at 85% efficiency`, `85% efficient`,
 * `at 3.5 COP`, `with a COP of 3.5`.
 *
 * Recognised anywhere in the tail, because it reads naturally in several
 * positions, but only in these unmistakable shapes — a bare `85%` is NOT an
 * efficiency, since a stray percentage in a query would otherwise silently
 * change the answer.
 */
function peelEfficiency(
	words: string[]
): { rest: string[]; efficiency: Efficiency } | { error: ParseError } | undefined {
	const text = words.join(' ');

	// "85% efficiency" / "85 % efficient" / "at 85%" only when the word is there.
	const pct = text.match(
		/\s*(?:at|@|with)?\s*(?:an?\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(?:efficiency|efficient|eff\.?)\b\.?/i
	);
	// "COP 3.5" / "3.5 COP" / "a COP of 3.5" / "SCOP 3.1"
	const cop =
		text.match(/\s*(?:at|@|with)?\s*(?:an?\s+)?s?cop\s*(?:of\s*)?(\d+(?:[.,]\d+)?)/i) ??
		text.match(/\s*(?:at|@|with)?\s*(\d+(?:[.,]\d+)?)\s*s?cop\b/i);

	const hit = pct ?? cop;
	if (!hit) return undefined;

	const raw = normalizeNumber(hit[1]);
	const value = new Decimal(raw);
	if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
		return {
			error: {
				kind: 'unsupported_value',
				message: `An efficiency of ${hit[1]} is not usable — it has to be greater than zero.`,
				token: hit[1]
			}
		};
	}

	const isPercent = hit === pct;
	const ratio = isPercent ? value.dividedBy(100).toFixed() : value.toFixed();
	const label = isPercent ? `${raw}%` : `COP ${raw}`;

	const rest = (text.slice(0, hit.index) + text.slice(hit.index! + hit[0].length))
		.trim()
		.split(/\s+/)
		.filter((w) => w !== '');

	return { rest, efficiency: { ratio, label, kind: isPercent ? 'percent' : 'cop' } };
}

/**
 * Split off a trailing `at <amount> <currency>/<unit>` clause —
 * `1000 kWh at 0.32 EUR/kWh`, `1 L diesel @ 1.75 €/L`.
 *
 * The catalog carries no tariffs, so the ONLY way a price enters this tool is
 * the user typing one. Accordingly this is strict: the clause is consumed only
 * when it has an amount, a currency label and a real catalog unit after the
 * slash. Anything looser is left alone for the other matchers, because a
 * half-understood price would be worse than none.
 */
function peelPrice(
	words: string[],
	units: UnitRegistry
): { rest: string[]; price: Price; note?: string } | { error: ParseError } | undefined {
	for (let i = words.length - 1; i >= 1; i--) {
		if (!PRICE_WORDS.has(words[i].toLowerCase())) continue;
		const tail = words
			.slice(i + 1)
			.join(' ')
			.trim();
		if (tail === '') continue;

		// "0.32 EUR/kWh" / "0,32 €/kWh" / "1.75€ / L" — the slash is required, so
		// "at 3 kWh" is not mistaken for a price.
		const m = tail.match(/^([+-]?[\d.,\s]+?)\s*([^\s\d/]+)\s*\/\s*(.+)$/);
		if (!m) continue;
		const [, rawAmount, currency, perUnit] = m;

		const match = units.resolve(perUnit.trim());
		if (match.kind !== 'match') {
			return {
				error: {
					kind: 'unknown_unit',
					message: `"${perUnit.trim()}" is not a unit I know, so I cannot price per it. Try a price like "0.32 ${currency}/kWh".`,
					token: perUnit.trim()
				}
			};
		}

		// The RAW shape is checked before normalising, because normalisation is
		// lossy: "1,2,3" would come out as "123" and "1.2.3" would reach Decimal
		// and throw. A price is a plain number, optionally grouped.
		const rawTrimmed = rawAmount.trim().replace(/\s+/g, '');
		const wellFormed =
			/^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$/.test(rawTrimmed) ||
			/^\d+(?:[.,]\d+)?$/.test(rawTrimmed);

		// normalizeNumberWithWarning, not normalizeNumber: the thousands-separator
		// reading of "1,500" is a guess, and swallowing the warning here would bill
		// a German-locale user 1000x what they meant with nothing on screen.
		const { value: amount, warning: amountWarning } = normalizeNumberWithWarning(rawTrimmed);
		if (!wellFormed || !/^\d+(?:\.\d+)?$/.test(amount)) {
			return {
				error: {
					kind: 'unsupported_value',
					message: `"${rawAmount.trim()}" is not a price I can read. Use a plain number, e.g. "0.32 ${currency}/${perUnit.trim()}".`,
					token: rawAmount.trim()
				}
			};
		}
		if (new Decimal(amount).isNegative()) {
			return {
				error: {
					kind: 'unsupported_value',
					message: `A price cannot be negative (got ${rawAmount.trim()}).`,
					token: rawAmount.trim()
				}
			};
		}
		const magnitude = checkMagnitude(amount, rawAmount.trim());
		if (magnitude) return { error: magnitude };

		return {
			rest: words.slice(0, i),
			price: { amount, currency, per_unit_id: match.unit.id },
			note: amountWarning
		};
	}
	return undefined;
}

/**
 * Split off a trailing `for <n> <time unit>` clause (rulebook §B.3). Only a
 * genuine time unit is accepted, so "for wood pellets" is never read as a
 * duration.
 */
function peelDuration(
	words: string[],
	units: UnitRegistry
): { rest: string[]; time: Quantity } | { error: ParseError } | undefined {
	for (let i = words.length - 2; i >= 0; i--) {
		if (!DURATION_WORDS.has(words[i].toLowerCase())) continue;
		const parsed = parseDuration(words.slice(i + 1), units);
		if (!parsed) continue;
		if ('error' in parsed) return parsed;
		return { rest: words.slice(0, i), time: parsed.time };
	}
	return undefined;
}

/**
 * `["3","hours"]` / `["an","hour"]` / `["3h"]` → a time Quantity.
 * `undefined` means "this is not a duration at all" (leave the words alone);
 * an error means "this IS a duration and it is not usable", which must be said
 * out loud rather than silently ignored.
 */
function parseDuration(
	tail: string[],
	units: UnitRegistry
): { time: Quantity } | { error: ParseError } | undefined {
	if (tail.length === 0) return undefined;
	let text = tail.join(' ').trim();
	let value = '1';
	let rawValue = '1';

	if (DURATION_ARTICLES.has(tail[0].toLowerCase())) {
		text = tail.slice(1).join(' ').trim();
	} else {
		const numMatch = text.match(NUMBER_RE);
		if (numMatch) {
			rawValue = numMatch[1];
			value = normalizeNumberWithWarning(rawValue).value;
			text = text.slice(numMatch[0].length).trim();
		}
	}
	if (text === '') return undefined;

	const match = units.resolve(text);
	if (match.kind !== 'match' || match.unit.dimension !== 'time') return undefined;

	// The leading value has a magnitude guard; the duration needs the same one,
	// or "5 kW for 1e5000 h" produces a 5000-digit answer from a 17-char query.
	const magnitude = checkMagnitude(value, rawValue);
	if (magnitude) return { error: magnitude };
	if (value.startsWith('-')) {
		return {
			error: {
				kind: 'unsupported_value',
				message: `A duration cannot be negative (got ${rawValue} ${match.unit.symbols[0]}).`,
				token: rawValue
			}
		};
	}

	return { time: { value, unit_id: match.unit.id, dimension: 'time' } };
}

/* ------------------------------------------------------------------ *
 * Normalisation & errors
 * ------------------------------------------------------------------ */

/**
 * Normalise conversational phrasing into the core grammar: drop leading filler
 * and trailing punctuation, space out arrow/equals operators so they tokenise,
 * and rewrite "how many X in Y" into "Y to X".
 */
function prepare(input: string, units: UnitRegistry): string {
	let text = input.replace(/\s+/g, ' ').trim();
	// Strip a trailing question mark and stray "?" tokens ("1 kWh = ? MJ").
	text = text.replace(/\?+/g, ' ').replace(/\s+/g, ' ').trim();

	const ask = text.match(ASK_RE);
	if (ask) {
		const wanted = ask[1].trim();
		const source = ask[2].trim();
		// Only rewrite when the source half actually starts with a number —
		// otherwise we would invent a reading of a sentence we did not parse.
		if (NUMBER_RE.test(source)) {
			// Keep the wanted half only when it really names a unit. "how much CO2
			// is in 1 L diesel" then converts the litre of diesel (whose emissions
			// are one of the groups) instead of failing on a non-unit target.
			text = units.resolve(wanted).kind === 'match' ? `${source} to ${wanted}` : source;
		}
	}

	let previous: string;
	do {
		previous = text;
		text = text.replace(LEADING_FILLER_RE, '').trim();
	} while (text !== previous);

	// Space out operators so "5kWh->MJ", "1 kWh=kJ" and "5 kW*3h" tokenise. The
	// `-` of an arrow is only consumed together with `>`, so "1e-5" is untouched.
	//
	// Deliberately NOT a lookbehind: a lookbehind is a SYNTAX error in Safari
	// before 16.4, and because this is a regex literal the whole module would
	// fail to evaluate there — taking the entire site down, not just this input.
	text = text
		.replace(/(=>|->|→|⇒|×|·|\*)/g, ' $1 ')
		.replace(/([^\s=])=([^\s=])/g, '$1 = $2')
		.replace(/\s+/g, ' ')
		.trim();

	return text;
}

/** Reject values whose magnitude is outside the supported decimal range. */
function checkMagnitude(value: string, rawNumber: string): ParseError | undefined {
	try {
		const d = new Decimal(value);
		if (!d.isFinite() || (!d.isZero() && (d.e > MAX_ABS_EXPONENT || d.e < -MAX_ABS_EXPONENT))) {
			return {
				kind: 'unsupported_value',
				message: `The value ${rawNumber} is outside the supported range (10^±${MAX_ABS_EXPONENT}).`,
				token: rawNumber
			};
		}
	} catch {
		return {
			kind: 'missing_value',
			message: `Could not read "${rawNumber}" as a number.`,
			token: rawNumber
		};
	}
	return undefined;
}

/** Build the unknown-unit error, preferring an honest out-of-scope note over a
 *  meaningless edit-distance guess. */
function unknownUnitError(
	phrase: string,
	firstToken: string,
	units: UnitRegistry,
	isTarget = false
): ParseError {
	const scope = outOfScope(phrase) ?? outOfScope(firstToken);
	if (scope) {
		return {
			kind: 'unknown_unit',
			message: `${scope.label} is not supported (yet) — "${phrase}" is not in the catalog.`,
			token: phrase,
			hint: scope.note,
			suggestions: []
		};
	}
	const suggestions = units.suggest(firstToken);
	const what = isTarget ? 'target unit' : 'unit';
	return {
		kind: 'unknown_unit',
		message: suggestions.length
			? `Unknown ${what} "${phrase}". Did you mean one of these?`
			: `Unknown ${what} "${phrase}".`,
		token: phrase,
		hint: suggestions.length ? undefined : 'Browse the unit index to see everything supported.',
		suggestions
	};
}

function outOfScope(token: string): { label: string; note: string } | undefined {
	const key = token.toLowerCase().trim();
	for (const entry of OUT_OF_SCOPE) {
		if (entry.tokens.includes(key)) return { label: entry.label, note: entry.note };
	}
	return undefined;
}

/**
 * Normalise a numeric literal to a plain decimal string.
 * Handles comma decimals ("1,5" → "1.5") and thousands separators
 * ("1,000" / "1.000" / "1 000" → "1000") heuristically:
 *  - if the token has BOTH a comma and a dot, the LAST one is the decimal sep;
 *  - a LONE comma (no dot) is read as a DECIMAL separator when either:
 *      (a) the integer part is "0" (e.g. "0,835" → 0.835 — a European decimal
 *          density/quantity, never a thousands group with a "0" leading part), or
 *      (b) the digits after the comma are NOT exactly 3 (e.g. "1,5" → 1.5,
 *          "12,25" → 12.25 — a genuine 3-digit thousands group is the only
 *          shape we'd ever read as thousands);
 *  - MULTIPLE comma groups forming a valid thousands pattern (leading group
 *    <=3 digits, every following group exactly 3 digits) are read as
 *    thousands (e.g. "1,000,000" → 1000000);
 *  - the single remaining genuinely AMBIGUOUS shape — one comma, exactly 3
 *    trailing digits, and a nonzero integer part (e.g. "1,500") — keeps the
 *    THOUSANDS reading (matches common EN formatting), but see
 *    `normalizeNumberWithWarning`, which attaches a parser note flagging the
 *    interpretation so the caller can surface it (rulebook: no silent guesses).
 */
export function normalizeNumber(raw: string): string {
	return normalizeNumberWithWarning(raw).value;
}

/** Like `normalizeNumber`, but also returns a warning note for the one
 *  genuinely ambiguous shape (single comma, exactly 3 trailing digits,
 *  nonzero integer part) where we keep the thousands-separator reading. */
export function normalizeNumberWithWarning(raw: string): { value: string; warning?: string } {
	let s = raw.replace(/\s+/g, '');
	// ".5" / ",5" → "0.5" / "0,5" so downstream logic always sees an integer part.
	s = s.replace(/^([+-]?)([.,])/, '$10$2');
	const hasComma = s.includes(',');
	const hasDot = s.includes('.');

	if (hasComma && hasDot) {
		// The last separator is the decimal one; the other groups thousands.
		if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
			s = s.replace(/\./g, '').replace(',', '.');
		} else {
			s = s.replace(/,/g, '');
		}
		return { value: s };
	}

	if (hasComma) {
		const parts = s.split(',');
		const trailingGroups = parts.slice(1);
		const leadingOk = parts[0].length >= 1 && parts[0].length <= 3;
		const allTrailingAreThreeDigits = trailingGroups.every((p) => p.length === 3);

		if (parts.length > 2) {
			// Multiple comma groups: only a valid thousands pattern is accepted
			// ("1,000,000"); anything else is left for downstream validation.
			if (leadingOk && allTrailingAreThreeDigits) {
				return { value: parts.join('') };
			}
			return { value: s.replace(/,/g, '') };
		}

		// Single comma.
		const integerPart = parts[0];
		const fraction = parts[1] ?? '';
		const integerIsZero = /^0+$/.test(integerPart);

		if (integerIsZero) {
			// "0,835" -> 0.835: never a thousands group with a zero leading part.
			return { value: `${integerPart}.${fraction}` };
		}
		if (fraction.length !== 3) {
			// "1,5" -> 1.5, "12,25" -> 12.25: only an exact 3-digit trailing group
			// is even a candidate for a thousands separator.
			return { value: `${integerPart}.${fraction}` };
		}
		// Genuinely ambiguous: one comma, exactly 3 trailing digits, nonzero
		// integer part (e.g. "1,500"). Keep the thousands reading (common EN
		// formatting), but flag it — never guess silently.
		return {
			value: `${integerPart}${fraction}`,
			warning: `read "${raw}" as ${integerPart}${fraction} (thousands separator); write "${integerPart}.${fraction}" if you meant the decimal ${integerPart}.${fraction}`
		};
	}

	// Lone dots are already valid decimals; multiple dots as thousands are rare
	// and left to fail validation downstream rather than guessed wrongly.
	return { value: s };
}

function aliasNote(
	match: { kind: 'match'; via: 'symbol' | 'name' | 'alias'; unit: { id: string; names: string[] } },
	notes: string[]
): string[] | undefined {
	// Gently confirm the food-Calorie interpretation (rulebook C.4, D.7).
	if (match.unit.id === 'food_calorie') {
		notes.push("interpreting 'Calorie' as kcal (dietary Calorie = kilocalorie)");
	}
	return notes.length ? notes : undefined;
}

function ok(query: ParsedQuery): ParseResult {
	return { ok: true, query };
}

function err(error: ParseError): ParseResult {
	return { ok: false, error };
}
