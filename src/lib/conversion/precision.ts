/**
 * Exactness combination for a calculation chain (rulebook §A: exactness is a
 * FLOOR propagated by the weakest link). Given the exactness of each step, the
 * result takes the LEAST exact of the numeric levels.
 *
 * The two non-numeric terminal states (`context_required`, `unsupported`) are
 * NOT blended here — the engine's guards decide those before any arithmetic
 * runs. This helper only combines the numeric levels of an actual computation.
 */

import { EXACTNESS_ORDER, type Exactness } from './types';

/** Combine step exactnesses into the chain's floor (least exact wins). */
export function combineExactness(...levels: Exactness[]): Exactness {
	if (levels.length === 0) return 'exact';
	let worst: Exactness = 'exact';
	for (const level of levels) {
		if (EXACTNESS_ORDER[level] > EXACTNESS_ORDER[worst]) worst = level;
	}
	return worst;
}
