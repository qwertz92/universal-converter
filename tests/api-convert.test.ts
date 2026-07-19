/**
 * /api/convert endpoint handler (roadmap 0.2: public API draft). Tests the
 * framework-independent handler directly — the SvelteKit +server.ts wrapper
 * only stringifies the returned body into a Response.
 */

import { describe, expect, it } from 'vitest';
import { handleConvertRequest, API_VERSION } from '$lib/api/convert-endpoint';
import type { ConversionResultSet } from '$lib/conversion/types';

function req(query: string) {
	return handleConvertRequest(new URL(`https://example.org/api/convert${query}`));
}

describe('GET /api/convert — success shape', () => {
	it('?q=1 kWh → 200 with a JSON-round-trippable ConversionResultSet', () => {
		const res = req('?q=1+kWh');
		expect(res.status).toBe(200);
		const body = res.body as { api_version: string; result: ConversionResultSet };
		expect(body.api_version).toBe(API_VERSION);
		const energy = body.result.groups.find((g) => g.key === 'energy');
		const mj = energy?.results.find((r) => r.unit_id === 'megajoule');
		expect(mj?.raw).toBe('3.6');
		expect(mj?.exactness).toBe('exact');
		// The whole payload must survive JSON serialization unchanged (no
		// Decimals, functions, or class instances anywhere in the tree).
		expect(JSON.parse(JSON.stringify(body))).toEqual(body);
	});

	it('?q=1 L diesel → sourced fuel pipeline results with source_refs', () => {
		const res = req('?q=1+L+diesel');
		expect(res.status).toBe(200);
		const body = res.body as { result: ConversionResultSet };
		const mass = body.result.groups.find((g) => g.key === 'mass');
		expect(mass?.results.some((r) => r.exactness === 'source_based')).toBe(true);
		expect(body.result.source_refs.length).toBeGreaterThan(0);
	});

	it('electricity + region/year flows through to a region_year_specific mass', () => {
		const res = req('?q=1+kWh+electricity&region=UK&year=2025');
		expect(res.status).toBe(200);
		const body = res.body as { result: ConversionResultSet };
		const emissions = body.result.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('region_year_specific');
		expect(emissions?.raw).toBe('0.177');
	});

	it('?basis=hhv is honoured (diesel energy differs from LHV default)', () => {
		const lhv = req('?q=1+L+diesel') as { body: { result: ConversionResultSet } };
		const hhv = req('?q=1+L+diesel&basis=hhv') as { body: { result: ConversionResultSet } };
		const first = (r: { result: ConversionResultSet }) =>
			r.result.groups.find((g) => g.key === 'energy')?.results[0]?.raw;
		expect(first(lhv.body as never)).not.toBe(first(hhv.body as never));
	});

	it('200 responses carry CORS, cache and version headers', () => {
		const res = req('?q=1+kWh');
		expect(res.headers['access-control-allow-origin']).toBe('*');
		expect(res.headers['cache-control']).toContain('public');
		expect(res.headers['x-api-version']).toBe(API_VERSION);
	});
});

describe('GET /api/convert — error handling', () => {
	it('missing q → 400 missing_query with usage help, no-store', () => {
		const res = req('');
		expect(res.status).toBe(400);
		const body = res.body as { error: { kind: string; message: string } };
		expect(body.error.kind).toBe('missing_query');
		expect(body.error.message).toContain('/api/convert?q=');
		expect(res.headers['cache-control']).toBe('no-store');
	});

	it('unknown unit → 400 with the parser error passed through', () => {
		const res = req('?q=1+flurbs');
		expect(res.status).toBe(400);
		const body = res.body as { error: { kind: string } };
		expect(body.error.kind).toBe('unknown_unit');
	});

	it('invalid basis → 400', () => {
		expect(req('?q=1+kWh&basis=net').status).toBe(400);
	});

	it('region without year (and vice versa) → 400', () => {
		expect(req('?q=1+kWh+electricity&region=UK').status).toBe(400);
		expect(req('?q=1+kWh+electricity&year=2025').status).toBe(400);
	});

	it('non-integer year or out-of-range sigfigs → 400', () => {
		expect(req('?q=1+kWh+electricity&region=UK&year=soon').status).toBe(400);
		expect(req('?q=1+kWh&sigfigs=0').status).toBe(400);
		expect(req('?q=1+kWh&sigfigs=13').status).toBe(400);
	});

	it('an unmatched region/year is NOT an HTTP error — it is a context_required result', () => {
		const res = req('?q=1+kWh+electricity&region=Atlantis&year=2020');
		expect(res.status).toBe(200);
		const body = res.body as { result: ConversionResultSet };
		const emissions = body.result.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('context_required');
	});
});
