/**
 * §13.2 PARSER — extended coverage beyond tests/parser.test.ts, exercised
 * against the REAL shipped data catalog (getConverter()) rather than the
 * synthetic fixture, so real fuel aliases (German included) are verified.
 *
 * Covers: `1 kilowatt hour`, `1000 kcal`, `1 liter diesel`, `1 L diesel`,
 * `1 barrel crude oil`, `1 m3 natural gas`, `1,5 MJ` (comma decimal), case
 * variants, German aliases (`1 liter benzin`, `1 kg holzpellets`), unknown
 * unit -> suggestions, missing value, ambiguous "1 ton ..." -> interpretations
 * listed, whitespace robustness.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';

const converter = getConverter();

describe('§13.2 parser — spec §8.2 literal inputs against the real catalog', () => {
	it('parses "1 kWh"', () => {
		const r = converter.parse('1 kWh');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('parses "1 kilowatt hour" (multi-word name)', () => {
		const r = converter.parse('1 kilowatt hour');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('parses "1000 kcal"', () => {
		const r = converter.parse('1000 kcal');
		expect(r.ok && r.query.value).toBe('1000');
		expect(r.ok && r.query.unit_id).toBe('kilocalorie');
	});

	it('parses "1 liter diesel" against the real diesel fuel entry', () => {
		const r = converter.parse('1 liter diesel');
		expect(r.ok && r.query.unit_id).toBe('liter');
		expect(r.ok && r.query.fuel_id).toBe('diesel');
	});

	it('parses "1 L diesel" (symbol form) the same as "1 liter diesel"', () => {
		const r = converter.parse('1 L diesel');
		expect(r.ok && r.query.unit_id).toBe('liter');
		expect(r.ok && r.query.fuel_id).toBe('diesel');
	});

	it('parses "1 barrel crude oil"', () => {
		const r = converter.parse('1 barrel crude oil');
		expect(r.ok && r.query.unit_id).toBe('barrel');
		expect(r.ok && r.query.fuel_id).toBe('crude-oil');
	});

	it('parses "1 m3 natural gas" (m3 alias for cubic metre)', () => {
		const r = converter.parse('1 m3 natural gas');
		expect(r.ok && r.query.unit_id).toBe('cubic_meter');
		expect(r.ok && r.query.fuel_id).toBe('natural-gas');
	});
});

describe('§13.2 parser — comma decimal & number formats', () => {
	it('parses "1,5 MJ" (EU comma decimal) as value 1.5', () => {
		const r = converter.parse('1,5 MJ');
		expect(r.ok && r.query.value).toBe('1.5');
		expect(r.ok && r.query.unit_id).toBe('megajoule');
	});

	it(
		'documents a parser ambiguity: "0,835" (3 digits after a lone comma) is read as ' +
			'the THOUSANDS-GROUPED integer 835, not the decimal 0.835 (normalizeNumber heuristic ' +
			'cannot distinguish "decimal fraction with exactly 3 digits" from "3-digit thousands ' +
			'group" when the leading group has <=3 digits) — see final report',
		() => {
			const r = converter.parse('0,835 kg');
			// Pinned to ACTUAL behaviour, not the (arguably more intuitive) 0.835 reading.
			// A European user typing a density like "0,835 kg/L" as a bare number would be
			// misread; this is a genuine minor ambiguity in normalizeNumber, not a bug fix
			// made here (tests/** is the only path the Test agent may touch).
			expect(r.ok && r.query.value).toBe('0835');
		}
	);

	it('parses "1,5" (2-digit fraction) correctly as the decimal 1.5, not a thousands group', () => {
		const r = converter.parse('1,5 kg');
		expect(r.ok && r.query.value).toBe('1.5');
	});
});

describe('§13.2 parser — case variants', () => {
	it('"1 KWH" (all caps) resolves via case-insensitive alias match', () => {
		const r = converter.parse('1 KWH');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('"1 kwh" (all lowercase) resolves the same as "1 kWh"', () => {
		const r = converter.parse('1 kwh');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('"1 Kwh" (mixed case) resolves the same', () => {
		const r = converter.parse('1 Kwh');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('symbol "MJ" is distinguished from case-insensitive alias matching (still resolves)', () => {
		const r = converter.parse('1 MJ');
		expect(r.ok && r.query.unit_id).toBe('megajoule');
	});
});

describe('§13.2 parser — German aliases (real catalog)', () => {
	it('parses "1 liter benzin" (gasoline)', () => {
		const r = converter.parse('1 liter benzin');
		expect(r.ok && r.query.fuel_id).toBe('gasoline');
		expect(r.ok && r.query.unit_id).toBe('liter');
	});

	it('parses "1 kg holzpellets" (wood pellets)', () => {
		const r = converter.parse('1 kg holzpellets');
		expect(r.ok && r.query.fuel_id).toBe('wood-pellets');
	});

	it('parses "1 kg erdgas" via the German natural-gas alias', () => {
		const r = converter.parse('1 kg erdgas');
		expect(r.ok && r.query.fuel_id).toBe('natural-gas');
	});

	it('parses "1 kg wasserstoff" via the German hydrogen alias', () => {
		const r = converter.parse('1 kg wasserstoff');
		expect(r.ok && r.query.fuel_id).toBe('hydrogen');
	});

	it('parses "1 kg heizöl" via the German heating-oil alias', () => {
		const r = converter.parse('1 kg heizöl');
		expect(r.ok && r.query.fuel_id).toBe('heating-oil');
	});
});

describe('§13.2 parser — unknown unit -> structured error with suggestions', () => {
	it('"1 kilowaty" (typo) yields unknown_unit with a suggestion', () => {
		const r = converter.parse('1 kilowaty');
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe('unknown_unit');
			expect(r.error.suggestions?.length ?? 0).toBeGreaterThan(0);
		}
	});

	it('a completely nonsensical unit token yields unknown_unit (possibly empty suggestions, never a crash)', () => {
		const r = converter.parse('1 xyzzyplugh');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('unknown_unit');
	});
});

describe('§13.2 parser — missing value', () => {
	it('a unit with no leading number yields missing_value', () => {
		const r = converter.parse('kWh');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('missing_value');
	});

	it('empty input yields empty_input', () => {
		const r = converter.parse('');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('empty_input');
	});
});

describe('§13.2 parser — ambiguous token "1 ton ..." lists interpretations', () => {
	it('"1 ton" alone lists all three tonne/short_ton/long_ton interpretations', () => {
		const r = converter.parse('1 ton');
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe('ambiguous_unit');
			const ids = (r.error.interpretations ?? []).map((i) => i.unit_id);
			expect(ids).toEqual(expect.arrayContaining(['tonne', 'short_ton', 'long_ton']));
			expect(ids).toHaveLength(3);
		}
	});

	it('each interpretation carries a distinguishing note', () => {
		const r = converter.parse('1 ton');
		if (!r.ok) {
			for (const interp of r.error.interpretations ?? []) {
				expect(
					interp.note && interp.note.length,
					`interpretation ${interp.unit_id}`
				).toBeGreaterThan(0);
			}
		}
	});
});

describe('§13.2 parser — whitespace robustness', () => {
	it('leading/trailing whitespace is trimmed', () => {
		const r = converter.parse('   1 kWh   ');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
		expect(r.ok && r.query.value).toBe('1');
	});

	it('multiple internal spaces between value and unit are tolerated', () => {
		const r = converter.parse('1     kWh');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('a tab character between value and unit is tolerated', () => {
		const r = converter.parse('1\tkWh');
		expect(r.ok && r.query.unit_id).toBe('kilowatt_hour');
	});

	it('whitespace-only input is treated as empty, not a crash', () => {
		const r = converter.parse('     ');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe('empty_input');
	});
});
