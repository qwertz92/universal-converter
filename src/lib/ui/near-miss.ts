/**
 * "Did you mean" suggestions for a misspelled slug or search ("natural gass").
 *
 * The index search (search.ts) matches substrings only, so one wrong letter
 * finds nothing. This offers the catalog entries whose id or name is within a
 * few single-letter edits of what was typed. It only ever *suggests* — a caller
 * links to the entry, it never redirects — and it compares words only: unit
 * symbols are short and case carries meaning in them (m is milli, M is mega),
 * so a one-letter slip there names a different unit.
 */

/** Lower-case, with hyphens, underscores and runs of whitespace as single spaces. */
function normalise(s: string): string {
	return s
		.toLowerCase()
		.replace(/[-_\s]+/g, ' ')
		.trim();
}

/**
 * Edit distance counting an insertion, a deletion, a substitution and the swap
 * of two neighbouring letters (the way people mistype) as one edit each.
 */
export function editDistance(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const d: number[][] = Array.from({ length: rows }, (_, i) => {
		const row = new Array<number>(cols).fill(0);
		row[0] = i;
		return row;
	});
	for (let j = 0; j < cols; j++) d[0][j] = j;
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			}
		}
	}
	return d[rows - 1][cols - 1];
}

/** How many edits a query of this length may be away from a name. */
function allowedEdits(length: number): number {
	if (length < 4) return 0; // "lpg" vs "lng": one slip names another thing
	return length < 8 ? 1 : 2;
}

/**
 * The items whose labels (ids and names) are closest to the query, nearest
 * first and at most `limit`; an empty list when nothing is close enough.
 */
export function closestMatches<T>(
	query: string,
	items: readonly T[],
	labels: (item: T) => readonly string[],
	limit = 3
): T[] {
	const q = normalise(query);
	const max = allowedEdits(q.length);
	if (max === 0) return [];
	const scored: { item: T; distance: number }[] = [];
	for (const item of items) {
		let best = Infinity;
		for (const label of labels(item)) {
			const l = normalise(label);
			// Lengths further apart than the allowance cannot be within it.
			if (Math.abs(l.length - q.length) > max) continue;
			best = Math.min(best, editDistance(q, l));
		}
		if (best <= max) scored.push({ item, distance: best });
	}
	// Array.prototype.sort is stable: ties keep catalog order.
	return scored
		.sort((a, b) => a.distance - b.distance)
		.slice(0, limit)
		.map((s) => s.item);
}
