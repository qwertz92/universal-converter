/**
 * The live "what did you just type?" layer behind the converter input (v0.3).
 * These are the sentences a first-time visitor reads while typing, so they are
 * asserted as carefully as the numbers are.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { allFuels, allUnits } from '$lib/ui/engine';
import { describeQuery, starterUnits, suggestCompletions } from '$lib/ui/interpretation';

const converter = getConverter();
const units = allUnits();
const fuels = allFuels();
const parse = (text: string) => converter.parse(text);

const describe_ = (text: string) => describeQuery(text, parse, units);

describe('describeQuery', () => {
	it('an empty field teaches the shape instead of staying silent', () => {
		const d = describe_('');
		expect(d.status).toBe('empty');
		expect(d.hint).toContain('10 L diesel');
	});

	it('a bare value says the unit is required and never guessed', () => {
		const d = describe_('5');
		expect(d.status).toBe('incomplete');
		expect(d.errorKind).toBe('no_unit');
		expect(d.hint).toMatch(/never guessed/i);
	});

	it('a recognised unit is echoed with its symbol, full name and dimension', () => {
		const d = describe_('5 kwh');
		expect(d.status).toBe('ok');
		expect(d.unit).toEqual({
			id: 'kilowatt_hour',
			symbol: 'kWh',
			name: 'kilowatt hour',
			dimension: 'Energy'
		});
		expect(d.message).toContain('5 kWh (kilowatt hour)');
	});

	it('the material is named back to the user', () => {
		const d = describe_('10 L diesel');
		expect(d.status).toBe('ok');
		expect(d.fuel?.id).toBe('diesel');
		expect(d.message).toContain('of diesel');
	});

	it('a target is shown as an arrow, so the direction is unambiguous', () => {
		const d = describe_('5 kWh to MJ');
		expect(d.target?.symbol).toBe('MJ');
		expect(d.message).toContain('→ MJ (megajoule)');
	});

	it('a duration is echoed too', () => {
		const d = describe_('5 kW for 3 h');
		expect(d.duration).toBe('3 h');
		expect(d.message).toContain('over 3 h');
	});

	it('an out-of-scope quantity is reported as unsupported, not as a typo', () => {
		const d = describe_('20 °C');
		expect(d.status).toBe('unsupported');
		expect(`${d.message} ${d.hint}`).toMatch(/temperature/i);
	});

	it('never invents a unit for an unfinished query', () => {
		expect(describe_('5 k').status).not.toBe('ok');
		expect(describe_('5 k').unit).toBeUndefined();
	});
});

describe('suggestCompletions', () => {
	it('completes the unit token being typed', () => {
		const s = suggestCompletions('5 kw', units, fuels);
		expect(s.token).toBe('kw');
		const ids = s.items.map((i) => i.id);
		expect(ids).toContain('kilowatt');
		expect(ids).toContain('kilowatt_hour');
	});

	it('applying a completion rewrites only the token under the cursor', () => {
		const s = suggestCompletions('5 kw', units, fuels);
		const kwh = s.items.find((i) => i.id === 'kilowatt_hour');
		expect(kwh?.apply).toBe('5 kWh');
	});

	it('keeps a value glued to its unit ("5kw" → "5 kWh")', () => {
		const s = suggestCompletions('5kw', units, fuels);
		const kwh = s.items.find((i) => i.id === 'kilowatt_hour');
		expect(kwh?.apply).toBe('5 kWh');
	});

	it('completes a material after a unit', () => {
		const s = suggestCompletions('10 L dies', units, fuels);
		const diesel = s.items.find((i) => i.kind === 'fuel' && i.id === 'diesel');
		expect(diesel?.apply).toBe('10 L diesel');
	});

	it('offers only units in a target slot — "to diesel" is not a conversion', () => {
		const s = suggestCompletions('10 L diesel to k', units, fuels);
		expect(s.targetSlot).toBe(true);
		expect(s.items.every((i) => i.kind === 'unit')).toBe(true);
	});

	it('stays quiet until there is a value to convert', () => {
		expect(suggestCompletions('kw', units, fuels).items).toEqual([]);
		expect(suggestCompletions('', units, fuels).items).toEqual([]);
	});

	it('stays quiet on a trailing space (nothing is being typed)', () => {
		expect(suggestCompletions('5 kWh ', units, fuels).items).toEqual([]);
	});
});

describe('starterUnits', () => {
	it('every starter chip resolves to a unit that actually ships', () => {
		const starters = starterUnits(units);
		expect(starters.length).toBeGreaterThanOrEqual(6);
		const ids = new Set(units.map((u) => u.id));
		for (const u of starters) expect(ids.has(u.id)).toBe(true);
	});

	it('covers more than one dimension, so the choice teaches the model', () => {
		const dims = new Set(starterUnits(units).map((u) => u.dimension));
		expect(dims.size).toBeGreaterThanOrEqual(3);
	});
});
