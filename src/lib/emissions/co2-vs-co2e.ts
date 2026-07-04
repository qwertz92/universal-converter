/**
 * The CO2 ↔ CO2e separation guard (rulebook §B.2 hard rule, §C.5, §D.6).
 * There is NO conversion path between the two pseudo-dimensions; a request to
 * convert one into the other is `unsupported` with an explanation.
 */

import { CO2_DIMENSION, CO2E_DIMENSION } from '$lib/units/dimensions';
import type { Dimension } from '$lib/conversion/types';

/** True when going from `from` to `to` would illegally cross CO2 and CO2e. */
export function isCo2Co2eCrossing(from: Dimension, to: Dimension): boolean {
	return (
		(from === CO2_DIMENSION && to === CO2E_DIMENSION) ||
		(from === CO2E_DIMENSION && to === CO2_DIMENSION)
	);
}

export const CO2_CO2E_EXPLANATION =
	'CO2 and CO2e are different metrics, not different amounts of the same thing. ' +
	'CO2e bundles other greenhouse gases (CH4, N2O, …) weighted by their global ' +
	'warming potential, so it cannot be derived from a CO2 figure (or vice versa) ' +
	'without the underlying gas breakdown and a stated GWP set. This tool never ' +
	'invents an uplift between them.';
