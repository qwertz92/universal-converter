/**
 * User-facing PROSE is checked against the catalog it describes.
 *
 * The provenance ledger test covers `data/**`. It does not cover the sentences
 * the reader actually reads — and that is where the worst defect of the v0.3.4
 * review lived: the info popover ON the LHV/HHV toggle said the two bases
 * "differ by ~5–6% for gas", while the catalog's own natural-gas entry has
 * always said 45.745 → 50.678 MJ/kg, a gap of 10.8%. The categories were
 * swapped — 5–6% is the petrol-and-coal figure — so the one control that
 * governs the basis choice told a gas user the choice cost half what it does.
 *
 * A number in copy is a claim like any other. These tests recompute the claims
 * from the shipped data.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadDataBundle } from '$lib/data/load-data';

const { fuels } = loadDataBundle();

/** HHV/LHV gap in percent for a fuel, on whichever unit carries both bases. */
function basisGapPercent(fuelId: string): number {
	const fuel = fuels.find((f) => f.id === fuelId);
	if (!fuel) throw new Error(`no such fuel: ${fuelId}`);
	const byUnit = new Map<string, { lhv?: number; hhv?: number }>();
	for (const hv of fuel.heating_values ?? []) {
		const entry = byUnit.get(hv.unit) ?? {};
		entry[hv.basis] = Number(hv.value);
		byUnit.set(hv.unit, entry);
	}
	for (const { lhv, hhv } of byUnit.values()) {
		if (lhv && hhv) return (hhv / lhv - 1) * 100;
	}
	throw new Error(`${fuelId} has no unit carrying both bases`);
}

const read = (path: string) => readFileSync(path, 'utf8');

describe('the LHV/HHV gap quoted in copy matches the catalog', () => {
	it('natural gas and methane are ~11%, not ~5-6%', () => {
		expect(basisGapPercent('natural-gas')).toBeGreaterThan(10);
		expect(basisGapPercent('natural-gas')).toBeLessThan(12);
		expect(basisGapPercent('methane')).toBeGreaterThan(10);
	});

	it('petrol and coal are the ~5-6% case', () => {
		expect(basisGapPercent('gasoline')).toBeGreaterThan(5);
		expect(basisGapPercent('gasoline')).toBeLessThan(6);
		expect(basisGapPercent('hard-coal')).toBeLessThan(6);
	});

	it('hydrogen is ~18%', () => {
		expect(basisGapPercent('hydrogen')).toBeGreaterThan(17);
		expect(basisGapPercent('hydrogen')).toBeLessThan(19);
	});

	it.each([
		['src/lib/components/converter/OptionsBar.svelte', 'the basis toggle'],
		['src/lib/content/learn-bodies.ts', 'the learn page'],
		['docs/conversion-rules.md', 'the rulebook']
	])('%s does not pair "gas" with the 5-6%% figure', (path) => {
		const text = read(path);
		// The exact phrasing that was wrong, in each of its three homes.
		expect(text).not.toMatch(/~?5[–-]6%\s*(error\s*)?for\s+gas\b/i);
		expect(text).not.toMatch(/natural gas[^.]{0,40}roughly\s*<code>~5[–-]6%/i);
	});
});

describe('copy does not describe figures the catalog has withdrawn', () => {
	it('no page still promises a barrel-of-crude energy range', () => {
		// The ~5.6-6.3 GJ range was withdrawn as unsourced; crude oil now has no
		// density, so a barrel produces no energy at all. Two Learn pages
		// contradicted each other about this.
		const learn = read('src/lib/content/learn-bodies.ts');
		expect(learn).not.toMatch(/physical barrel'?s energy as a range/i);
		expect(learn).not.toMatch(/estimated crude-energy figure/i);
	});

	it('no page claims a European therm differs from the US one', () => {
		// The rulebook and units.json both put UK/EC therms through the same
		// 100,000-Btu_IT chain and claim no divergence.
		const learn = read('src/lib/content/learn-bodies.ts');
		expect(learn).not.toMatch(/differs only at about the <code>10\^-5<\/code> level/i);
		expect(learn).not.toMatch(/European therm[^.]{0,60}10\^-5/i);
	});
});
