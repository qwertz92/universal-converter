/**
 * Exact, dimension-internal conversion via decimal.js (spec §3.1). All
 * arithmetic uses decimal strings — never a float chain (AGENTS.md, spec §4.2).
 *
 * Conversion within a dimension: value_in_target =
 *   value × (from.to_base_factor / to.to_base_factor)
 * carried out at high precision, returned as a full-precision decimal string.
 */

import Decimal from 'decimal.js';
import type { Unit } from '$lib/conversion/types';

// Generous working precision; display rounding happens later (rulebook §C.7).
Decimal.set({ precision: 40 });

export function toDecimal(value: string | number): Decimal {
	return new Decimal(value);
}

/**
 * Convert a value from one unit to another WITHIN THE SAME DIMENSION.
 * Throws if the dimensions differ (callers must route cross-dimension work
 * through the engine's bridges, not here).
 */
export function convertWithinDimension(value: string, from: Unit, to: Unit): string {
	if (from.dimension !== to.dimension) {
		throw new Error(
			`convertWithinDimension: dimension mismatch ${from.dimension} -> ${to.dimension}`
		);
	}
	const v = new Decimal(value);
	const factor = new Decimal(from.to_base_factor).div(new Decimal(to.to_base_factor));
	return v.times(factor).toFixed();
}

/** Convert a value to its dimension's base unit (multiply by to_base_factor). */
export function toBaseValue(value: string, unit: Unit): string {
	return new Decimal(value).times(new Decimal(unit.to_base_factor)).toFixed();
}

/** Convert a base-unit value into `unit` (divide by to_base_factor). */
export function fromBaseValue(baseValue: string, unit: Unit): string {
	return new Decimal(baseValue).div(new Decimal(unit.to_base_factor)).toFixed();
}
