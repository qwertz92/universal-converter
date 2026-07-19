/**
 * Shareable converter URL state (spec frontend brief): `?q=` holds the free-text
 * query, `?basis=` the heating-value basis, `?region=`/`?year=` the grid
 * electricity choice (rulebook §C.6). Kept tiny and framework-light so the
 * Converter component can read/write it with SvelteKit's `goto`.
 */

import type { HeatingBasis } from '$lib/conversion/types';

export interface ConverterUrlState {
	q: string;
	basis: HeatingBasis;
	/** Grid region for electricity emissions (only meaningful together with `year`). */
	region?: string;
	/** Grid year for electricity emissions. */
	year?: number;
}

export function readUrlState(url: URL): ConverterUrlState {
	const q = url.searchParams.get('q') ?? '';
	const basisParam = url.searchParams.get('basis');
	const basis: HeatingBasis = basisParam === 'hhv' ? 'hhv' : 'lhv';
	const region = url.searchParams.get('region') ?? undefined;
	const yearRaw = url.searchParams.get('year');
	const yearNum = yearRaw !== null ? Number.parseInt(yearRaw, 10) : Number.NaN;
	const year = Number.isInteger(yearNum) && yearNum > 0 ? yearNum : undefined;
	// Half-set grid state is meaningless — require both, else neither.
	if (region !== undefined && year !== undefined) return { q, basis, region, year };
	return { q, basis };
}

/** Build a query-string (without leading '?') for the given state. */
export function buildQueryString(state: ConverterUrlState): string {
	const params = new URLSearchParams();
	if (state.q.trim()) params.set('q', state.q.trim());
	if (state.basis === 'hhv') params.set('basis', 'hhv');
	if (state.region !== undefined && state.year !== undefined) {
		params.set('region', state.region);
		params.set('year', String(state.year));
	}
	const s = params.toString();
	return s ? `?${s}` : '';
}
