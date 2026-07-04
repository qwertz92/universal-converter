/**
 * Shareable converter URL state (spec frontend brief): `?q=` holds the free-text
 * query, `?basis=` holds the heating-value basis. Kept tiny and framework-light
 * so the Converter component can read/write it with SvelteKit's `goto`.
 */

import type { HeatingBasis } from '$lib/conversion/types';

export interface ConverterUrlState {
	q: string;
	basis: HeatingBasis;
}

export function readUrlState(url: URL): ConverterUrlState {
	const q = url.searchParams.get('q') ?? '';
	const basisParam = url.searchParams.get('basis');
	const basis: HeatingBasis = basisParam === 'hhv' ? 'hhv' : 'lhv';
	return { q, basis };
}

/** Build a query-string (without leading '?') for the given state. */
export function buildQueryString(state: ConverterUrlState): string {
	const params = new URLSearchParams();
	if (state.q.trim()) params.set('q', state.q.trim());
	if (state.basis === 'hhv') params.set('basis', 'hhv');
	const s = params.toString();
	return s ? `?${s}` : '';
}
