/**
 * Split a result group's rows into runs that share a heating-value basis, so
 * the UI can put a heading over each run (rulebook §C.1: the basis is always
 * labeled). Engine order is kept: a run ends where the basis changes, and rows
 * without a basis form runs of their own with `basis` undefined.
 */

import type { ConversionResult, Exactness, HeatingBasis } from '#lib/conversion/types.js';

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

/**
 * The exactness most rows of a section share, so the UI can state it once
 * above the rows instead of repeating the same badge on every line (and
 * doubling each row's height on a phone). Only rows with a value count; it
 * needs at least two of them and a strict majority. Rows that differ keep
 * their own badge, so no figure ever loses its label.
 */
export function sharedExactness(rows: readonly ConversionResult[]): Exactness | undefined {
	const valued = rows.filter((r) => r.value !== null);
	if (valued.length < 2) return undefined;
	const counts = new Map<Exactness, number>();
	for (const r of valued) counts.set(r.exactness, (counts.get(r.exactness) ?? 0) + 1);
	let best: Exactness | undefined;
	let bestCount = 0;
	for (const [exactness, n] of counts) {
		if (n > bestCount) {
			best = exactness;
			bestCount = n;
		}
	}
	return bestCount * 2 > valued.length ? best : undefined;
}
