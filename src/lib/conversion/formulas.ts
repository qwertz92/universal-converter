/**
 * Human-readable calculation-path strings (rulebook §C.8 "Formula / Calculation
 * Path"). Small string builders so every result can show its chain, e.g.
 * "1 L diesel × 0.835 kg/L [density] = 0.835 kg".
 */

/** "a op b = c" style step, with an optional bracketed provenance note. */
export function step(
	lhs: string,
	op: '×' | '÷' | '=' | '→',
	rhs: string,
	result?: string,
	note?: string
): string {
	const core = `${lhs} ${op} ${rhs}`;
	const noted = note ? `${core} [${note}]` : core;
	return result ? `${noted} = ${result}` : noted;
}

/** Join a chain of formula fragments with " → " for the calculation path. */
export function chain(...parts: (string | undefined)[]): string {
	return parts.filter(Boolean).join('  →  ');
}
