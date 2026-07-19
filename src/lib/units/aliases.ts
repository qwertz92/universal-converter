/**
 * Token normalisation for unit/fuel matching (spec §8.2, §8.1 synonym detection).
 *
 * Names and aliases match case-insensitively; symbols match case-SENSITIVELY
 * (so a future "mW" milliwatt vs "MW" megawatt never collide — rulebook designs
 * for this even though v0.1 has no such clash). We therefore keep two indexes.
 */

/** Lowercase + collapse whitespace + strip surrounding punctuation for name/alias keys. */
export function normalizeLoose(token: string): string {
	return token
		.toLowerCase()
		.replace(/[³]/g, '3') // ³ -> 3 so "m³" and "m3" collide
		.replace(/[²]/g, '2')
		.replace(/[μ]/g, 'µ') // Greek mu U+03BC -> micro sign U+00B5 (one canonical form)
		.replace(/\s+/g, ' ')
		.trim();
}

/** Symbols keep case but still normalise superscripts, mu variants and whitespace. */
export function normalizeSymbol(token: string): string {
	return token
		.replace(/[³]/g, '3')
		.replace(/[²]/g, '2')
		.replace(/[μ]/g, 'µ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Levenshtein distance for "did you mean" suggestions on unknown units. */
export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	let curr = new Array<number>(b.length + 1);
	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[b.length];
}
