/**
 * THE PROVENANCE LEDGER, ENFORCED.
 *
 * `AGENTS.md` and `docs/adr/0002-data-provenance.md` say every non-exact number
 * this project ships is transcribed from `docs/research-notes.md`. Until now
 * that was a habit, checked by review: the v0.1 review (P1-D) caught two value
 * sets that had been shipped without ever being recorded, and an adversarial
 * review later found a third (the "~5.6–6.3 GJ" barrel-of-crude range, which
 * traced to nothing at all). A habit that has already failed three times is a
 * test, so this file is that test.
 *
 * What is checked, for `data/fuels.json` and `data/emission-factors.json`:
 *
 *  1. **Every machine-readable number** — densities, density ranges, heating
 *     values and their ranges, and every emission-factor value — appears in
 *     `docs/research-notes.md`, either verbatim or as a ×1000 / ÷1000 rescale
 *     (tonne→kg, kg/kWh→g/kWh, kg/TJ→kg/GJ) that the entry's own notes state.
 *  2. **Derived values are recomputed**, not trusted. Four volumetric heating
 *     values are products of two recorded DESNZ cells rather than cells
 *     themselves; each is multiplied out here from the recorded inputs, and no
 *     new "DERIVED" value can appear without being added to that table.
 *  3. **Numbers in prose too** — a figure quoted with a physical unit inside a
 *     `notes` / `warnings` / `typical_ranges` / `uncertainty` field must trace
 *     as well. This is where the barrel-of-crude range hid: it never reached
 *     the engine, but it reached the reader, which is the same problem.
 *
 * Deliberate limits, so nobody reads more assurance into a green run than it
 * gives: matching is by numeric value, not by context, so a number could in
 * principle match an unrelated figure elsewhere in the ledger. This test proves
 * a value was RECORDED — it cannot prove it was recorded for the right fuel.
 * Pure arithmetic ABOUT recorded values (percentages, multipliers, sums stated
 * in prose) carries no unit and is out of scope by construction.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Decimal from 'decimal.js';
import { loadDataBundle } from '$lib/data/load-data';

Decimal.set({ precision: 40 });

const LEDGER_PATH = new URL('../docs/research-notes.md', import.meta.url);
const ledger = readFileSync(LEDGER_PATH, 'utf8');
const { fuels, emissionFactors } = loadDataBundle();

/* ------------------------------------------------------------------ *
 * The recorded numbers
 * ------------------------------------------------------------------ */

/** Canonical numeric key, so "47.0", "47" and "5.50" compare as recorded. */
function canonical(raw: string): string | undefined {
	try {
		return new Decimal(raw.replace(/,/g, '')).toString();
	} catch {
		return undefined;
	}
}

/** canonical value -> the literal spellings the ledger uses for it. */
const RECORDED = new Map<string, Set<string>>();
for (const match of ledger.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
	const key = canonical(match[0]);
	if (key === undefined) continue;
	const spellings = RECORDED.get(key) ?? new Set<string>();
	spellings.add(match[0]);
	RECORDED.set(key, spellings);
}

type Trace =
	{ kind: 'verbatim' } | { kind: 'rescaled'; factor: '×1000' | '÷1000'; spellings: string[] };

/**
 * How a shipped value traces to the ledger, if it does. The ×1000 / ÷1000
 * allowance exists because DESNZ publishes per tonne and IPCC per TJ while the
 * catalog stores per kg and per GJ; both are exact rescales, and every entry
 * using one states the original figure in its own notes (asserted below).
 */
function trace(value: string): Trace | undefined {
	const key = canonical(value);
	if (key === undefined) return undefined;
	if (RECORDED.has(key)) return { kind: 'verbatim' };

	const decimal = new Decimal(value);
	const up = canonical(decimal.times(1000).toString());
	if (up && RECORDED.has(up)) {
		return { kind: 'rescaled', factor: '×1000', spellings: [...RECORDED.get(up)!] };
	}
	const down = canonical(decimal.div(1000).toString());
	if (down && RECORDED.has(down)) {
		return { kind: 'rescaled', factor: '÷1000', spellings: [...RECORDED.get(down)!] };
	}
	return undefined;
}

/** Assert one shipped number traces, and that a rescale is stated where used. */
function expectTraceable(value: string, where: string, ownNotes: string): void {
	const traced = trace(value);
	expect(
		traced,
		`${where}: '${value}' appears nowhere in docs/research-notes.md. Record it there with its ` +
			`source cell, or remove it — a value that does not trace does not ship.`
	).toBeDefined();
	if (traced?.kind === 'rescaled') {
		const stated = traced.spellings.some((s) => ownNotes.includes(s));
		expect(
			stated,
			`${where}: '${value}' only traces as a ${traced.factor} rescale of ${traced.spellings.join(
				'/'
			)}, but its own notes never state that original figure. A silent rescale is indistinguishable ` +
				`from a typo — quote the source's own number in the entry.`
		).toBe(true);
	}
}

