/**
 * Pure request handler behind `GET /api/convert` (roadmap 0.2: public API
 * draft). Framework-independent — it consumes a `URL` and returns a plain
 * `{ status, body, headers }` object, so it is unit-testable without SvelteKit
 * and runs unchanged in the Cloudflare Workers runtime (Web APIs only).
 *
 * Contract (DRAFT — may change until 1.0):
 *   GET /api/convert?q=1+L+diesel[&basis=lhv|hhv][&region=UK&year=2025][&sigfigs=6]
 *   → 200 { api_version, exactness_note, result: ConversionResultSet }
 *   → 400 { api_version, error: { kind, message, … } } for missing/invalid
 *     parameters and parse failures (the ParseError is passed through verbatim).
 *
 * The response is a pure function of the query string, so it is served with a
 * public cache header. CORS is wide open — the data is public and the endpoint
 * is read-only.
 */

import { getConverter } from '$lib/index';
import type { EngineOptions, HeatingBasis } from '$lib/conversion/types';

/** Bumped when the response shape changes; mirrors the app version line. */
export const API_VERSION = '0.2-draft';

const EXACTNESS_NOTE =
	'Every result carries an `exactness` level (exact | standard_definition | source_based | ' +
	'estimated | region_year_specific | user_assumption | context_required | unsupported) and ' +
	'non-exact results carry source_refs. Treat `value` as display text; `raw` is the ' +
	'full-precision decimal string. This API is a draft and may change before 1.0.';

export interface EndpointResult {
	status: number;
	body: unknown;
	headers: Record<string, string>;
}

const BASE_HEADERS: Record<string, string> = {
	'content-type': 'application/json; charset=utf-8',
	'access-control-allow-origin': '*',
	'x-api-version': API_VERSION
};

function ok(body: unknown): EndpointResult {
	return {
		status: 200,
		body,
		// Pure function of the URL → safe to cache publicly for a day.
		headers: { ...BASE_HEADERS, 'cache-control': 'public, max-age=86400' }
	};
}

function badRequest(error: unknown): EndpointResult {
	return {
		status: 400,
		body: { api_version: API_VERSION, error },
		headers: { ...BASE_HEADERS, 'cache-control': 'no-store' }
	};
}

/** Handle a convert request. Pure; never throws on user input. */
export function handleConvertRequest(url: URL): EndpointResult {
	const q = url.searchParams.get('q');
	if (q === null || q.trim() === '') {
		return badRequest({
			kind: 'missing_query',
			message:
				'Missing ?q= parameter. Example: /api/convert?q=1+L+diesel — optional: ' +
				'&basis=lhv|hhv, &region=UK&year=2025 (grid electricity), &sigfigs=1..12.'
		});
	}

	const options: EngineOptions = {};

	const basisRaw = url.searchParams.get('basis');
	if (basisRaw !== null) {
		if (basisRaw !== 'lhv' && basisRaw !== 'hhv') {
			return badRequest({
				kind: 'invalid_parameter',
				message: `Invalid basis "${basisRaw}" — use "lhv" (default) or "hhv".`
			});
		}
		options.basis = basisRaw as HeatingBasis;
	}

	const region = url.searchParams.get('region');
	const yearRaw = url.searchParams.get('year');
	if ((region === null) !== (yearRaw === null)) {
		return badRequest({
			kind: 'invalid_parameter',
			message: 'region and year must be supplied together (e.g. &region=UK&year=2025).'
		});
	}
	if (region !== null && yearRaw !== null) {
		const year = Number.parseInt(yearRaw, 10);
		if (!Number.isInteger(year) || year <= 0 || String(year) !== yearRaw.trim()) {
			return badRequest({
				kind: 'invalid_parameter',
				message: `Invalid year "${yearRaw}" — use a positive integer year, e.g. 2025.`
			});
		}
		options.region = region;
		options.year = year;
	}

	const sigfigsRaw = url.searchParams.get('sigfigs');
	if (sigfigsRaw !== null) {
		const sigfigs = Number.parseInt(sigfigsRaw, 10);
		if (!Number.isInteger(sigfigs) || sigfigs < 1 || sigfigs > 12) {
			return badRequest({
				kind: 'invalid_parameter',
				message: `Invalid sigfigs "${sigfigsRaw}" — use an integer 1..12.`
			});
		}
		options.maxSigFigs = sigfigs;
	}

	const out = getConverter().convertText(q, options);
	if ('error' in out) {
		return badRequest(out.error);
	}
	return ok({ api_version: API_VERSION, exactness_note: EXACTNESS_NOTE, result: out });
}
