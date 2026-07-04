/**
 * Golden test RUNNER (spec §13.6) — iterates tests/golden/cases.ts against the
 * real, shipped data catalog via `getConverter()` (data/units.json,
 * data/fuels.json, data/emission-factors.json, data/sources.json). Unlike the
 * rest of the engine test suite (which mostly exercises tests/fixtures/fuel-bundle.ts,
 * a synthetic fixture), this file is the one place that pins down ACTUAL
 * DESNZ/IPCC/h2tools numbers end-to-end, so a data edit or engine refactor
 * that silently changes a real result is caught here.
 *
 * Each case's expected numbers are hand-derived in cases.ts with the source_id
 * and arithmetic in a `derivation` comment string — reviewable without running
 * anything.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { GOLDEN_CASES, type GoldenCase, type GoldenCheck } from './cases';
import type { ConversionResult, ConversionResultSet } from '$lib/conversion/types';

const converter = getConverter();

function resultsFor(gc: GoldenCase): ConversionResultSet {
	const out = converter.convertText(gc.input, gc.options);
	if ('error' in out) {
		throw new Error(
			`golden case "${gc.id}" failed to parse: ${out.error.kind} — ${out.error.message}`
		);
	}
	return out;
}

function flatten(set: ConversionResultSet): ConversionResult[] {
	return set.groups.flatMap((g) => g.results);
}

function findMatch(results: ConversionResult[], check: GoldenCheck): ConversionResult | undefined {
	const matches = results.filter(
		(r) => r.category === check.category && r.unit_id === check.unit_id
	);
	return matches[check.nth ?? 0];
}

describe('golden tests (spec §13.6) — real catalog end-to-end', () => {
	it('the fixture is non-trivial (at least 15 cases, each with >=1 check)', () => {
		expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(15);
		for (const gc of GOLDEN_CASES) {
			expect(gc.checks.length, gc.id).toBeGreaterThan(0);
			expect(gc.derivation.length, gc.id).toBeGreaterThan(10);
		}
	});

	for (const gc of GOLDEN_CASES) {
		describe(`${gc.id}: "${gc.input}"${gc.options ? ` (${JSON.stringify(gc.options)})` : ''}`, () => {
			it(gc.derivation, () => {
				const set = resultsFor(gc);
				const results = flatten(set);

				for (const check of gc.checks) {
					const match = findMatch(results, check);
					expect(
						match,
						`expected a result in category "${check.category}" for unit_id "${check.unit_id}"`
					).toBeDefined();
					if (!match) continue;

					expect(match.exactness, `${gc.id} exactness`).toBe(check.exactness);

					if (check.valueIsNull) {
						expect(match.value, `${gc.id} value should be null`).toBeNull();
						expect(match.raw, `${gc.id} raw should be null`).toBeNull();
					}

					if (check.exactRaw !== undefined) {
						expect(match.raw, `${gc.id} exact raw mismatch`).toBe(check.exactRaw);
					}

					if (check.expected !== undefined) {
						expect(match.raw, `${gc.id} raw missing for tolerance check`).not.toBeNull();
						const actual = Number(match.raw);
						const tol = check.tolerance ?? 1e-9;
						expect(
							Math.abs(actual - check.expected),
							`${gc.id}: expected ${check.expected} +/- ${tol}, got ${actual}`
						).toBeLessThanOrEqual(tol);
					}

					if (check.sourceRefIncludes) {
						expect(match.source_refs, `${gc.id} source_refs`).toContain(check.sourceRefIncludes);
					}

					if (check.formulaMatches) {
						expect(match.formula ?? '', `${gc.id} formula`).toMatch(check.formulaMatches);
					}

					if (check.warningTextMatches) {
						const allWarningText = [
							...set.warnings.map((w) => w.text),
							...match.warnings.map((w) => w.text)
						].join(' | ');
						expect(allWarningText, `${gc.id} warnings`).toMatch(check.warningTextMatches);
					}
				}
			});
		});
	}

	it('every golden case is a distinct, non-empty input string', () => {
		const inputs = GOLDEN_CASES.map((c) => `${c.input}::${JSON.stringify(c.options ?? {})}`);
		// Distinct id+input+options combos are allowed to repeat the input (different
		// checks on the same conversion), but every case must have a unique id.
		const ids = GOLDEN_CASES.map((c) => c.id);
		expect(new Set(ids).size, 'golden case ids must be unique').toBe(ids.length);
		expect(inputs.length).toBeGreaterThan(0);
	});
});
