/**
 * FIXED (was a documented DATA CATALOG GAP, spec §13.6): `data/fuels.json` now
 * has an "electricity" fuel entry, so `1 kWh electricity` resolves to an
 * emissions `context_required` result (region/year picker) per spec §13.4/§9.6
 * and rulebook §C.6, instead of `unknown_fuel`.
 *
 * `data/emission-factors.json` ships two ILLUSTRATIVE region+year electricity
 * factors (electricity-uk-2025-co2e, electricity-eu27-2023-co2). They are now
 * wired to the electricity fuel via `emission_factor_ids`, so:
 *  - with NO region/year supplied, the engine's electricity code path
 *    (isElectricity/electricityContextRequired in src/lib/conversion/engine.ts)
 *    surfaces them as `illustrative_examples` on the context_required result
 *    (rulebook §C.6: "if the Data agent has provided illustrative factors,
 *    shows one or more clearly-labeled example outputs");
 *  - WITH a matching region+year, the engine returns the real
 *    `region_year_specific` value for that factor instead.
 *
 * This mirrors (and is now consistent with) the synthetic-fixture coverage in
 * tests/guards.test.ts and tests/emissions.test.ts (fixtures/fuel-bundle.ts's
 * TEST_ELECTRICITY fuel) — the gap between the synthetic fixture and the real
 * shipped catalog described in the original version of this file is closed.
 */

import { describe, expect, it } from 'vitest';
import { getConverter, loadDataBundle } from '$lib/index';
import type { ConversionResult } from '$lib/conversion/types';

describe('electricity fuel wired into the shipped catalog (spec §13.4, §9.6, rulebook §C.6)', () => {
	it('data/fuels.json has exactly one electricity-category fuel', () => {
		const { fuels } = loadDataBundle();
		const electricityFuels = fuels.filter((f) => f.category === 'electricity');
		expect(electricityFuels).toHaveLength(1);
		expect(electricityFuels[0].id).toBe('electricity');
	});

	it('"1 kWh electricity" parses against the real catalog and yields energy + context_required emissions', () => {
		const out = getConverter().convertText('1 kWh electricity');
		expect('error' in out, `expected a successful parse, got: ${JSON.stringify(out)}`).toBe(false);
		if ('error' in out) return;

		const allResults: ConversionResult[] = out.groups.flatMap((g) => g.results);

		// Energy group still works (pure SI energy conversions).
		const energy = allResults.find((r) => r.category === 'energy' && r.unit_id === 'megajoule');
		expect(energy?.value).toBeTruthy();
		expect(energy?.exactness).toBe('exact');

		// Emissions group is context_required, not unknown_fuel / not_available.
		const emissions = allResults.find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('context_required');
		expect(emissions?.missing).toEqual(expect.arrayContaining(['region', 'year']));
		expect(emissions?.value).toBeNull();
	});

	it('the two illustrative electricity emission factors are referenced by the electricity fuel', () => {
		const { fuels, emissionFactors } = loadDataBundle();
		const electricityFactors = emissionFactors.filter(
			(f) => f.id === 'electricity-uk-2025-co2e' || f.id === 'electricity-eu27-2023-co2'
		);
		expect(electricityFactors).toHaveLength(2);
		const electricityFuel = fuels.find((f) => f.id === 'electricity');
		expect(electricityFuel).toBeDefined();
		for (const factor of electricityFactors) {
			expect(
				electricityFuel?.emission_factor_ids ?? [],
				`electricity fuel should reference ${factor.id}`
			).toContain(factor.id);
		}
	});

	it('"1 kWh electricity" surfaces both illustrative examples (UK 2025, EU-27 2023) when no region/year is given', () => {
		const out = getConverter().convertText('1 kWh electricity');
		if ('error' in out) throw new Error('parse failed');
		const emissions = out.groups.flatMap((g) => g.results).find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('context_required');
		const examples = emissions?.illustrative_examples ?? [];
		expect(examples.length).toBeGreaterThanOrEqual(2);

		const uk = examples.find((e) => e.region === 'UK' && e.year === 2025);
		expect(uk).toBeDefined();
		expect(uk?.value).toBe('177');
		expect(uk?.source_refs).toContain('uk-desnz-ghg-2025');

		const eu = examples.find((e) => e.region === 'EU-27' && e.year === 2023);
		expect(eu).toBeDefined();
		expect(eu?.value).toBe('242');
		expect(eu?.source_refs).toContain('eea-electricity-intensity');
	});

	it('"1 kWh electricity" with region+year=UK/2025 returns the real region_year_specific factor, not context_required', () => {
		const out = getConverter().convertText('1 kWh electricity', { region: 'UK', year: 2025 });
		if ('error' in out) throw new Error('parse failed');
		const emissions = out.groups.flatMap((g) => g.results).find((r) => r.category === 'emissions');
		expect(emissions?.exactness).toBe('region_year_specific');
		expect(emissions?.value).toBe('177');
		expect(emissions?.source_refs).toContain('uk-desnz-ghg-2025');
	});

	it('the illustrative factors are individually well-formed region_year_specific data (region+year+source present)', () => {
		// The raw data itself is sourced correctly — this was a wiring gap, not a
		// data-quality gap, and remains true now that the wiring is fixed.
		const { emissionFactors } = loadDataBundle();
		const uk = emissionFactors.find((f) => f.id === 'electricity-uk-2025-co2e');
		const eu = emissionFactors.find((f) => f.id === 'electricity-eu27-2023-co2');
		expect(uk?.region).toBe('UK');
		expect(uk?.year).toBe(2025);
		expect(uk?.source_id).toBe('uk-desnz-ghg-2025');
		expect(eu?.region).toBe('EU-27');
		expect(eu?.year).toBe(2023);
		expect(eu?.source_id).toBe('eea-electricity-intensity');
	});
});