/* ------------------------------------------------------------------ *
 * 1. Machine-readable values
 * ------------------------------------------------------------------ */

/**
 * Volumetric heating values that are NOT source cells: each is the product of
 * two recorded DESNZ figures, because DESNZ's own per-volume cell is rounded to
 * 0.01 kWh/L (natural gas) or absent (LNG). Recorded in research-notes' 2026-08-16
 * addendum; recomputed here so the shipped digits are checked, not just present.
 */
const DERIVED: Record<string, { inputs: [string, string]; why: string }> = {
	'natural-gas:lhv:kwh_per_m3': {
		inputs: ['0.802', '12.707'],
		why: 'DESNZ density 0.802 kg/m³ × Net CV 12.707 kWh/kg'
	},
	'natural-gas:hhv:kwh_per_m3': {
		inputs: ['0.802', '14.077'],
		why: 'DESNZ density 0.802 kg/m³ × Gross CV 14.077 kWh/kg'
	},
	'lng:lhv:kwh_per_l': {
		inputs: ['0.452489', '12.707'],
		why: 'DESNZ LNG density 0.452489 kg/L × Net CV 12.707 kWh/kg'
	},
	'lng:hhv:kwh_per_l': {
		inputs: ['0.452489', '14.077'],
		why: 'DESNZ LNG density 0.452489 kg/L × Gross CV 14.077 kWh/kg'
	}
};

const hvKey = (fuelId: string, basis: string, unit: string) => `${fuelId}:${basis}:${unit}`;

describe('every shipped fuel value traces to the research ledger', () => {
	it('the ledger itself parses into a usable set of recorded numbers', () => {
		// Guards against the whole file passing because the ledger failed to load
		// (an empty RECORDED map would make every lookup fail, not pass — but a
		// silently truncated read would weaken the test without failing it).
		expect(ledger.length).toBeGreaterThan(20_000);
		expect(RECORDED.size).toBeGreaterThan(500);
		expect(RECORDED.has('42.3')).toBe(true); // IPCC crude-oil NCV, §4.1
	});

	it('every density (and density range) is recorded', () => {
		let checked = 0;
		for (const fuel of fuels) {
			const d = fuel.density;
			if (!d) continue;
			const notes = `${d.notes ?? ''} ${fuel.notes ?? ''}`;
			expectTraceable(d.value, `fuels.${fuel.id}.density`, notes);
			if (d.range) {
				expectTraceable(d.range.low, `fuels.${fuel.id}.density.range.low`, notes);
				expectTraceable(d.range.high, `fuels.${fuel.id}.density.range.high`, notes);
			}
			checked++;
		}
		expect(checked).toBeGreaterThan(15);
	});

	it('every heating value (and range) is recorded, or is a checked derivation', () => {
		let recorded = 0;
		let derived = 0;
		for (const fuel of fuels) {
			for (const hv of fuel.heating_values ?? []) {
				const where = `fuels.${fuel.id}.heating_values[${hv.basis}/${hv.unit}]`;
				const notes = `${hv.notes ?? ''} ${fuel.notes ?? ''}`;
				const derivation = DERIVED[hvKey(fuel.id, hv.basis, hv.unit)];
				if (derivation) {
					const [a, b] = derivation.inputs;
					expect(trace(a), `${where}: derivation input ${a} is not recorded`).toBeDefined();
					expect(trace(b), `${where}: derivation input ${b} is not recorded`).toBeDefined();
					const decimals = (hv.value.split('.')[1] ?? '').length;
					const product = new Decimal(a).times(b).toFixed(decimals, Decimal.ROUND_HALF_EVEN);
					expect(
						new Decimal(hv.value).toString(),
						`${where}: shipped ${hv.value} but ${derivation.why} gives ${product}`
					).toBe(new Decimal(product).toString());
					expect(hv.notes ?? '', `${where}: a derived value must say so in its notes`).toContain(
						'DERIVED'
					);
					derived++;
					continue;
				}
				expectTraceable(hv.value, where, notes);
				if (hv.range) {
					expectTraceable(hv.range.low, `${where}.range.low`, notes);
					expectTraceable(hv.range.high, `${where}.range.high`, notes);
				}
				recorded++;
			}
		}
		expect(recorded).toBeGreaterThan(50);
		expect(derived).toBe(Object.keys(DERIVED).length);
	});

	it('nothing calls itself DERIVED without being recomputed here', () => {
		const claimed = fuels.flatMap((f) =>
			(f.heating_values ?? [])
				.filter((hv) => (hv.notes ?? '').includes('DERIVED'))
				.map((hv) => hvKey(f.id, hv.basis, hv.unit))
		);
		expect(claimed.sort()).toEqual(Object.keys(DERIVED).sort());
	});
});

