/**
 * The grammar a human actually types (v0.3): explicit conversion targets
 * (`5 kWh to MJ`), durations for the power→energy bridge (`5 kW for 3 h`),
 * conversational phrasing, and error messages that say something true and
 * useful instead of guessing.
 *
 * Every case here was a real failure before v0.3 — "5 kwh to mj" used to be
 * reported as an unknown MATERIAL named "to mj".
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import type { ConversionResult, ConversionResultSet, ParseError } from '$lib/conversion/types';

const converter = getConverter();

function set(input: string): ConversionResultSet {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed: ${JSON.stringify(out.error)}`);
	return out;
}

function error(input: string): ParseError {
	const out = converter.convertText(input);
	if (!('error' in out)) throw new Error(`"${input}" unexpectedly parsed`);
	return out.error;
}

/** The row the user explicitly asked for. */
function targetRow(input: string): ConversionResult | undefined {
	return set(input)
		.groups.flatMap((g) => g.results)
		.find((r) => r.is_target);
}

describe('explicit conversion targets', () => {
	it('"5 kwh to mj" answers 18 MJ and marks it as the requested row', () => {
		const s = set('5 kwh to mj');
		expect(s.target).toEqual({
			unit_id: 'megajoule',
			unit_label: 'MJ',
			dimension: 'energy',
			resolved: true
		});
		const row = s.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.raw).toBe('18');
		expect(row?.exactness).toBe('exact');
	});

	it.each([
		['5 kWh in MJ', 'megajoule'],
		['5 kWh into MJ', 'megajoule'],
		['5 kWh -> MJ', 'megajoule'],
		['5 kWh → MJ', 'megajoule'],
		['5kWh->MJ', 'megajoule'],
		['5 kWh = MJ', 'megajoule'],
		['5 kWh as MJ', 'megajoule'],
		['convert 5 kwh to mj', 'megajoule'],
		['5 kWh to MJ?', 'megajoule']
	])('"%s" resolves the target to %s', (input, unitId) => {
		const s = set(input);
		expect(s.target?.unit_id).toBe(unitId);
		expect(s.target?.resolved).toBe(true);
	});

	it('the requested row is first in its group, and the other groups still appear', () => {
		const s = set('1 kWh to BTU');
		const energy = s.groups.find((g) => g.key === 'energy');
		expect(energy?.results[0]?.unit_id).toBe('btu');
		expect(energy?.results[0]?.is_target).toBe(true);
		// A target highlights — it never turns the tool into a single-answer box.
		expect(s.groups.some((g) => g.key === 'fuel_equivalents')).toBe(true);
		expect(s.groups.some((g) => g.key === 'industrial_units')).toBe(true);
	});

	it('a target outside the default display list is computed anyway ("1 kWh to cal")', () => {
		// 3.6 MJ ÷ 4.1868 J (International Table calorie, the catalog's basis).
		const row = targetRow('1 kWh to cal');
		expect(row?.unit_id).toBe('calorie');
		expect(Number(row?.raw)).toBeCloseTo(859845.23, 1);
	});

	it('"1 kWh in kcal" gives the dietary-scale figure', () => {
		const row = targetRow('1 kWh in kcal');
		expect(row?.unit_id).toBe('kilocalorie');
		expect(Number(row?.raw)).toBeCloseTo(859.845, 2);
	});

	it('a cross-dimension target works when a material is given ("1 L diesel to kg")', () => {
		const row = targetRow('1 L diesel to kg');
		expect(row?.unit_id).toBe('kilogram');
		expect(Number(row?.raw)).toBeCloseTo(0.832361, 5);
		expect(row?.exactness).toBe('source_based');
	});

	it('"10 L diesel to kWh" answers via the heating value', () => {
		const row = targetRow('10 L diesel to kWh');
		expect(Number(row?.raw)).toBeCloseTo(99.05, 1);
	});

	it('a cross-dimension target without a material asks for one instead of guessing', () => {
		const s = set('1 kg to kWh');
		const row = s.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.exactness).toBe('context_required');
		expect(row?.missing).toContain('fuel');
		expect(row?.value).toBeNull();
		expect(s.target?.resolved).toBe(false);
	});

	it('a target with no physical path is refused, not bridged ("1 kWh to kg CO2")', () => {
		const s = set('1 kWh to tCO2');
		const row = s.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.exactness).toBe('unsupported');
		expect(row?.explanation).toMatch(/no conversion path/i);
	});

	it('an unknown target is reported as a target, not as an unknown material', () => {
		const e = error('5 kWh to blah');
		expect(e.kind).toBe('unknown_unit');
		expect(e.message).toMatch(/target unit/i);
	});

	it('an ambiguous target asks which one ("1 kg to ton")', () => {
		const e = error('1 kg to ton');
		expect(e.kind).toBe('ambiguous_unit');
		expect(e.interpretations?.map((i) => i.unit_id)).toEqual(
			expect.arrayContaining(['tonne', 'short_ton', 'long_ton'])
		);
	});
});

