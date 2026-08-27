/**
 * Dimension helpers (rulebook §B). Which dimensions are base vs pseudo, and the
 * canonical base unit id for each base dimension (the unit whose to_base_factor
 * is "1"). The engine converts within a dimension by going through this base.
 */

import {
	BASE_DIMENSIONS,
	PSEUDO_DIMENSIONS,
	type BaseDimension,
	type Dimension
} from '$lib/conversion/types';

/** Canonical base-unit id per base dimension (to_base_factor === "1"). */
export const BASE_UNIT_ID = {
	energy: 'joule',
	power: 'watt',
	mass: 'kilogram',
	volume: 'cubic_meter',
	time: 'second'
} satisfies Record<BaseDimension, string>;

export function isBaseDimension(d: Dimension): d is BaseDimension {
	return BASE_DIMENSIONS.some((base) => base === d);
}

export function isPseudoDimension(d: Dimension): boolean {
	return PSEUDO_DIMENSIONS.some((pseudo) => pseudo === d);
}

/**
 * The two emission pseudo-dimensions that must never be bridged (rulebook §B.2,
 * §C.5, §D.6). Exposed so guards can special-case a CO2↔CO2e request.
 */
export const CO2_DIMENSION = 'emission_mass_co2';
export const CO2E_DIMENSION = 'emission_mass_co2e';
