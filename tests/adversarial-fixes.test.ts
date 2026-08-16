/**
 * Regression pins for defects found by adversarial review of v0.3.2.
 *
 * Each of these shipped, passed every gate, and was caught by nobody's test —
 * which is the point of pinning them here rather than trusting that the fix
 * stays fixed.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { loadDataBundle } from '$lib/data/load-data';
import type { ConversionResult } from '$lib/conversion/types';

const converter = getConverter();
const { fuels } = loadDataBundle();

function results(input: string): ConversionResult[] {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results);
}

function rowFor(input: string, category: string, unitId: string): ConversionResult | undefined {
	return results(input).find((r) => r.category === category && r.unit_id === unitId);
}

describe('CNG is not gaseous natural gas (218x density difference)', () => {
	// `cng` was an alias of `natural-gas`, so `1 L cng` answered with pipeline-gas
	// density (0.802 kg/m3) instead of CNG's 175 kg/m3 — a confident, sourced,
	// 218x-low number, the exact failure this project exists to prevent.
	it('1 L CNG weighs 0.175 kg, not 0.000802 kg', () => {
		expect(Number(rowFor('1 L CNG', 'mass', 'kilogram')?.raw)).toBeCloseTo(0.175, 6);
	});

	it('1 L CNG emits 0.4507 kg CO2e', () => {
		expect(Number(rowFor('1 L CNG', 'emissions', 'kilogram_co2e')?.raw)).toBeCloseTo(0.4507, 4);
	});

	it('natural gas keeps its own, much lower density', () => {
		expect(Number(rowFor('1 m3 natural gas', 'mass', 'kilogram')?.raw)).toBeCloseTo(0.802, 3);
	});

	it('carries no CO2-only factor, because DESNZ publishes none for it', () => {
		// CO2 must never be derived from CO2e.
		const co2 = results('1 L CNG').find(
			(r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2'
		);
		expect(co2?.raw ?? null).toBeNull();
	});
});

describe('biomethane does not silently answer as biogas', () => {
	// Biomethane's NCV is 49 GJ/t against biogas's 20 — 2.45x — and it would also
	// have inherited biogas's biogenic CO2, a figure never recorded for it. It has
	// no recorded emission factor, so under ADR 0005 it must not ship; and
	// therefore it must not resolve to something else either.
	it('is refused rather than answered with the wrong numbers', () => {
		const out = converter.convertText('1 kg biomethane');
		expect('error' in out).toBe(true);
		if ('error' in out) expect(out.error.kind).toBe('unknown_fuel');
	});

	it('is not claimed by any shipped fuel', () => {
		for (const f of fuels) {
			expect([...f.names, ...f.aliases].map((s) => s.toLowerCase())).not.toContain('biomethane');
		}
	});
});

describe('a prototype-chain key does not crash the parser', () => {
	// AMBIGUOUS_TOKENS was a plain object literal indexed with raw user input, so
	// `5 constructor` reached an inherited function and threw — 500 from the API,
	// and in the UI the previous answer stayed on screen for the new input.
	it.each(['5 constructor', '5 __proto__', '1 kWh to constructor', '5 valueof'])(
		'"%s" returns a structured error instead of throwing',
		(query) => {
			const out = converter.convertText(query);
			expect('error' in out).toBe(true);
		}
	);

	it('still reports the genuinely ambiguous tokens', () => {
		const out = converter.convertText('1 ton');
		expect('error' in out).toBe(true);
		if ('error' in out) expect(out.error.kind).toBe('ambiguous_unit');
	});
});

describe('a price is never misread silently', () => {
	// "1,500 EUR/kWh" is ambiguous: 1500, or a European 1.5? The parser guesses
	// thousands-separator and MUST say so — billing a German-locale user 1000x
	// what they meant with nothing on screen is the worst outcome here.
	it('an ambiguous thousands separator is reported, not swallowed', () => {
		const out = converter.convertText('1000 kWh at 1,500 EUR/kWh');
		if ('error' in out) throw new Error('should parse');
		const note = out.assumptions.find((a) => a.kind === 'parser_note');
		expect(note?.text).toMatch(/price/i);
		expect(note?.text).toContain('1,500');
	});

	it.each(['1000 kWh at 1.2.3 EUR/kWh', '1000 kWh at 1,2,3 EUR/kWh', '1000 kWh at , EUR/kWh'])(
		'"%s" is refused instead of throwing or inventing a figure',
		(query) => {
			const out = converter.convertText(query);
			expect('error' in out).toBe(true);
		}
	);

	it('an unambiguous price still parses without a note', () => {
		const out = converter.convertText('1000 kWh at 0.32 EUR/kWh');
		if ('error' in out) throw new Error('should parse');
		expect(out.assumptions.some((a) => a.kind === 'parser_note')).toBe(false);
	});
});

describe('energy → mass inherits the heating value’s floor (rulebook §B.3)', () => {
	// `1 kg lignite` was correctly `estimated` with a 5.5–21.6 MJ range, while the
	// inverse `1 GJ lignite` printed `84.03 kg` as `source_based` — four
	// significant figures from a factor whose own 95% CI spans a factor of four.
	it('1 GJ lignite is an estimate, not a source-based figure', () => {
		const mass = rowFor('1 GJ lignite', 'mass', 'kilogram');
		expect(mass?.exactness).toBe('estimated');
	});

	it('the forward direction still agrees with it', () => {
		expect(rowFor('1 kg lignite', 'energy', 'megajoule')?.exactness).toBe('estimated');
	});

	it('a fuel with a tight heating value stays source-based', () => {
		expect(rowFor('1 GJ diesel', 'mass', 'kilogram')?.exactness).toBe('source_based');
	});
});

describe('a second duration is refused, not silently discarded', () => {
	// "5 kW for 3 h for 2 h" kept the first and answered 15 kWh with no note. The
	// target branch already refuses the equivalent "5 kWh to MJ to GJ".
	it('reports the contradiction', () => {
		const out = converter.convertText('5 kW for 3 h for 2 h');
		expect('error' in out).toBe(true);
		if ('error' in out) expect(out.error.message).toMatch(/two durations/i);
	});

	it('a single duration still works', () => {
		expect(rowFor('5 kW for 3 h', 'energy', 'kilowatt_hour')?.raw).toBe('15');
	});
});

describe('the calculation path is dimensionally possible', () => {
	// Gas oil has no per-litre calorific value, so a litre input runs through the
	// per-KILOGRAM one. The formula read "1 L gas oil × 42.569 MJ/kg = 36.35 MJ"
	// — litres times MJ per kilogram, with the × density step invisible. The
	// value was right; the audit trail, which is this product's whole point,
	// was not.
	it('a volume priced by a per-mass heating value shows the density step', () => {
		const row = rowFor('1 L gas oil', 'energy', 'megajoule');
		expect(row?.formula).toContain('density');
		expect(row?.formula).toContain('kg');
		expect(row?.formula).not.toMatch(/^1 L gas oil × [\d.]+ MJ\/kg/);
	});

	it('a fuel WITH a per-litre value still shows the simple path', () => {
		const row = rowFor('1 L diesel', 'energy', 'megajoule');
		expect(row?.formula).not.toContain('density');
	});
});