describe('durations for the power → energy bridge', () => {
	it.each([
		['5 kW for 3 h', '15'],
		['5 kW for 3 hours', '15'],
		['5 kW × 3 h', '15'],
		['5 kW x 3h', '15'],
		['5 kW over 3 h', '15'],
		['5 kW for an hour', '5']
	])('"%s" yields %s kWh', (input, expected) => {
		const energy = set(input)
			.groups.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.value !== null);
		expect(energy?.raw).toBe(expected);
		expect(energy?.exactness).toBe('exact');
	});

	it('"2 kW for 30 min" is 1 kWh', () => {
		const energy = set('2 kW for 30 min')
			.groups.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.value !== null);
		expect(energy?.raw).toBe('1');
	});

	it('a duration plus a target combine ("2 kW for 3 h to MJ")', () => {
		const row = targetRow('2 kW for 3 h to MJ');
		expect(row?.unit_id).toBe('megajoule');
		expect(Number(row?.raw)).toBeCloseTo(21.6, 6);
	});

	it('without a duration the power → energy answer is still refused', () => {
		const energy = set('5 kW')
			.groups.flatMap((g) => g.results)
			.find((r) => r.category === 'energy');
		expect(energy?.exactness).toBe('context_required');
		expect(energy?.missing).toContain('time');
	});

	it('a non-time "for" phrase is never mistaken for a duration', () => {
		// "for cars" must not be read as a duration; it is an unknown material.
		expect(error('1 L diesel for cars').kind).toBe('unknown_fuel');
	});

	it('a duration is magnitude-guarded like the leading value', () => {
		// Without this the 17-character "5 kW for 1e5000 h" produced a
		// 5001-digit answer that every downstream conversion had to carry.
		const e = error('5 kW for 1e5000 h');
		expect(e.kind).toBe('unsupported_value');
		expect(e.message).toContain('supported range');
	});

	it('a negative duration is refused rather than producing negative energy', () => {
		const e = error('5 kW for -3 h');
		expect(e.kind).toBe('unsupported_value');
		expect(e.message).toMatch(/cannot be negative/i);
	});

	it('a zero duration is legitimate and gives zero energy', () => {
		const energy = set('5 kW for 0 h')
			.groups.flatMap((g) => g.results)
			.find((r) => r.category === 'energy' && r.value !== null);
		expect(energy?.raw).toBe('0');
	});

	it('a dangling keyword asks for what is missing instead of blaming a material', () => {
		expect(error('1 kWh to').kind).toBe('no_unit');
		expect(error('1 kWh to').message).toMatch(/needs a unit after it/i);
		expect(error('5 kW for').message).toMatch(/needs a duration after it/i);
	});
});

