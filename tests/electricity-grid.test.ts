/**
 * Grid-electricity region/year emissions (rulebook §C.6, roadmap 0.2 item 1).
 *
 * With a region+year that matches a cited factor in the real catalog, the
 * engine multiplies the input energy through the factor and returns the GHG
 * MASS for the user's amount as `region_year_specific`, labeled with the
 * factor's own metric — the UK 2025 factor is CO2e, the EU-27 2023 factor is
 * CO2, and the two must never blur (§D.6). Any other combination stays
 * `context_required`; no default grid, no interpolation, no invented factor.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import type { ConversionResult, EngineOptions } from '$lib/conversion/types';

const converter = getConverter();

function emissionsFor(text: string, options?: EngineOptions): ConversionResult | undefined {
	const out = converter.convertText(text, options);
	if ('error' in out) throw new Error(`parse failed: ${JSON.stringify(out.error)}`);
	return out.groups.flatMap((g) => g.results).find((r) => r.category === 'emissions');
}

describe('electricity + matching region/year → region_year_specific mass', () => {
	it('5 kWh electricity, UK 2025 → 0.885 kg CO2e (5 × 177 g/kWh)', () => {
		const r = emissionsFor('5 kWh electricity', { region: 'UK', year: 2025 });
		expect(r?.exactness).toBe('region_year_specific');
		expect(r?.raw).toBe('0.885');
		expect(r?.value).toBe('~0.885');
		expect(r?.unit_id).toBe('kilogram_co2e');
		expect(r?.unit_label).toBe('kg CO2e');
		expect(r?.source_refs).toEqual(['uk-desnz-ghg-2025']);
	});

	it('1 MWh electricity, UK 2025 → 177 kg CO2e (1000 kWh × 177 g/kWh)', () => {
		const r = emissionsFor('1 MWh electricity', { region: 'UK', year: 2025 });
		expect(r?.raw).toBe('177');
		expect(r?.value).toBe('~177');
		expect(r?.unit_label).toBe('kg CO2e');
	});

	it('1 kWh electricity, EU-27 2023 → 0.242 kg CO2 — CO2 metric, NOT relabeled CO2e', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'EU-27', year: 2023 });
		expect(r?.exactness).toBe('region_year_specific');
		expect(r?.raw).toBe('0.242');
		expect(r?.unit_id).toBe('kilogram_co2');
		expect(r?.unit_label).toBe('kg CO2');
		expect(r?.source_refs).toEqual(['eea-electricity-intensity']);
	});

	it('the grid-intensity assumption + factor uncertainty are attached to the result', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'UK', year: 2025 });
		const assumption = r?.assumptions.find((a) => a.kind === 'grid_intensity');
		expect(assumption?.text).toContain('UK 2025');
		expect(assumption?.text).toContain('177');
		expect(assumption?.source_refs).toEqual(['uk-desnz-ghg-2025']);
		// DESNZ publishes the factor as generation-only — that caveat must surface.
		expect(r?.warnings.some((w) => w.kind === 'factor_uncertainty')).toBe(true);
	});

	it('the formula names metric, scope and region/year of the factor applied', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'UK', year: 2025 });
		expect(r?.formula).toContain('177 g_co2e_per_kwh');
		expect(r?.formula).toContain('UK 2025');
	});
});

describe('electricity without a matching factor stays context_required', () => {
	it('no region/year → context_required with both illustrative examples', () => {
		const r = emissionsFor('1 kWh electricity');
		expect(r?.exactness).toBe('context_required');
		expect(r?.missing).toEqual(expect.arrayContaining(['region', 'year']));
		expect(r?.illustrative_examples?.length).toBe(2);
	});

	it('a region/year combination NOT in the catalog (DE 2024) → context_required, nothing invented', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'DE', year: 2024 });
		expect(r?.exactness).toBe('context_required');
		expect(r?.value).toBeNull();
		expect(r?.explanation).toContain('DE 2024');
		expect(r?.illustrative_examples?.length).toBe(2);
	});

	it('a matching region with the WRONG year (UK 2023) → context_required', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'UK', year: 2023 });
		expect(r?.exactness).toBe('context_required');
		expect(r?.value).toBeNull();
	});

	it('region without year → context_required (both are required)', () => {
		const r = emissionsFor('1 kWh electricity', { region: 'UK' });
		expect(r?.exactness).toBe('context_required');
		expect(r?.value).toBeNull();
	});
});
