/**
 * Whether a result row has anything to show behind its "Details" disclosure.
 * Shared by the row (to render the button) and its group card (to reserve the
 * button's slot on rows without one, so badges and copy buttons line up in a
 * column instead of shifting row by row).
 */

import type { ConversionResult } from '$lib/conversion/types';

export function rowHasDetail(result: ConversionResult): boolean {
	// Value-less rows already show their explanation inline — the disclosure is
	// only worth rendering when it adds something beyond that.
	return Boolean(
		result.formula ||
		result.assumptions.length ||
		result.warnings.length ||
		result.source_refs.length ||
		(result.value !== null && result.explanation)
	);
}
