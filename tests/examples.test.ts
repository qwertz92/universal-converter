/**
 * Every quick-example in data/examples.json must PARSE cleanly against the
 * shipped data catalog (spec §8.1 "Beispiele/Schnellstarter", §8.2 input list,
 * §23 "Quick Examples funktionieren").
 *
 * "Parse cleanly" means: `getConverter().convertText(input)` does NOT return a
 * parse ParseError — specifically not `unknown_unit` / `unknown_fuel` /
 * `no_unit` / `ambiguous_unit`. A `context_required` RESULT (e.g. electricity
 * with no region/year, or a bare mass/volume with no fuel) is a valid outcome
 * of a successful parse, NOT a failure — the converter understood the input and
 * is asking for one more thing. Only genuine parse failures fail this test.
 *
 * This file also guards the spec §8.2 contract directly: every literal input
 * from that list is asserted to parse, so a future data edit that drops a fuel
 * alias or unit is caught here.
 */

import { describe, expect, it } from 'vitest';
import { getConverter, loadExamples } from '$lib/index';
import type { ConversionResultSet } from '$lib/conversion/types';

const converter = getConverter();

/** The exact spec §8.2 input list — must all parse (fuels resolved via aliases). */
const SPEC_8_2_INPUTS = [
	'1 kWh',
	'1 MWh',
	'1 MJ',
	'1 GJ',
	'1 BTU',
	'1 MMBTU',
	'1 therm',
	'1 toe',
	'1 boe',
	'1000 kcal',
	'1 liter diesel',
	'1 L gasoline',
	'1 liter fuel oil',
	'1 barrel crude oil',
	'1 m3 natural gas',
	'1 kg hydrogen',
	'1 kg hard coal',
	'1 kg lignite',
	'1 kg wood pellets'
];

function isParseFailure(out: ConversionResultSet | { error: { kind: string } }): boolean {
	return 'error' in out;
}

describe('quick examples parse cleanly (spec §8.2, §23)', () => {
	const examples = loadExamples();

	it('examples.json is non-empty and every entry has an input', () => {
		expect(examples.length).toBeGreaterThan(0);
		for (const ex of examples) {
			expect(ex.input.trim().length).toBeGreaterThan(0);
		}
	});

	it.each(loadExamples().map((ex) => [ex.id, ex.input] as const))(
		'example %s (%s) parses without an unknown-unit/fuel error',
		(_id, input) => {
			const out = converter.convertText(input);
			if (isParseFailure(out)) {
				throw new Error(
					`example "${input}" failed to parse: ${(out as { error: { kind: string; message: string } }).error.kind} — ${
						(out as { error: { message: string } }).error.message
					}`
				);
			}
			// A successful parse yields at least one result group.
			expect((out as ConversionResultSet).groups.length).toBeGreaterThan(0);
		}
	);
});

describe('every spec §8.2 input parses against the shipped catalog', () => {
	it.each(SPEC_8_2_INPUTS)('parses "%s"', (input) => {
		const out = converter.convertText(input);
		expect(isParseFailure(out)).toBe(false);
	});

	it('every spec §8.2 input is also present in examples.json', () => {
		const inputs = new Set(loadExamples().map((e) => e.input));
		for (const spec of SPEC_8_2_INPUTS) {
			expect(inputs.has(spec), `examples.json is missing spec §8.2 input "${spec}"`).toBe(true);
		}
	});
});

describe('fuel examples produce real fuel result groups (spec §8.5)', () => {
	it('1 L diesel yields mass, energy and emissions results', () => {
		const out = converter.convertText('1 L diesel');
		if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
		const cats = new Set(out.groups.map((g) => g.key));
		expect(cats.has('mass')).toBe(true);
		expect(cats.has('energy')).toBe(true);
		expect(cats.has('emissions')).toBe(true);
	});

	it('1 kg hydrogen reports combustion CO2 = 0 (exact), not "not available"', () => {
		const out = converter.convertText('1 kg hydrogen');
		if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
		const co2 = out.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2');
		expect(co2?.raw).toBe('0');
		expect(co2?.exactness).toBe('exact');
	});

	it('1 kg wood pellets reports a separate biogenic CO2 line', () => {
		const out = converter.convertText('1 kg wood pellets');
		if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
		const warnings = out.warnings.map((w) => w.kind);
		expect(warnings).toContain('biogenic_co2');
	});

	it('1 m3 natural gas carries the billing/reference-condition warning', () => {
		const out = converter.convertText('1 m3 natural gas');
		if ('error' in out) throw new Error(`parse failed: ${out.error.message}`);
		expect(out.warnings.some((w) => /billing|Brennwert|Zustandszahl|reference/i.test(w.text))).toBe(
			true
		);
	});
});
