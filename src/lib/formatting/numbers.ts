/**
 * Number formatting honouring the exactness-bounded precision policy
 * (rulebook §C.7). Precision is BOUNDED BY EXACTNESS — showing 6 sig figs for
 * an estimate is itself a domain error (spec §17.25). We compute in full
 * precision (decimal.js) and only round at display time here.
 *
 * Rules implemented:
 *  - sig-fig cap per exactness level (§C.7 table);
 *  - leading `~` ONLY for estimated / region_year_specific (never on exact);
 *  - round-half-to-even at display (§C.7 rule 5);
 *  - thousands separators for readability;
 *  - trailing zeros respected up to the sig-fig cap (§C.7 rule 4).
 */

import Decimal from 'decimal.js';
import type { Exactness } from '$lib/conversion/types';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** Max significant figures per exactness level (rulebook §C.7). `maxExact` is
 *  clamped to [1, 15] — decimal.js throws on 0/negative significant digits and
 *  the option is publicly reachable via EngineOptions.maxSigFigs. */
export function sigFigsFor(exactness: Exactness, maxExact = 6): number {
	maxExact = Math.min(15, Math.max(1, Math.floor(maxExact) || 1));
	switch (exactness) {
		case 'exact':
		case 'standard_definition':
			return maxExact;
		case 'source_based':
			return 4;
		case 'estimated':
			return 3;
		case 'region_year_specific':
			return 3;
		case 'user_assumption':
			return 6; // inherit the assumed value's precision; capped generously
		default:
			return maxExact;
	}
}

/** Whether a `~` marker prefixes the display value for this exactness. */
export function usesApproxMarker(exactness: Exactness): boolean {
	return exactness === 'estimated' || exactness === 'region_year_specific';
}

/**
 * Round a decimal string to N significant figures (round-half-to-even) and
 * return a plain (non-exponential) decimal string, trimming redundant trailing
 * zeros beyond the point but keeping integer magnitude.
 */
export function roundToSigFigs(
	value: string,
	sigFigs: number,
	/** Rounding mode; defaults to half-to-even (§C.7 rule 5, first half). */
	mode: Decimal.Rounding = Decimal.ROUND_HALF_EVEN
): string {
	const d = new Decimal(value);
	if (d.isZero()) return '0';
	const sd = Math.min(15, Math.max(1, Math.floor(sigFigs) || 1));
	const rounded = d.toSignificantDigits(sd, mode);
	// toFixed() avoids exponential notation for the value ranges we handle.
	return trimTrailingZeros(rounded.toFixed());
}

function trimTrailingZeros(s: string): string {
	if (!s.includes('.')) return s;
	return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Insert thousands separators into the integer part of a plain decimal string. */
export function withThousandsSeparators(plain: string, separator = ','): string {
	const neg = plain.startsWith('-');
	const body = neg ? plain.slice(1) : plain;
	const [intPart, fracPart] = body.split('.');
	const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
	const out = fracPart ? `${grouped}.${fracPart}` : grouped;
	return neg ? `-${out}` : out;
}

/**
 * Format a full-precision value for display given its exactness. Returns the
 * user-facing string (with `~` where required and thousands separators).
 */
export function formatValue(
	value: string,
	exactness: Exactness,
	opts: { maxExactSigFigs?: number; thousands?: boolean } = {}
): string {
	const sig = sigFigsFor(exactness, opts.maxExactSigFigs ?? 6);
	// An EXACT value that already terminates is shown in full, never rounded.
	// The 6-significant-figure cap is a readability budget for values with more
	// precision than anyone needs — applied to an exact one it changed the
	// number while still labeling it "exact": `1234567 kWh to kWh` echoed back
	// 1,234,570, three off from what the reader had typed, with no `~` (which is
	// correctly suppressed for exact) to hint that anything had been rounded.
	// An explicit maxExactSigFigs is a caller ASKING to be capped (the API's
	// ?sig= parameter), and it wins — the rule below is about the default
	// readability budget, not about overriding a request.
	const showInFull =
		opts.maxExactSigFigs === undefined &&
		isExactLevel(exactness) &&
		significantDigits(value) <= MAX_LOSSLESS_SIG_FIGS;
	const rounded = showInFull ? normalizeDecimalString(value) : roundToSigFigs(value, sig);
	const withSep = opts.thousands === false ? rounded : withThousandsSeparators(rounded);
	return usesApproxMarker(exactness) ? `~${withSep}` : withSep;
}

/** Levels that promise the displayed number IS the number (rulebook §C.7). */
function isExactLevel(exactness: Exactness): boolean {
	return exactness === 'exact' || exactness === 'standard_definition';
}

/**
 * How many digits a terminating decimal may have before rounding it is the
 * lesser evil. Beyond this a value is the tail of a division that does not
 * terminate (1 kWh in BTU carries 40 digits at the engine's precision), and
 * printing all of it helps nobody.
 */
const MAX_LOSSLESS_SIG_FIGS = 15;

/** Significant digits in a plain decimal string, ignoring sign and leading zeros. */
function significantDigits(value: string): number {
	const digits = value.replace(/^[+-]/, '').replace('.', '').replace(/^0+/, '');
	// Trailing zeros of an integer are not significant for this purpose: "3600000"
	// is one meaningful figure plus scale, and must not be forced through rounding.
	return digits.replace(/0+$/, '').length || 1;
}

/** Strip a redundant trailing ".0…" so an exact value reads as a plain number. */
function normalizeDecimalString(value: string): string {
	return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/** Format a low–high range as "~A–B" (used for estimates; rulebook §C.7 rule 2). */
export function formatRange(
	low: string,
	high: string,
	exactness: Exactness,
	opts: { maxExactSigFigs?: number } = {}
): string {
	const sig = sigFigsFor(exactness, opts.maxExactSigFigs ?? 6);
	// §C.7 rule 5, second half: bounds round OUTWARD. Rounding them to nearest
	// pulls them inward, so the stated range understates the real spread —
	// anthracite's 8.9444 kWh upper bound displayed as 8.94.
	const lo = withThousandsSeparators(roundToSigFigs(low, sig, Decimal.ROUND_FLOOR));
	const hi = withThousandsSeparators(roundToSigFigs(high, sig, Decimal.ROUND_CEIL));
	const prefix = usesApproxMarker(exactness) ? '~' : '';
	return `${prefix}${lo}–${hi}`;
}