describe('words the parser could not place are never dropped silently', () => {
	it('"1 L red diesel" answers for plain diesel and says that it did', () => {
		// Red diesel (gas oil) has its own density, calorific value and emission
		// factor. Answering with road-diesel numbers in silence would be the
		// exact failure mode this product exists to prevent.
		const s = set('1 L red diesel');
		expect(s.input.fuel_id).toBe('diesel');
		const note = s.assumptions.find((a) => a.kind === 'parser_note');
		expect(note?.text).toContain('red');
		expect(note?.text).toContain('plain diesel');
	});

	it('genuine filler between unit and material stays silent', () => {
		const s = set('10 litres of diesel');
		expect(s.input.fuel_id).toBe('diesel');
		expect(s.assumptions.some((a) => a.kind === 'parser_note')).toBe(false);
	});
});

describe('conversational phrasing', () => {
	it('"how many kWh in 1 liter diesel?" converts the litre and targets kWh', () => {
		const s = set('how many kWh in 1 liter diesel?');
		expect(s.input.fuel_id).toBe('diesel');
		expect(s.target?.unit_id).toBe('kilowatt_hour');
		expect(s.target?.resolved).toBe(true);
	});

	it('"how much CO2 is in 1 liter diesel" answers the litre (CO2 is not a unit)', () => {
		const s = set('how much CO2 is in 1 liter diesel');
		expect(s.input.fuel_id).toBe('diesel');
		expect(s.target).toBeUndefined();
		expect(s.groups.some((g) => g.key === 'emissions')).toBe(true);
	});

	it('plain queries are unaffected by the filler stripping', () => {
		expect(set('1 kWh').input.unit_id).toBe('kilowatt_hour');
		expect(set('10 litres of diesel').input.fuel_id).toBe('diesel');
		expect(set('1 kg hydrogen').input.fuel_id).toBe('hydrogen');
	});
});

describe('error messages that help', () => {
	it('a value with no unit explains that the unit is never guessed', () => {
		const e = error('5');
		expect(e.kind).toBe('no_unit');
		expect(e.message).toContain('5');
		expect(e.hint).toMatch(/never guessed/i);
	});

	it('a bare material says it is a material and shows the shape to use', () => {
		const e = error('diesel');
		expect(e.kind).toBe('missing_value');
		expect(e.message).toMatch(/material/i);
		expect(e.message).toContain('1 L diesel');
	});

	it('an unknown material suggests the closest real fuels', () => {
		const e = error('1 barrel oil');
		expect(e.kind).toBe('unknown_fuel');
		expect(e.suggestions).toEqual(expect.arrayContaining(['crude oil']));
	});

	it('"1 m3 gas" suggests natural gas rather than giving up', () => {
		const e = error('1 m3 gas');
		expect(e.kind).toBe('unknown_fuel');
		expect(e.suggestions?.length).toBeGreaterThan(0);
		expect(e.suggestions?.some((s) => /gas/i.test(s))).toBe(true);
	});

	it.each([
		['20 °C', /temperature/i],
		['1 mile', /length/i],
		['3 bar', /pressure/i],
		['5 gb', /storage/i],
		['10 eur', /currency/i]
	])('"%s" is honestly reported as out of scope', (input, pattern) => {
		const e = error(input);
		expect(e.kind).toBe('unknown_unit');
		expect(`${e.message} ${e.hint ?? ''}`).toMatch(pattern);
		// No nonsense edit-distance guesses for a quantity we simply do not do.
		expect(e.suggestions ?? []).toEqual([]);
	});

	it('unrelated words get no suggestions rather than absurd ones', () => {
		// "mtoe" used to be offered for "mile" — a 4-letter word two edits away.
		const e = error('1 mile');
		expect(e.suggestions ?? []).toEqual([]);
	});

	it('a genuine typo still gets a suggestion', () => {
		const e = error('1 kilowat hour');
		expect(e.kind).toBe('unknown_unit');
		expect(e.suggestions?.length).toBeGreaterThan(0);
	});
});
