/**
 * Split a result group's rows into runs that share a heating-value basis, so
 * the UI can put a heading over each run (rulebook §C.1: the basis is always
 * labeled). Engine order is kept: a run ends where the basis changes, and rows
 * without a basis form runs of their own with `basis` undefined.
 */

import type { ConversionResult, HeatingBasis } from '$lib/conversion/types';

export interface BasisSection {
	basis?: HeatingBasis;
	rows: ConversionResult[];
}

export function basisSections(rows: readonly ConversionResult[]): BasisSection[] {
	const out: BasisSection[] = [];
	for (const row of rows) {
		const last = out.at(-1);
		if (last && last.basis === row.basis) last.rows.push(row);
		else out.push({ basis: row.basis, rows: [row] });
	}
	return out;
}
