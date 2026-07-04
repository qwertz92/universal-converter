/**
 * Documents a genuine DATA CATALOG GAP found while building the golden tests
 * (spec §13.6): `data/fuels.json` has NO "electricity" fuel entry, even though
 * spec §13.4/§9.6 and rulebook §C.6 require `1 kWh electricity` to resolve to
 * an emissions `context_required` result (region/year picker), and
 * `data/emission-factors.json` ships two ILLUSTRATIVE region+year electricity
 * factors (electricity-uk-2025-co2e, electricity-eu27-2023-co2) that are
 * currently ORPHANED — no fuel references them via `emission_factor_ids`, and
 * neither factor sets `fuel_id`.
 *
 * This is a DATA gap, not a test bug: the engine's electricity code path
 * (isElectricity/electricityContextRequired in src/lib/conversion/engine.ts)
 * is implemented and correctly exercised by the synthetic fixture in
 * tests/guards.test.ts and tests/emissions.test.ts (fixtures/fuel-bundle.ts's
 * TEST_ELECTRICITY fuel). But a real end user typing "1 kWh electricity"
 * against the SHIPPED catalog gets `unknown_fuel`, not `context_required`.
 *
 * This test file pins down the current (gap) behaviour so:
 *  - the gap is visible in the test suite rather than silently assumed fixed;
 *  - the moment a Data-agent pass adds an `electricity` fuel to fuels.json
 *    (wiring up the two existing illustrative factors), this test's first
 *    assertion starts failing loudly and must be updated to the real fix
 *    (see the inline TODO), rather than the fix going unnoticed.
 *
 * Reported in the Test agent's final summary as a data/spec-conformance gap,
 * not fixed here (data/*.json is out of the Test agent's ownership).
 */

import { describe, expect, it } from 'vitest';
import { getConverter, loadDataBundle } from '$lib/index';

describe('data gap: no "electricity" fuel in the shipped catalog (spec §13.4, §9.6, rulebook §C.6)', () => {
	it('data/fuels.json has no electricity-category fuel (documents the gap)', () => {
		const { fuels } = loadDataBundle();
		const electricityFuels = fuels.filter((f) => f.category === 'electricity');
		// TODO(data agent): once an electricity fuel is added, this becomes >0 and
		// the two assertions below (parse failure / orphaned factors) should be
		// replaced with a real golden case asserting context_required behaviour
		// against real data (mirroring tests/guards.test.ts's fixture-based case).
		expect(electricityFuels).toHaveLength(0);
	});

	it('"1 kWh electricity" fails to parse against the real catalog (unknown_fuel, not context_required)', () => {
		const out = getConverter().convertText('1 kWh electricity');
		expect('error' in out, 'expected a parse error given the current data gap').toBe(true);
		if ('error' in out) {
			expect(out.error.kind).toBe('unknown_fuel');
		}
	});

	it('the two illustrative electricity emission factors exist but are orphaned (no fuel references them)', () => {
		const { fuels, emissionFactors } = loadDataBundle();
		const electricityFactors = emissionFactors.filter(
			(f) => f.id === 'electricity-uk-2025-co2e' || f.id === 'electricity-eu27-2023-co2'
		);
		expect(electricityFactors).toHaveLength(2);
		for (const factor of electricityFactors) {
			// Neither factor names a fuel_id...
			expect(
				factor.fuel_id,
				`${factor.id} should have no fuel_id in the current gap state`
			).toBeUndefined();
			// ...and no fuel's emission_factor_ids references it either.
			const referencingFuel = fuels.find((f) => (f.emission_factor_ids ?? []).includes(factor.id));
			expect(
				referencingFuel,
				`${factor.id} should be unreferenced by any fuel in the current gap state`
			).toBeUndefined();
		}
	});

	it('the illustrative factors are individually well-formed region_year_specific data (region+year+source present)', () => {
		// Even though unreachable via convertText today, the raw data itself is
		// sourced correctly — this is a wiring gap, not a data-quality gap.
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
