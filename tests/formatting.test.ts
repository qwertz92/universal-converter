import { describe, expect, it } from 'vitest';
import {
	formatRange,
	formatValue,
	roundToSigFigs,
	sigFigsFor,
	usesApproxMarker,
	withThousandsSeparators
} from '$lib/formatting/numbers';

describe('sig-fig policy keyed off exactness (rulebook §C.7)', () => {
	it('exact/standard_definition get up to 6 sig figs (default)', () => {
		expect(sigFigsFor('exact')).toBe(6);
		expect(sigFigsFor('standard_definition')).toBe(6);
	});
	it('source_based caps at 4, estimated at 3', () => {
		expect(sigFigsFor('source_based')).toBe(4);
		expect(sigFigsFor('estimated')).toBe(3);
	});
});

describe('~ marker discipline (rulebook §C.7 rule 3)', () => {
	it('only estimated/region_year_specific carry ~', () => {
		expect(usesApproxMarker('estimated')).toBe(true);
		expect(usesApproxMarker('region_year_specific')).toBe(true);
		expect(usesApproxMarker('exact')).toBe(false);
		expect(usesApproxMarker('source_based')).toBe(false);
	});

	it('exact values never get a ~ prefix', () => {
		expect(formatValue('3.6', 'exact')).toBe('3.6');
	});

	it('estimates get a ~ prefix and a 3-sig-fig cap', () => {
		expect(formatValue('35.1234', 'estimated')).toBe('~35.1');
	});
});

describe('rounding (round-half-to-even)', () => {
	it('rounds 2.5 → 2 and 3.5 → 4 at 1 sig fig', () => {
		expect(roundToSigFigs('2.5', 1)).toBe('2');
		expect(roundToSigFigs('3.5', 1)).toBe('4');
	});
	it('caps source_based to 4 sig figs', () => {
		expect(formatValue('2.605123', 'source_based', { thousands: false })).toBe('2.605');
	});
});

describe('thousands separators', () => {
	it('groups the integer part', () => {
		expect(withThousandsSeparators('4186800')).toBe('4,186,800');
	});
	it('leaves the fractional part alone', () => {
		expect(withThousandsSeparators('1234.5678')).toBe('1,234.5678');
	});
});

describe('ranges (rulebook §C.7 rule 2)', () => {
	it('formats an estimated range as ~A–B', () => {
		expect(formatRange('5.6', '6.3', 'estimated')).toBe('~5.6–6.3');
	});
});
