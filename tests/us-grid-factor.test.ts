/**
 * The US grid factor (EPA eGRID2023).
 *
 * Open since v0.1: `docs/research-notes.md` carried "~370 gCO2/kWh" as a
 * provisional, explicitly UNVERIFIED figure, and the no-invented-numbers rule
 * kept it out of the catalog for four releases. Reading the primary source —
 * eGRID Summary Tables 2023, Table 1, the bottom "U.S." row — showed the
 * provisional number was 22 g/kWh (6.3%) too high. That is what the rule is for.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { loadDataBundle } from '$lib/data/load-data';
import { gridIntensityOptions } from '$lib/ui/engine';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();
const { emissionFactors, sources, fuels } = loadDataBundle();

function emissions(input: string, region: string, year: number): ConversionResult[] {
	const out = converter.convertText(input, { region, year });
	if ('error' in out) throw new Error(`"${input}" failed: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results).filter((r) => r.category === 'emissions');
}

describe('the shipped figures are the published ones, converted exactly', () => {
	it.each([
		['electricity-us-2023-co2', '767.2', '347.996066264'],
		['electricity-us-2023-co2e', '770.9', '349.674358033']
	])('%s is the lb/MWh cell times the exact pound', (id, lbPerMwh, gPerKwh) => {
		const factor = emissionFactors.find((f) => f.id === id);
		expect(factor, id).toBeDefined();
		// 1 lb = 0.45359237 kg exactly (NIST); 1 MWh = 1000 kWh, so kg/MWh IS g/kWh.
		expect(Number(factor!.value)).toBeCloseTo(Number(lbPerMwh) * 0.45359237, 9);
		expect(factor!.value).toBe(gPerKwh);
		expect(factor!.region).toBe('US');
		expect(factor!.year).toBe(2023);
		expect(factor!.source_id).toBe('epa-egrid-2023');
	});

	it('is nowhere near the provisional figure it replaced', () => {
		const co2 = emissionFactors.find((f) => f.id === 'electricity-us-2023-co2')!;
		expect(Number(co2.value)).toBeLessThan(360);
		expect(Number(co2.value)).toBeGreaterThan(340);
	});

	it('cites a source that resolves and points at the primary document', () => {
		const src = sources.find((s) => s.id === 'epa-egrid-2023');
		expect(src).toBeDefined();
		expect(src!.url).toContain('epa.gov');
		expect(src!.url).toContain('summary_tables');
	});
});

describe('CO2 and CO2e both ship, neither derived from the other', () => {
	it('both are published for this row, so both are carried', () => {
		const co2 = emissionFactors.find((f) => f.id === 'electricity-us-2023-co2')!;
		const co2e = emissionFactors.find((f) => f.id === 'electricity-us-2023-co2e')!;
		expect(co2.pollutant).toBe('CO2');
		expect(co2e.pollutant).toBe('CO2e');
		expect(Number(co2.value)).toBeLessThan(Number(co2e.value));
	});
});

describe('a US query is answered', () => {
	it('1 MWh electricity, US 2023 → the eGRID CO2e mass', () => {
		const co2e = emissions('1 MWh electricity', 'US', 2023).find(
			(r) => r.unit_id === 'kilogram_co2e'
		);
		// 349.674358033 g/kWh x 1000 kWh = 349674.358033 g = 349.674358033 kg.
		expect(Number(co2e?.raw)).toBeCloseTo(349.674358033, 6);
		expect(co2e?.exactness).toBe('region_year_specific');
		expect(co2e?.source_refs).toContain('epa-egrid-2023');
	});

	it('a year eGRID does not cover still refuses rather than interpolating', () => {
		const rows = emissions('1 MWh electricity', 'US', 2019);
		expect(rows.every((r) => r.exactness !== 'region_year_specific')).toBe(true);
	});

	it('appears in the grid picker without any UI change', () => {
		const us = gridIntensityOptions().filter((o) => o.region === 'US');
		expect(us.length).toBeGreaterThan(0);
		expect(us.every((o) => o.year === 2023)).toBe(true);
	});

	it('electricity cites both new factors', () => {
		const ids = fuels.find((f) => f.id === 'electricity')!.emission_factor_ids ?? [];
		expect(ids).toContain('electricity-us-2023-co2');
		expect(ids).toContain('electricity-us-2023-co2e');
	});
});

describe('the annual average is not passed off as a marginal rate', () => {
	it('says the non-baseload rate is a different, higher number', () => {
		const co2 = emissionFactors.find((f) => f.id === 'electricity-us-2023-co2')!;
		expect(co2.uncertainty).toMatch(/non-baseload/i);
		expect(co2.uncertainty).toMatch(/1,372\.5/);
	});
});
