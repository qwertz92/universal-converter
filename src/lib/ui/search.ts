/**
 * Lightweight client-side search/ranking for units and fuels. Matches across
 * names, symbols and aliases (synonym matching, spec §8.1), ranks exact/prefix
 * matches first, and is forgiving of case and spacing.
 */

import type { Fuel, Unit } from '$lib/conversion/types';

function norm(s: string): string {
	return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** All searchable tokens for a unit (names + symbols + aliases + id). */
function unitTokens(u: Unit): string[] {
	return [...u.names, ...u.symbols, ...u.aliases, u.id];
}

function fuelTokens(f: Fuel): string[] {
	return [...f.names, ...f.aliases, f.id, f.category];
}

/** Score a set of tokens against a query; higher is better, -1 = no match. */
function scoreTokens(tokens: string[], q: string): number {
	const nq = norm(q);
	if (nq === '') return 0;
	let best = -1;
	for (const t of tokens) {
		const nt = norm(t);
		if (nt === nq) best = Math.max(best, 100);
		else if (nt.startsWith(nq)) best = Math.max(best, 70 - Math.min(nt.length - nq.length, 20));
		else if (nt.includes(nq)) best = Math.max(best, 40 - Math.min(nt.length - nq.length, 20));
	}
	return best;
}

/** Filter + rank units by a free-text query. Empty query returns all in order. */
export function searchUnits(units: Unit[], query: string, limit = 50): Unit[] {
	if (norm(query) === '') return units.slice(0, limit);
	return units
		.map((u) => ({ u, s: scoreTokens(unitTokens(u), query) }))
		.filter((x) => x.s >= 0)
		.sort((a, b) => b.s - a.s)
		.slice(0, limit)
		.map((x) => x.u);
}

/** Filter + rank fuels by a free-text query. Empty query returns all in order. */
export function searchFuels(fuels: Fuel[], query: string, limit = 50): Fuel[] {
	if (norm(query) === '') return fuels.slice(0, limit);
	return fuels
		.map((f) => ({ f, s: scoreTokens(fuelTokens(f), query) }))
		.filter((x) => x.s >= 0)
		.sort((a, b) => b.s - a.s)
		.slice(0, limit)
		.map((x) => x.f);
}

/**
 * A trailing-edge debounce. `cancel()` genuinely disarms a pending call — the
 * doc used to promise that without providing it, so a conversion triggered
 * directly (a chip, a fuel pick, an applied duration) could be overwritten
 * milliseconds later by the keystroke that was still queued, leaving the
 * displayed result disagreeing with the input box and the URL.
 */
export interface Debounced<A extends unknown[]> {
	(...args: A): void;
	cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
	let t: ReturnType<typeof setTimeout> | undefined;
	const wrapped = (...args: A) => {
		if (t) clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
	wrapped.cancel = () => {
		if (t) clearTimeout(t);
		t = undefined;
	};
	return wrapped;
}
