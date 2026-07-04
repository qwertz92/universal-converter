import { describe, expect, it } from 'vitest';
import { validateAll } from '$lib/data/validate-data';
import { loadDataBundle, loadExamples } from '$lib/data/load-data';

/**
 * This file doubles as the `npm run validate:data` entry point: running
 * `vitest --run tests/data-validation.test.ts` fails loudly on any data error.
 * `validateAll()` is also exported for use by other tools.
 */

describe('data validation (spec §13.5, AGENTS.md no-invented-numbers)', () => {
	it('all shipped data files pass schema + referential integrity', () => {
		const report = validateAll();
		if (!report.ok) {
			// Surface every issue in the failure message for fast diagnosis.
			throw new Error(
				`data validation failed:\n${report.issues
					.map((i) => `  [${i.file}] ${i.path}: ${i.message}`)
					.join('\n')}`
			);
		}
		expect(report.ok).toBe(true);
	});

	it('the data bundle loads and parses', () => {
		const bundle = loadDataBundle();
		expect(bundle.units.length).toBeGreaterThan(0);
		// Seed files start empty (Data agent fills them).
		expect(Array.isArray(bundle.fuels)).toBe(true);
		expect(Array.isArray(bundle.emissionFactors)).toBe(true);
		expect(bundle.sources.length).toBeGreaterThan(0);
	});

	it('examples file loads', () => {
		expect(Array.isArray(loadExamples())).toBe(true);
	});

	it('every unit that is not a pure SI identity carries a source_ref', () => {
		const { units } = loadDataBundle();
		// standard_definition units stand for a convention and must cite it too.
		const needsSource = units.filter((u) => u.exactness !== 'exact');
		expect(needsSource.length).toBeGreaterThan(0);
		for (const u of needsSource) {
			expect(u.source_refs.length, `unit ${u.id}`).toBeGreaterThan(0);
		}
	});

	it('every unit source_ref resolves to a source id', () => {
		const { units, sources } = loadDataBundle();
		const ids = new Set(sources.map((s) => s.id));
		for (const u of units) {
			for (const ref of u.source_refs) {
				expect(ids.has(ref), `unit ${u.id} ref ${ref}`).toBe(true);
			}
		}
	});

	it('unit ids are unique', () => {
		const { units } = loadDataBundle();
		const ids = units.map((u) => u.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
