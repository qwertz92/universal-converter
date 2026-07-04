/**
 * §13.4 EMISSIONS — against the REAL, sourced emission-factors catalog
 * (data/emission-factors.json + data/fuels.json), via getConverter(). Numbers
 * quoted directly from the catalog with source_id in comments.
 *
 * Covers: diesel L->CO2 AND separately CO2e (different values, both sourced);
 * gasoline L->CO2; natural gas m3->CO2; hydrogen combustion CO2=0 with
 * "combustion only" labeling; wood pellets -> biogenic CO2 on a separate line,
 * NOT added to fossil CO2; ethanol/biodiesel biogenic separation; electricity
 * kWh->CO2e without region/year (documented as a data gap — see
 * tests/golden/data-gaps.test.ts); CO2 never derived from CO2e or vice versa
 * (assert no CO2e result exists for a fuel that only has a CO2 factor, and
 * vice versa).
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { loadDataBundle } from '$lib/data/load-data';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();
const { emissionFactors } = loadDataBundle();

function emissionResults(input: string): ConversionResult[] {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out.groups.filter((g) => g.key === 'emissions').flatMap((g) => g.results);
}

describe('§13.4 diesel L -> CO2 AND separately CO2e (uk-desnz-ghg-2025, different values)', () => {
	it('1 L diesel -> 2.53763 kg CO2 (direct-combustion CO2 component)', () => {
		const co2 = emissionResults('1 liter diesel').find((r) => r.unit_id === 'kilogram_co2');
		expect(Number(co2?.raw)).toBeCloseTo(2.53763, 4);
		expect(co2?.exactness).toBe('region_year_specific');
		expect(co2?.source_refs).toContain('uk-desnz-ghg-2025');
	});

	it('1 L diesel -> 2.57082 kg CO2e (total, including CH4+N2O) — genuinely different from CO2', () => {
		const co2e = emissionResults('1 liter diesel').find((r) => r.unit_id === 'kilogram_co2e');
		expect(Number(co2e?.raw)).toBeCloseTo(2.57082, 4);
		expect(Number(co2e?.raw)).not.toBeCloseTo(2.53763, 4);
	});

	it('CO2e - CO2 = CH4 + N2O component (0.00029 + 0.0329 = 0.03319 kg/L)', () => {
		const rows = emissionResults('1 liter diesel');
		const co2 = Number(rows.find((r) => r.unit_id === 'kilogram_co2')?.raw);
		const co2e = Number(rows.find((r) => r.unit_id === 'kilogram_co2e')?.raw);
		expect(co2e - co2).toBeCloseTo(0.03319, 4);
	});
});

describe('§13.4 gasoline L -> CO2 (uk-desnz-ghg-2025)', () => {
	it('1 L gasoline -> 2.05523 kg CO2', () => {
		const co2 = emissionResults('1 L gasoline').find((r) => r.unit_id === 'kilogram_co2');
		expect(Number(co2?.raw)).toBeCloseTo(2.05523, 4);
	});
});

describe('§13.4 natural gas m3 -> CO2 (uk-desnz-ghg-2025)', () => {
	it('1 m3 natural gas -> 2.0627 kg CO2', () => {
		const co2 = emissionResults('1 m3 natural gas').find((r) => r.unit_id === 'kilogram_co2');
		expect(Number(co2?.raw)).toBeCloseTo(2.0627, 3);
	});

	it('1 m3 natural gas -> 2.06672 kg CO2e (separately sourced, not derived from CO2)', () => {
		const co2e = emissionResults('1 m3 natural gas').find((r) => r.unit_id === 'kilogram_co2e');
		expect(Number(co2e?.raw)).toBeCloseTo(2.06672, 3);
	});
});

describe('§13.4 hydrogen combustion CO2 = exactly 0, "combustion only" labeling (h2 has no carbon)', () => {
	it('1 kg hydrogen -> 0 kg CO2 exactly (not a rounded near-zero)', () => {
		const co2 = emissionResults('1 kg hydrogen').find((r) => r.unit_id === 'kilogram_co2');
		expect(co2?.raw).toBe('0');
		expect(co2?.exactness).toBe('exact');
	});

	it('the hydrogen zero carries a combustion-only warning distinct from an upstream claim', () => {
		const out = converter.convertText('1 kg hydrogen');
		if ('error' in out) throw new Error('parse failed');
		const warning = out.warnings.find((w) => w.kind === 'hydrogen_combustion_only');
		expect(warning).toBeDefined();
		expect(warning?.text).toMatch(/combustion only|upstream/i);
	});

	it('hydrogen produces exactly one numeric emissions row (no invented upstream figure)', () => {
		const withValue = emissionResults('1 kg hydrogen').filter((r) => r.value !== null);
		expect(withValue).toHaveLength(1);
	});
});

describe('§13.4 wood pellets -> biogenic CO2 on a separate line, NOT added to fossil/Scope-1 total', () => {
	it('1 kg wood pellets -> Scope-1 CO2e = 0.05519389 kg CO2e/kg (CH4+N2O only)', () => {
		const co2e = emissionResults('1 kg wood pellets').find((r) => r.unit_id === 'kilogram_co2e');
		expect(Number(co2e?.raw)).toBeCloseTo(0.05519389, 6);
	});

	it('1 kg wood pellets -> biogenic CO2 = 1.67718 kg CO2/kg, on its OWN line', () => {
		const rows = emissionResults('1 kg wood pellets');
		const biogenicRow = rows.find(
			(r) => r.unit_id === 'kilogram_co2' && Number(r.raw).toFixed(5) === '1.67718'
		);
		expect(biogenicRow).toBeDefined();
		expect(biogenicRow?.warnings.some((w) => w.kind === 'biogenic_co2')).toBe(true);
	});

	it('the biogenic figure (1.67718) is NOT summed into the Scope-1 CO2e figure (0.05519389)', () => {
		const rows = emissionResults('1 kg wood pellets');
		const co2e = Number(rows.find((r) => r.unit_id === 'kilogram_co2e')?.raw);
		// If biogenic were wrongly folded in, co2e would be ~1.73 instead of ~0.055.
		expect(co2e).toBeLessThan(1);
	});
});

describe('§13.4 ethanol/biodiesel biogenic separation (uk-desnz-ghg-2025 "Outside of scopes")', () => {
	it('1 L ethanol -> Scope-1 CO2e 0.00901 kg/L, biogenic CO2 1.52 kg/L (very different magnitudes)', () => {
		const rows = emissionResults('1 L ethanol');
		const co2e = Number(rows.find((r) => r.unit_id === 'kilogram_co2e')?.raw);
		const biogenic = Number(rows.find((r) => r.unit_id === 'kilogram_co2')?.raw);
		expect(co2e).toBeCloseTo(0.00901, 5);
		expect(biogenic).toBeCloseTo(1.52, 2);
		expect(biogenic).toBeGreaterThan(co2e * 100); // biogenic dwarfs the fossil-scope figure
	});

	it('1 L biodiesel -> Scope-1 CO2e 0.16751 kg/L, biogenic CO2 2.39 kg/L', () => {
		const rows = emissionResults('1 L biodiesel');
		const co2e = Number(rows.find((r) => r.unit_id === 'kilogram_co2e')?.raw);
		const biogenic = Number(rows.find((r) => r.unit_id === 'kilogram_co2')?.raw);
		expect(co2e).toBeCloseTo(0.16751, 5);
		expect(biogenic).toBeCloseTo(2.39, 2);
	});

	it('biogenic rows for ethanol/biodiesel carry the "outside of scopes" biogenic warning', () => {
		for (const input of ['1 L ethanol', '1 L biodiesel']) {
			const rows = emissionResults(input);
			const biogenicRow = rows.find((r) => r.unit_id === 'kilogram_co2');
			expect(
				biogenicRow?.warnings.some((w) => w.kind === 'biogenic_co2'),
				input
			).toBe(true);
		}
	});
});

describe('§13.4 electricity kWh -> CO2e without region/year: documented data gap', () => {
	it('is NOT reachable via the real catalog today (see tests/golden/data-gaps.test.ts for the full account)', () => {
		const out = converter.convertText('1 kWh electricity');
		expect('error' in out).toBe(true);
	});
});

describe('§13.4 CO2 never derived from CO2e or vice versa (assert absence, not just presence)', () => {
	it('lignite has ONLY a CO2 factor in the catalog — no CO2e result should ever appear', () => {
		const lignite = emissionFactors.filter((f) => f.fuel_id === 'lignite');
		expect(lignite.map((f) => f.pollutant)).toEqual(['CO2']);
		const rows = emissionResults('1 kg lignite');
		expect(rows.find((r) => r.unit_id === 'kilogram_co2e' && r.value !== null)).toBeUndefined();
	});

	it('anthracite has ONLY a CO2 factor — no CO2e result appears', () => {
		const rows = emissionResults('1 kg anthracite');
		expect(rows.find((r) => r.unit_id === 'kilogram_co2e' && r.value !== null)).toBeUndefined();
	});

	it('LNG has ONLY a CO2e factor in the catalog — no CO2 result should ever appear', () => {
		const lng = emissionFactors.filter((f) => f.fuel_id === 'lng');
		expect(lng.map((f) => f.pollutant)).toEqual(['CO2e']);
		const rows = emissionResults('1 L LNG');
		expect(rows.find((r) => r.unit_id === 'kilogram_co2' && r.value !== null)).toBeUndefined();
	});

	it('hard coal has ONLY a CO2e factor — no CO2 result appears', () => {
		const hardCoal = emissionFactors.filter((f) => f.fuel_id === 'hard-coal');
		expect(hardCoal.map((f) => f.pollutant)).toEqual(['CO2e']);
		const rows = emissionResults('1 kg hard coal');
		expect(rows.find((r) => r.unit_id === 'kilogram_co2' && r.value !== null)).toBeUndefined();
	});

	it('pure methane has NO combustion emission factor at all — emissions show "not available"', () => {
		const methane = emissionFactors.filter((f) => f.fuel_id === 'methane');
		expect(methane).toHaveLength(0);
		const rows = emissionResults('1 kg methane');
		expect(rows.every((r) => r.value === null)).toBe(true);
	});
});
