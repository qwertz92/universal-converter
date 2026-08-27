/**
 * The public API surface for the v0.3 grammar: a target and a duration written
 * into `q` must reach API consumers, not just the website.
 */

import { describe, expect, it } from 'vitest';
import { handleConvertRequest } from '$lib/api/convert-endpoint';

/**
 * Narrows to the 200 body rather than asserting it: every case below expects a
 * success, so an unexpected error response should name itself here.
 */
function body(query: string) {
	const res = handleConvertRequest(new URL(`https://example.org/api/convert${query}`));
	if (!('result' in res.body)) {
		throw new Error(`expected a success body for "${query}", got ${JSON.stringify(res.body)}`);
	}
	return { status: res.status, body: res.body };
}

describe('GET /api/convert with a target', () => {
	it('echoes the target and flags the requested row', () => {
		const { status, body: b } = body('?q=5+kWh+to+MJ');
		expect(status).toBe(200);
		expect(b.result.target).toEqual({
			unit_id: 'megajoule',
			unit_label: 'MJ',
			dimension: 'energy',
			resolved: true
		});
		const flagged = b.result.groups.flatMap((g) => g.results).filter((r) => r.is_target);
		expect(flagged).toHaveLength(1);
		expect(flagged[0].raw).toBe('18');
	});

	it('a target never filters the response — the other groups still ship', () => {
		const { body: b } = body('?q=5+kWh+to+MJ');
		const keys = b.result.groups.map((g) => g.key);
		expect(keys).toEqual(
			expect.arrayContaining(['energy', 'fuel_equivalents', 'industrial_units'])
		);
	});

	it('an unreachable target is reported, not omitted', () => {
		const { status, body: b } = body('?q=1+kg+to+kWh');
		expect(status).toBe(200);
		expect(b.result.target?.resolved).toBe(false);
		const row = b.result.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.exactness).toBe('context_required');
		expect(row?.missing).toContain('fuel');
	});

	it('a duration in the query reaches the engine', () => {
		const { body: b } = body('?q=5+kW+for+3+h');
		const energy = b.result.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.value !== null);
		expect(energy?.raw).toBe('15');
	});

	it('the whole payload still round-trips through JSON unchanged', () => {
		const { body: b } = body('?q=10+L+diesel+to+kg');
		expect(JSON.parse(JSON.stringify(b))).toEqual(b);
	});
});
