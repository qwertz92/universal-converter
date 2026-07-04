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

/** Max significant figures per exactness level (rulebook §C.7). */
export function sigFigsFor(exactness: Exactness, maxExact = 6): number {
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
export function roundToSigFigs(value: string, sigFigs: number): string {
	const d = new Decimal(value);
	if (d.isZero()) return '0';
	const rounded = d.toSignificantDigits(sigFigs, Decimal.ROUND_HALF_EVEN);
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
	const rounded = roundToSigFigs(value, sig);
	const withSep = opts.thousands === false ? rounded : withThousandsSeparators(rounded);
	return usesApproxMarker(exactness) ? `~${withSep}` : withSep;
}

/** Format a low–high range as "~A–B" (used for estimates; rulebook §C.7 rule 2). */
export function formatRange(
	low: string,
	high: string,
	exactness: Exactness,
	opts: { maxExactSigFigs?: number } = {}
): string {
	const sig = sigFigsFor(exactness, opts.maxExactSigFigs ?? 6);
	const lo = withThousandsSeparators(roundToSigFigs(low, sig));
	const hi = withThousandsSeparators(roundToSigFigs(high, sig));
	const prefix = usesApproxMarker(exactness) ? '~' : '';
	return `${prefix}${lo}–${hi}`;
}