describe('every shipped emission factor traces to the research ledger', () => {
	it('every factor value is recorded (verbatim or as a stated exact rescale)', () => {
		for (const factor of emissionFactors) {
			expectTraceable(
				factor.value,
				`emission_factors.${factor.id}`,
				`${factor.notes ?? ''} ${factor.uncertainty ?? ''}`
			);
		}
		expect(emissionFactors.length).toBeGreaterThan(30);
	});

	it('CO2 and CO2e values for one fuel are separately recorded, never derived from each other', () => {
		// The rulebook (§C.5, §D.6) bans a CO2→CO2e path. The ledger check above
		// proves each is transcribed; this asserts they are genuinely two numbers.
		const byFuel = new Map<string, { co2?: string; co2e?: string }>();
		for (const f of emissionFactors) {
			if (!f.fuel_id) continue;
			const entry = byFuel.get(f.fuel_id) ?? {};
			if (f.pollutant === 'CO2') entry.co2 = f.value;
			if (f.pollutant === 'CO2e') entry.co2e = f.value;
			byFuel.set(f.fuel_id, entry);
		}
		let pairs = 0;
		for (const [fuelId, { co2, co2e }] of byFuel) {
			if (co2 === undefined || co2e === undefined) continue;
			pairs++;
			expect(co2, `${fuelId}: CO2 and CO2e are the same number`).not.toBe(co2e);
			expect(trace(co2), `${fuelId} CO2`).toBeDefined();
			expect(trace(co2e), `${fuelId} CO2e`).toBeDefined();
		}
		expect(pairs).toBeGreaterThan(10);
	});
});

/* ------------------------------------------------------------------ *
 * 2. Prose the reader sees
 * ------------------------------------------------------------------ */

/**
 * A number carrying a physical unit, in prose. Ranges ("800–950 kg/m³") yield
 * both bounds. Bare numbers are skipped on purpose: percentages, multipliers,
 * years and section references are arithmetic or bookkeeping ABOUT recorded
 * values, not figures quoted from a source.
 */
const QUOTED_FIGURE =
	/(\d[\d,]*(?:\.\d+)?)(?:\s*[–—-]\s*(\d[\d,]*(?:\.\d+)?))?\s*(?:MMBtu|MMBTU|kgCO2e|kgCO2|gCO2e|gCO2|kWh|MWh|GWh|kJ|MJ|GJ|TJ|Btu|BTU|Wh|kg|mg|tonnes|tonne|litres|litre|m³|L|J|g|t)(?![A-Za-z])/g;

function proseFigures(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(QUOTED_FIGURE)) {
		out.push(m[1]);
		if (m[2]) out.push(m[2]);
	}
	return out;
}

function proseFields(): Array<{ where: string; text: string }> {
	const fields: Array<{ where: string; text: string }> = [];
	for (const f of fuels) {
		const push = (label: string, text: string | undefined) => {
			if (text) fields.push({ where: `fuels.${f.id}.${label}`, text });
		};
		push('notes', f.notes);
		push('typical_ranges', f.typical_ranges);
		(f.warnings ?? []).forEach((w, i) => push(`warnings[${i}]`, w));
		push('density.notes', f.density?.notes);
		(f.heating_values ?? []).forEach((hv, i) => push(`heating_values[${i}].notes`, hv.notes));
	}
	for (const ef of emissionFactors) {
		if (ef.notes) fields.push({ where: `emission_factors.${ef.id}.notes`, text: ef.notes });
		if (ef.uncertainty) {
			fields.push({ where: `emission_factors.${ef.id}.uncertainty`, text: ef.uncertainty });
		}
	}
	return fields;
}

describe('figures quoted in prose trace too (this is where the barrel range hid)', () => {
	it('every unit-carrying number in a notes/warning/range field is recorded', () => {
		const untraceable: string[] = [];
		let checked = 0;
		for (const { where, text } of proseFields()) {
			for (const figure of proseFigures(text)) {
				checked++;
				if (!trace(figure)) untraceable.push(`${where}: ${figure}`);
			}
		}
		expect(checked).toBeGreaterThan(100);
		expect(
			untraceable,
			`These figures are shown to readers but appear nowhere in docs/research-notes.md:\n  ` +
				`${untraceable.join('\n  ')}`
		).toEqual([]);
	});

	it('the withdrawn barrel-of-crude range stays withdrawn', () => {
		// ~5.6–6.3 GJ per physical barrel shipped for three releases with no
		// ledger entry; it was removed rather than back-cited. Named explicitly
		// because the ledger's own addendum now quotes the figure while explaining
		// its withdrawal — which means the generic check above would accept it
		// back. This one would not.
		const everything = proseFields()
			.map((f) => f.text)
			.join(' ');
		expect(everything).not.toMatch(/5\.6\s*[–—-]\s*6\.3/);
	});
});
