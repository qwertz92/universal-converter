/**
 * Free-text parser (spec §8.2). Grammar: [number][unit][optional fuel].
 *
 * Handles:
 *  - `1 kWh`, `1.5 MJ`, `1,5 MJ` (comma decimal), `1000 kcal`, `1 kilowatt hour`;
 *  - `1 liter diesel`, `1 L gasoline`, `1 barrel crude oil`, `1 m3 natural gas`,
 *    `1 kg hydrogen`, `2 kg wood pellets` (trailing fuel phrase);
 *  - number glued to unit: `1.5MJ`, `1000kcal`.
 *
 * Returns a `ParsedQuery` (matched unit + optional fuel id + confidence) or a
 * structured `ParseError`:
 *  - unknown unit → suggestions (closest matches);
 *  - missing value → error;
 *  - ambiguous token (e.g. "ton", "gallon") → the competing interpretations.
 *
 * Fuel matching uses the provided registries; it works with an EMPTY fuel
 * catalog (a trailing unknown fuel phrase yields `unknown_fuel`).
 */

import type { ParseError, ParseResult, ParsedQuery } from './types';
import type { UnitRegistry } from '$lib/units/registry';
import type { FuelRegistry } from '$lib/fuels/registry';

/** Leading number: optional sign, digits with `.` or `,` decimal, optional exponent. */
const NUMBER_RE = /^([+-]?(?:\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[.,]\d+)?(?:[eE][+-]?\d+)?)/;

export function parseQuery(text: string, units: UnitRegistry, fuels: FuelRegistry): ParseResult {
	const original = text;
	const trimmed = text.trim();
	if (trimmed === '') {
		return err({ kind: 'empty_input', message: 'Enter a value and a unit, e.g. "1 kWh".' });
	}

	// 1. Extract the leading numeric literal.
	const numMatch = trimmed.match(NUMBER_RE);
	if (!numMatch) {
		return err({
			kind: 'missing_value',
			message: 'No number found. Start with a value, e.g. "1 kWh" or "1000 kcal".',
			token: trimmed.split(/\s+/)[0]
		});
	}
	const rawNumber = numMatch[1];
	const { value, warning: numberWarning } = normalizeNumberWithWarning(rawNumber);
	const rest = trimmed.slice(numMatch[0].length).trim();

	if (rest === '') {
		return err({
			kind: 'no_unit',
			message: `Got the value ${value} but no unit. Add a unit, e.g. "${value} kWh".`
		});
	}

	// 2. Split the remainder into words. The unit is a leading run of word(s);
	//    a trailing fuel phrase (if any) is peeled off first so multi-word units
	//    like "kilowatt hour" and multi-word fuels like "wood pellets" coexist.
	const words = rest.split(/\s+/);
	const notes: string[] = numberWarning ? [numberWarning] : [];

	// First, try to interpret the WHOLE remainder as a unit (covers "kilowatt hour").
	const wholeMatch = units.resolve(rest);
	if (wholeMatch.kind === 'match') {
		return ok({
			value,
			unit_id: wholeMatch.unit.id,
			dimension: wholeMatch.unit.dimension,
			confidence: wholeMatch.via === 'symbol' ? 1 : 0.95,
			notes: aliasNote(wholeMatch, notes),
			original_input: original
		});
	}
	if (wholeMatch.kind === 'ambiguous') {
		return err({
			kind: 'ambiguous_unit',
			message: `"${wholeMatch.token}" is ambiguous. Which did you mean?`,
			token: wholeMatch.token,
			interpretations: wholeMatch.interpretations
		});
	}

	// 3. Peel a trailing fuel phrase, then match the leading words as the unit.
	const fuelMatch = fuels.matchTrailingFuel(words);
	let unitWords = words;
	let fuelId: string | undefined;
	if (fuelMatch) {
		unitWords = words.slice(0, words.length - fuelMatch.consumed);
		fuelId = fuelMatch.fuel.id;
	}

	if (unitWords.length === 0) {
		// e.g. "1 diesel" — a fuel but no unit token.
		return err({
			kind: 'no_unit',
			message: `Add a unit before the material, e.g. "${value} L ${fuelId ?? ''}".`.trim()
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
			if (leftover.length > 0 && !fuelId) {
				// Leftover might be an unknown fuel phrase.
				return err({
					kind: 'unknown_fuel',
					message: `Unknown material "${leftover.join(' ')}". Known units parsed; pick a material from the list.`,
					token: leftover.join(' ')
				});
			}
			return ok({
				value,
				unit_id: match.unit.id,
				dimension: match.unit.dimension,
				fuel_id: fuelId,
				confidence: match.via === 'symbol' ? 1 : 0.9,
				notes: aliasNote(match, notes),
				original_input: original
			});
		}
		if (match.kind === 'ambiguous') {
			return err({
				kind: 'ambiguous_unit',
				message: `"${match.token}" is ambiguous. Which did you mean?`,
				token: match.token,
				interpretations: match.interpretations
			});
		}
	}

	// 4. Nothing matched the unit slot — unknown unit, with suggestions.
	const firstToken = unitWords.join(' ');
	const unknown = units.resolve(unitWords[0]);
	const suggestions = unknown.kind === 'unknown' ? unknown.suggestions : [];
	return err({
		kind: 'unknown_unit',
		message: `Unknown unit "${firstToken}".${
			suggestions.length ? ` Did you mean: ${suggestions.join(', ')}?` : ''
		}`,
		token: firstToken,
		suggestions
	});
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

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
