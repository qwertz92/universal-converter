/**
 * Second round of adversarial-review fixes: places where the tool said
 * something that was not quite true.
 *
 * None of these produced a wrong NUMBER — they misdescribed a right one, which
 * for a tool whose entire proposition is traceability is the same class of
 * defect.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { formatValue } from '$lib/formatting/numbers';
import type { ConversionResult, ConversionResultSet, EngineOptions } from '$lib/conversion/types';

const converter = getConverter();

function set(input: string, options?: EngineOptions): ConversionResultSet {
	const out = converter.convertText(input, options);
	if ('error' in out) throw new Error(`"${input}" failed to parse: ${out.error.message}`);
	return out;
}

function rows(input: string, options?: EngineOptions): ConversionResult[] {
	return set(input, options).groups.flatMap((g) => g.results);
}

describe('asking for a basis a fuel does not have says so (rulebook §C.1 rule 4)', () => {
	// Lignite, crude oil and anthracite carry only an LHV. Asking for HHV
	// returned the LHV figure with a "shown alongside the default" warning —
	// implying a primary HHV figure that does not exist, and making the basis
	// toggle look broken rather than honest.
	it.each(['1 kg lignite', '1 kg anthracite', '1 kg crude oil'])(
		'%s on an HHV request states that HHV is not available',
		(query) => {
			const notAvailable = rows(query, { basis: 'hhv' }).find(
				(r) => r.category === 'energy' && r.value === null
			);
			expect(notAvailable).toBeDefined();
			expect(notAvailable!.explanation).toMatch(/not available/i);
			expect(notAvailable!.explanation).toMatch(/HHV\/GCV/);
			expect(notAvailable!.exactness).toBe('context_required');
		}
	);

	it('the LHV figure it does show is not labeled "secondary"', () => {
		// There is no primary for it to be secondary to.
		const out = set('1 kg lignite', { basis: 'hhv' });
		expect(out.warnings.some((w) => w.kind === 'basis_secondary')).toBe(false);
	});

	it('never derives the missing basis from the one it has', () => {
		const energy = rows('1 kg lignite', { basis: 'hhv' }).filter(
			(r) => r.category === 'energy' && r.raw !== null
		);
		// Every value present must come from the LHV; none may be an uplifted LHV.
		for (const r of energy) {
			expect(r.assumptions.map((a) => a.text).join(' ')).toMatch(/LHV\/NCV/);
		}
	});

	it('a fuel WITH both bases still shows the secondary one as secondary', () => {
		const out = set('1 L diesel', { basis: 'lhv' });
		expect(out.warnings.some((w) => w.kind === 'basis_secondary')).toBe(true);
		expect(rows('1 L diesel').some((r) => r.category === 'energy' && r.value === null)).toBe(false);
	});
});

describe('an exact value is never quietly rounded', () => {
	// `1234567 kWh to kWh` echoed back 1,234,570 — three off from what was
	// typed, labeled `exact`, with no `~` (correctly suppressed for exact) to
	// hint that anything had happened.
	it('an identity conversion returns the number that was typed', () => {
		const r = rows('1234567 kWh to kWh').find(
			(x) => x.category === 'energy' && x.unit_id === 'kilowatt_hour'
		);
		expect(r?.exactness).toBe('exact');
		expect(r?.value).toBe('1,234,567');
	});

	it.each([
		['1234567', 'exact', '1,234,567'],
		['3600000', 'exact', '3,600,000'],
		['0.45359237', 'exact', '0.45359237'],
		['1234567.891', 'standard_definition', '1,234,567.891']
	])('formatValue(%s, %s) keeps every digit', (value, exactness, expected) => {
		expect(formatValue(value, exactness as never)).toBe(expected);
	});

	it('still rounds a value with more precision than anyone needs', () => {
		// 1 kWh in BTU does not terminate at the engine's 40-digit precision. The
		// conversion is exact by DEFINITION; the printed decimal is not the value,
		// so it carries the marker that says so.
		const long = '3412.141633127942139845173508305108425372';
		expect(formatValue(long, 'exact')).toBe('~3,412.14');
	});

	it('an explicitly requested cap still wins over showing it in full', () => {
		// ?sig=2 on the API is a caller ASKING to be capped.
		expect(formatValue('0.45359237', 'exact', { maxExactSigFigs: 2 })).toBe('0.45');
	});

	it('non-exact levels are unaffected', () => {
		expect(formatValue('1234567', 'source_based')).toBe('1,235,000');
		expect(formatValue('1234567', 'estimated')).toBe('~1,230,000');
	});
});

describe('one missing input is asked for once', () => {
	// `5 kW to MJ` produces a context row for the requested target AND for kWh,
	// both missing a duration; `1 kWh electricity to kg CO2e` does the same for
	// region/year. Both rows are correct and must stay (§C.8), but the engine
	// must make it possible for the UI to render ONE control — which it does by
	// leaving the rows distinguishable and ordered.
	it('5 kW to MJ still answers the requested target rather than dropping it', () => {
		const contextRows = rows('5 kW to MJ').filter((r) => r.exactness === 'context_required');
		expect(contextRows.length).toBeGreaterThan(0);
		expect(contextRows.some((r) => r.unit_id === 'megajoule')).toBe(true);
		for (const r of contextRows) expect(r.missing).toContain('time');
	});

	it('1 kWh electricity to kg CO2e keeps its requested target too', () => {
		const contextRows = rows('1 kWh electricity to kg CO2e').filter(
			(r) => r.exactness === 'context_required' && r.missing?.includes('region')
		);
		expect(contextRows.some((r) => r.unit_id === 'kilogram_co2e')).toBe(true);
	});
});

describe('a negative amount is a reduction, not a removal', () => {
	// Negative inputs are deliberately allowed — "5 litres less diesel" is a real
	// savings question — but an unlabeled "~-2.54 kg CO2" reads as sequestration,
	// which is a far stronger claim than a saving and the kind of figure that
	// ends up in a report.
	it('says so, in the warnings', () => {
		const out = set('-5 L diesel');
		const w = out.warnings.find((x) => x.kind === 'negative_amount');
		expect(w).toBeDefined();
		expect(w!.text).toMatch(/reduction/i);
		expect(w!.text).toMatch(/not a removal/i);
		expect(w!.severity).toBe('caution');
	});

	it('still computes the figures rather than refusing them', () => {
		const mass = rows('-5 L diesel').find((r) => r.category === 'mass' && r.unit_id === 'kilogram');
		expect(Number(mass?.raw)).toBeCloseTo(-4.161805, 5);
	});

	it('a positive amount carries no such warning', () => {
		expect(set('5 L diesel').warnings.some((w) => w.kind === 'negative_amount')).toBe(false);
		expect(set('0 kWh').warnings.some((w) => w.kind === 'negative_amount')).toBe(false);
	});
});

describe('the lossless budget is drawn between typed and computed', () => {
	// 15 digits left `1234567890123456 kWh to kWh` echoing 1,234,570,000,000,000
	// — the defect the rule exists to prevent, one digit past its edge.
	it('a 16-digit typed value comes back whole', () => {
		expect(formatValue('1234567890123456', 'exact')).toBe('1,234,567,890,123,456');
	});

	it('a 40-digit non-terminating conversion is capped, and says so', () => {
		expect(formatValue('3412.141633127942139845173508305108425372', 'exact')).toBe('~3,412.14');
	});

	it('a value that survives the cap unchanged carries no marker', () => {
		expect(formatValue('3600000', 'exact')).toBe('3,600,000');
		expect(formatValue('1.5', 'exact')).toBe('1.5');
	});

	it('an explicitly requested cap is not marked as an approximation', () => {
		// The caller asked to be rounded; telling them it was rounded is noise.
		expect(formatValue('0.45359237', 'exact', { maxExactSigFigs: 2 })).toBe('0.45');
	});
});

describe('the calculation path is verified by DOING the arithmetic', () => {
	// The previous test asserted the formula "contains 159 L" — which is why
	// `159 L × 9.905 kWh/L = 5,669 MJ` survived it. 159 × 9.905 is 1,575, not
	// 5,669; the missing step was kWh→MJ. This one multiplies the line out.
	const NUM = String.raw`([\d,]+(?:\.\d+)?)`;
	const parse = (s: string) => Number(s.replace(/,/g, ''));

	it.each([
		'1 bbl diesel',
		'1 gal diesel',
		'1 L diesel',
		'1 m3 natural gas',
		'1 t coking coal',
		'1 lb hard coal',
		'1 g lignite',
		'1 L gas oil',
		'10 L ethanol',
		'1 kg hydrogen',
		'1 L lpg',
		'1 tonne wood pellets'
	])('%s: every product in the path computes', (query) => {
		const row = rows(query).find((r) => r.category === 'energy' && r.formula);
		expect(row?.formula, query).toBeDefined();
		// "<amount> <unit> (…) × <factor> <unit>/<unit> [basis] = <a> <u> [= <b> <u>]"
		// Greedy middle, so the `×` taken is the one before the FACTOR — a density
		// step writes its own `×` inside the parentheses ("1 L gas oil × density").
		const m = row!.formula!.match(
			new RegExp(String.raw`^${NUM}\s.*×\s*${NUM}\s\S+\s\[[^\]]+\]\s=\s*~?${NUM}`)
		);
		expect(m, `unparseable path: ${row!.formula}`).not.toBeNull();
		const [, amount, factor, product] = m!;
		const expected = parse(amount) * parse(factor);
		const shown = parse(product);
		// Both sides are display-rounded, so allow the rounding but not a unit slip.
		expect(Math.abs(shown - expected) / expected, row!.formula).toBeLessThan(0.01);
	});
});

describe('an exact value that had to be rounded says so', () => {
	it('1 kWh to BTU carries the marker its digits require', () => {
		const btu = rows('1 kWh to BTU').find((r) => r.unit_id === 'btu');
		expect(btu?.value).toMatch(/^~/);
		expect(btu?.exactness).toBe('standard_definition');
	});

	it('a conversion that lands whole carries none', () => {
		const mj = rows('1 kWh to MJ').find((r) => r.unit_id === 'megajoule');
		expect(mj?.value).toBe('3.6');
	});
});
