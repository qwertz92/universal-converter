/**
 * Pinned units ("iterate mode"): a bare number becomes a complete query.
 *
 * The line this must not cross is the tool assuming a unit nobody gave. A pin
 * is the user giving it once — so the tests below check that a pin only ever
 * FILLS A GAP and never overrides what was actually typed.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { allUnits } from '$lib/ui/engine';
import { applyPin, decodePin, encodePin, type Pin } from '$lib/ui/pin';

const converter = getConverter();
const units = allUnits();
const parse = (text: string) => converter.parse(text);
const apply = (text: string, pin: Parameters<typeof applyPin>[1]) =>
	applyPin(text, pin, parse, units);

describe('applyPin fills the gap', () => {
	it('a bare number gets the pinned unit', () => {
		const r = apply('5', { from: 'kilowatt_hour' });
		expect(r.text).toBe('5 kWh');
		expect(r.usedFrom).toBe(true);
	});

	it('decimals, commas and signs still count as a bare number', () => {
		expect(apply('0.5', { from: 'liter' }).text).toBe('0.5 L');
		expect(apply('1,5', { from: 'liter' }).text).toBe('1,5 L');
		expect(apply('-3', { from: 'liter' }).text).toBe('-3 L');
	});

	it('a pinned target is appended when the query has none', () => {
		const r = apply('5 kWh', { to: 'megajoule' });
		expect(r.text).toBe('5 kWh to MJ');
		expect(r.usedTo).toBe(true);
	});

	it('both pins together turn "5" into a full conversion', () => {
		const r = apply('5', { from: 'kilowatt_hour', to: 'megajoule' });
		expect(r.text).toBe('5 kWh to MJ');
		expect(r.usedFrom).toBe(true);
		expect(r.usedTo).toBe(true);
	});
});

describe('applyPin never overrides what was typed', () => {
	it('an explicit unit wins over the pinned unit', () => {
		const r = apply('5 MJ', { from: 'kilowatt_hour' });
		expect(r.text).toBe('5 MJ');
		expect(r.usedFrom).toBe(false);
	});

	it('an explicit target wins over the pinned target', () => {
		const r = apply('5 kWh to BTU', { to: 'megajoule' });
		expect(r.text).toBe('5 kWh to BTU');
		expect(r.usedTo).toBe(false);
	});

	it('a material query is left intact', () => {
		const r = apply('10 L diesel', { from: 'kilowatt_hour' });
		expect(r.text).toBe('10 L diesel');
		expect(r.usedFrom).toBe(false);
	});

	it('a query with a word in it keeps its own error rather than being completed', () => {
		// "5 flurbs" is an unknown unit, not a bare number — appending the pin
		// would bury the real problem.
		const r = apply('5 flurbs', { from: 'kilowatt_hour' });
		expect(r.text).toBe('5 flurbs');
		expect(r.usedFrom).toBe(false);
	});

	it('never pins a unit onto itself', () => {
		const r = apply('5 kWh', { to: 'kilowatt_hour' });
		expect(r.text).toBe('5 kWh');
		expect(r.usedTo).toBe(false);
	});

	it('an empty query stays empty', () => {
		expect(apply('', { from: 'kilowatt_hour' }).text).toBe('');
	});

	it('no pin means no change', () => {
		expect(apply('5', {}).text).toBe('5');
	});
});

describe('pins survive a URL round-trip', () => {
	it.each<[Pin, string]>([
		[{ from: 'kilowatt_hour' }, 'kWh'],
		[{ to: 'megajoule' }, '>MJ'],
		[{ from: 'kilowatt_hour', to: 'megajoule' }, 'kWh>MJ']
	])('%o encodes to %s and back', (pin, encoded) => {
		expect(encodePin(pin, units)).toBe(encoded);
		expect(decodePin(encoded, units)).toEqual({ from: pin.from, to: pin.to });
	});

	it('an unknown or ambiguous symbol in a link is dropped, not guessed', () => {
		expect(decodePin('flurbs', units)).toEqual({});
		// "ton" is ambiguous in this catalog and must not resolve silently.
		expect(decodePin('ton', units)).toEqual({});
	});

	it('an empty pin encodes to nothing', () => {
		expect(encodePin({}, units)).toBe('');
		expect(decodePin(null, units)).toEqual({});
		expect(decodePin('', units)).toEqual({});
	});
});

describe('the pinned query actually converts', () => {
	it('"5" with kWh>MJ answers 18 MJ', () => {
		const { text } = apply('5', { from: 'kilowatt_hour', to: 'megajoule' });
		const out = converter.convertText(text);
		if ('error' in out) throw new Error('pinned query failed to parse');
		const row = out.groups.flatMap((g) => g.results).find((r) => r.is_target);
		expect(row?.raw).toBe('18');
	});
});
