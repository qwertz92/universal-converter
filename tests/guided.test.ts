/**
 * The guided forms build the same text a reader could type. If a composed
 * query parsed as a different unit or fuel than the one picked in the form,
 * the form would silently answer a different question — so every unit and
 * every fuel in the catalog is round-tripped here.
 */

import { describe, expect, it } from 'vitest';
import { getConverter, loadDataBundle } from '$lib/index';
import {
	composeQuery,
	defaultState,
	GUIDED_TASKS,
	stateFromQuery,
	unitDimensions
} from '$lib/ui/guided';

const converter = getConverter();
const { units, fuels } = loadDataBundle();

function parse(text: string) {
	const out = converter.parse(text);
	if (!out.ok) throw new Error(`"${text}" did not parse: ${out.error.message}`);
	return out.query;
}

describe('every unit the units form offers parses back as that unit', () => {
	const offered = units.filter((u) => unitDimensions('units').includes(u.dimension));
	it.each(offered.map((u) => [u.id, u]))('%s', (_id, unit) => {
		const text = composeQuery({ ...defaultState('units'), unitId: unit.id }, units, fuels);
		expect(text).toBeDefined();
		expect(parse(text!).unit_id).toBe(unit.id);
	});
});

describe('every fuel the fuel form offers parses back as that fuel', () => {
	const offered = fuels.filter((f) => f.id !== 'electricity');
	it.each(offered.map((f) => [f.id, f]))('%s', (_id, fuel) => {
		const unitId = fuel.category === 'gas' ? 'cubic_meter' : 'kilogram';
		const text = composeQuery({ ...defaultState('fuel'), unitId, fuelId: fuel.id }, units, fuels);
		const q = parse(text!);
		expect(q.fuel_id).toBe(fuel.id);
		expect(q.unit_id).toBe(unitId);
	});
});

describe('every task default composes, parses and converts', () => {
	it.each(GUIDED_TASKS.map((t) => [t.id]))('%s', (task) => {
		const text = composeQuery(defaultState(task), units, fuels);
		expect(text).toBeDefined();
		const out = converter.convertText(text!);
		expect('error' in out, JSON.stringify(out)).toBe(false);
	});
});

describe('a shared query opens the form that can say all of it', () => {
	it.each([
		['10 L diesel', 'fuel'],
		['10 L diesel to kg', 'fuel'],
		['1 kWh to MJ', 'units'],
		['1000 kWh electricity', 'electricity'],
		['5 kW for 3 h', 'power'],
		['1000 kWh at 0.32 EUR/kWh', 'cost'],
		['100 m³ natural gas at 0.09 EUR/kWh', 'cost']
	])('%s → %s, and composes back to the same question', (text, task) => {
		const state = stateFromQuery(parse(text));
		if (!state) throw new Error(`"${text}" opened no form`);
		expect(state.task).toBe(task);
		const again = parse(composeQuery(state, units, fuels)!);
		const original = parse(text);
		expect(again.unit_id).toBe(original.unit_id);
		expect(again.value).toBe(original.value);
		expect(again.fuel_id).toBe(original.fuel_id);
		expect(again.target_unit_id).toBe(original.target_unit_id);
		expect(again.time?.unit_id).toBe(original.time?.unit_id);
		expect(again.price?.amount).toBe(original.price?.amount);
		expect(again.price?.per_unit_id).toBe(original.price?.per_unit_id);
	});

	it.each(['100 kWh at 85% efficiency', '100 kWh at 3.5 COP'])(
		'%s has no form that can hold it → undefined (text mode)',
		(text) => {
			expect(stateFromQuery(parse(text))).toBeUndefined();
		}
	);
});

describe('an incomplete form composes nothing rather than a guess', () => {
	it('no amount', () => {
		expect(composeQuery({ ...defaultState('units'), amount: '' }, units, fuels)).toBeUndefined();
	});
	it('not a number', () => {
		expect(composeQuery({ ...defaultState('units'), amount: 'abc' }, units, fuels)).toBeUndefined();
	});
	it('fuel form without a fuel', () => {
		expect(composeQuery({ ...defaultState('fuel'), fuelId: '' }, units, fuels)).toBeUndefined();
	});
	it('cost form without a price', () => {
		expect(composeQuery({ ...defaultState('cost'), price: '' }, units, fuels)).toBeUndefined();
	});
});
