/**
 * §13.3 FUELS — against the REAL, sourced data catalog (data/fuels.json),
 * via getConverter(). Every expected numeric value below is quoted directly
 * from data/fuels.json with its source_id in a comment, so a change to the
 * catalog that silently drifts a number is caught here (as opposed to
 * tests/fuel-pipeline.test.ts, which exercises pipeline BEHAVIOUR against a
 * synthetic fixture with easy round numbers).
 *
 * Covers: diesel L->kg via density; diesel L->kWh via LHV and HHV; gasoline
 * L->energy; natural gas m3->kWh (both bases); hydrogen kg->kWh LHV and HHV;
 * barrel crude oil -> graceful "not available" degradation; every fuel in the
 * catalog produces basis-labeled results with >=1 source_ref for each
 * available heating value.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { loadDataBundle } from '$lib/data/load-data';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();
const { fuels } = loadDataBundle();

function energyResults(input: string, options?: { basis?: 'lhv' | 'hhv' }): ConversionResult[] {
	const out = converter.convertText(input, options);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out.groups.filter((g) => g.key === 'energy').flatMap((g) => g.results);
}

function allResults(input: string, options?: { basis?: 'lhv' | 'hhv' }): ConversionResult[] {
	const out = converter.convertText(input, options);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results);
}

describe('§13.3 diesel L -> kg via density (uk-desnz-ghg-2025)', () => {
	it('1 L diesel -> 0.832361 kg (density 832.361 kg/m3 = 0.832361 kg/L)', () => {
		const mass = allResults('1 liter diesel').find(
			(r) => r.category === 'mass' && r.unit_id === 'kilogram'
		);
		expect(Number(mass?.raw)).toBeCloseTo(0.832361, 6);
		expect(mass?.exactness).toBe('source_based');
		expect(mass?.source_refs).toContain('uk-desnz-ghg-2025');
	});
});

describe('§13.3 diesel L -> kWh via LHV, HHV shown alongside (uk-desnz-ghg-2025)', () => {
	it('1 L diesel -> 9.905 kWh (LHV/NCV, default basis)', () => {
		const kwh = energyResults('1 liter diesel').find((r) => r.unit_id === 'kilowatt_hour');
		expect(Number(kwh?.raw)).toBeCloseTo(9.905, 3);
		expect(kwh?.exactness).toBe('source_based');
	});

	it('1 L diesel -> 10.531 kWh HHV/GCV shown as a labeled secondary figure', () => {
		const kwhRows = energyResults('1 liter diesel').filter((r) => r.unit_id === 'kilowatt_hour');
		expect(kwhRows).toHaveLength(2);
		const hhv = kwhRows[1];
		expect(Number(hhv.raw)).toBeCloseTo(10.531, 3);
		expect(hhv.warnings.some((w) => /HHV\/GCV/.test(w.text))).toBe(true);
	});
});

describe('§13.3 gasoline L -> energy (uk-desnz-ghg-2025, "Petrol average biofuel blend")', () => {
	it('1 L gasoline -> 8.926 kWh LHV', () => {
		const kwh = energyResults('1 L gasoline').find((r) => r.unit_id === 'kilowatt_hour');
		expect(Number(kwh?.raw)).toBeCloseTo(8.926, 3);
	});

	it('1 L gasoline -> mass 0.746204 kg via density', () => {
		const mass = allResults('1 L gasoline').find(
			(r) => r.category === 'mass' && r.unit_id === 'kilogram'
		);
		expect(Number(mass?.raw)).toBeCloseTo(0.746204, 6);
	});
});

describe('§13.3 natural gas m3 -> kWh, both bases (uk-desnz-ghg-2025, DERIVED volumetric CV)', () => {
	it('1 m3 natural gas -> 10.191 kWh LHV (never exact — source_based)', () => {
		const kwh = energyResults('1 m3 natural gas').find((r) => r.unit_id === 'kilowatt_hour');
		expect(Number(kwh?.raw)).toBeCloseTo(10.191, 2);
		expect(kwh?.exactness).toBe('source_based');
	});

	it('1 m3 natural gas -> 11.290 kWh HHV shown alongside', () => {
		const kwhRows = energyResults('1 m3 natural gas').filter((r) => r.unit_id === 'kilowatt_hour');
		expect(Number(kwhRows[1]?.raw)).toBeCloseTo(11.29, 2);
	});
});

describe('§13.3 hydrogen kg -> kWh, LHV and HHV (h2tools / nist-webbook — read from data, not hardcoded assumptions)', () => {
	const h2 = fuels.find((f) => f.id === 'hydrogen')!;
	const lhvEntry = h2.heating_values!.find((hv) => hv.basis === 'lhv' && hv.unit === 'mj_per_kg')!;
	const hhvEntry = h2.heating_values!.find((hv) => hv.basis === 'hhv' && hv.unit === 'mj_per_kg')!;

	it('the catalog actually has both an LHV and an HHV per-kg entry for hydrogen', () => {
		expect(lhvEntry).toBeDefined();
		expect(hhvEntry).toBeDefined();
	});

	it('1 kg hydrogen -> LHV kWh matches data/fuels.json LHV MJ/kg / 3.6', () => {
		const kwh = energyResults('1 kg hydrogen').find((r) => r.unit_id === 'kilowatt_hour');
		const expectedKwh = Number(lhvEntry.value) / 3.6;
		expect(Number(kwh?.raw)).toBeCloseTo(expectedKwh, 3);
	});

	it('1 kg hydrogen (basis=hhv) -> HHV kWh matches data/fuels.json HHV MJ/kg / 3.6', () => {
		const kwhRows = energyResults('1 kg hydrogen', { basis: 'hhv' }).filter(
			(r) => r.unit_id === 'kilowatt_hour'
		);
		const expectedKwh = Number(hhvEntry.value) / 3.6;
		expect(Number(kwhRows[0]?.raw)).toBeCloseTo(expectedKwh, 3);
	});

	it('LHV and HHV for hydrogen genuinely diverge by ~18% (rulebook D.2)', () => {
		const lhv = Number(lhvEntry.value);
		const hhv = Number(hhvEntry.value);
		const pctDiff = (hhv - lhv) / lhv;
		expect(pctDiff).toBeGreaterThan(0.15);
		expect(pctDiff).toBeLessThan(0.22);
	});
});

describe('§13.3 barrel crude oil -> energy degrades gracefully per catalog (no invented density/energy)', () => {
	it('crude oil has NO density in data/fuels.json (deliberately omitted, per data-model.md gap table)', () => {
		const crude = fuels.find((f) => f.id === 'crude-oil')!;
		expect(crude.density).toBeUndefined();
	});

	it('"1 barrel crude oil" -> mass is context_required, NOT a guessed number', () => {
		const mass = allResults('1 barrel crude oil').find((r) => r.category === 'mass');
		expect(mass?.exactness).toBe('context_required');
		expect(mass?.value).toBeNull();
	});

	it('"1 barrel crude oil" -> volume is still exact (pure unit conversion, no fuel needed)', () => {
		const vol = allResults('1 barrel crude oil').find(
			(r) => r.category === 'volume' && r.unit_id === 'liter'
		);
		expect(vol?.exactness).toBe('exact');
		expect(vol?.raw).toBe('158.987294928');
	});

	it('"1 barrel crude oil" carries a warning distinguishing it from the boe convention (rulebook D.4/D.5)', () => {
		const out = converter.convertText('1 barrel crude oil');
		if ('error' in out) throw new Error('parse failed');
		expect(out.warnings.some((w) => /boe/i.test(w.text))).toBe(true);
	});
});

describe('§13.3 every fuel in the catalog: available heating values produce basis-labeled, sourced results', () => {
	// Use a representative amount unit per fuel (mass-based if the fuel has no
	// density; otherwise volume, matching how the fuel is naturally metered).
	// Query by the fuel's NAME, not by its id spelled out. `heating-oil` keeps
	// that id so its indexed URL stays valid, but the entry is DESNZ "Fuel Oil"
	// and "heating oil" is deliberately an ambiguity prompt now (it covers three
	// grades that differ by up to 15% per litre).
	function representativeInput(name: string, hasDensity: boolean): string {
		const unit = hasDensity ? 'L' : 'kg';
		return `1 ${unit} ${name}`;
	}

	it.each(
		fuels.map((f) => [f.names[0], Boolean(f.density), (f.heating_values ?? []).length] as const)
	)(
		'%s produces >=1 basis-labeled energy result with a source_ref, or an honest "not available"',
		(fuelId, hasDensity, hvCount) => {
			const input = representativeInput(fuelId, hasDensity);
			const results = energyResults(input);
			if (hvCount === 0) {
				// e.g. none in v0.1, but guard the invariant for future data edits.
				const notAvailable = results.find((r) => r.value === null);
				expect(notAvailable, `${fuelId} with no heating values`).toBeDefined();
				return;
			}
			const withValue = results.filter((r) => r.value !== null);
			expect(withValue.length, `${fuelId} energy results`).toBeGreaterThan(0);
			for (const r of withValue) {
				// Rank-variable fuels whose OWN source records a wide spread
				// (>25% high/low: lignite, anthracite) are honestly `estimated`;
				// single tabulated values stay `source_based` (engine heuristic).
				expect(['source_based', 'estimated'], `${fuelId} exactness (${r.exactness})`).toContain(
					r.exactness
				);
				expect(r.source_refs.length, `${fuelId} source_refs`).toBeGreaterThan(0);
			}
			// At least one assumption on every energy result states the HV basis.
			const hasBasisAssumption = withValue.some((r) =>
				r.assumptions.some((a) => a.kind === 'heating_value_basis')
			);
			expect(hasBasisAssumption, `${fuelId} basis assumption`).toBe(true);
		}
	);
});

describe('§13.3 fuels with only one heating-value basis show the other as "not available", never derived', () => {
	it('lignite (IPCC) has NCV only — HHV is genuinely absent from the catalog, not derived', () => {
		const lignite = fuels.find((f) => f.id === 'lignite')!;
		const bases = new Set((lignite.heating_values ?? []).map((hv) => hv.basis));
		expect(bases.has('lhv')).toBe(true);
		expect(bases.has('hhv')).toBe(false);
	});

	it('anthracite (IPCC) has NCV only', () => {
		const anthracite = fuels.find((f) => f.id === 'anthracite')!;
		const bases = new Set((anthracite.heating_values ?? []).map((hv) => hv.basis));
		expect(bases.has('lhv')).toBe(true);
		expect(bases.has('hhv')).toBe(false);
	});

	it('requesting HHV for lignite yields only the LHV energy result (no derived HHV row)', () => {
		const results = energyResults('1 kg lignite', { basis: 'hhv' }).filter((r) => r.value !== null);
		// Every populated row must come from the LHV data (basis label says so);
		// there is no silently-derived HHV row (rulebook §C.1 rule 4).
		for (const r of results) {
			const basisAssumption = r.assumptions.find((a) => a.kind === 'heating_value_basis');
			expect(basisAssumption?.text ?? '').toMatch(/LHV\/NCV/);
		}
	});
});

describe('§13.3 coal fuels (hard coal, lignite, anthracite) have no density -> no volume conversion', () => {
	it.each(['hard-coal', 'lignite', 'anthracite'])('%s has no density field', (fuelId) => {
		const fuel = fuels.find((f) => f.id === fuelId)!;
		expect(fuel.density).toBeUndefined();
	});

	it('"1 kg hard coal" produces no volume result group (coal sold by mass, not volume)', () => {
		const out = converter.convertText('1 kg hard coal');
		if ('error' in out) throw new Error('parse failed');
		expect(out.groups.some((g) => g.key === 'volume')).toBe(false);
	});
});
