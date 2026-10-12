/**
 * The guided forms build the same text a reader could type. If a composed
 * query parsed as a different unit or fuel than the one picked in the form,
 * the form would silently answer a different question — so every unit and
 * every fuel in the catalog is round-tripped here.
 */

import { describe, expect, it } from 'vitest';
import { getConverter, loadDataBundle } from '#lib/index.js';
import {
	answerableTargets,
	composeQuery,
	defaultState,
	GUIDED_TASKS,
	isAmount,
	priceablePerUnits,
	stateFromQuery,
	unitDimensions
} from '#lib/ui/guided.js';
import { nextRadioIndex } from '#lib/ui/radio-keys.js';

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

	it('a target equal to the unit is dropped, not left as a blank select', () => {
		expect(stateFromQuery(parse('5 kg diesel to kg'))?.targetId).toBe('');
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

describe('the fuel form offers exactly the targets the engine can answer', () => {
	const convert = (t: string) => converter.convertText(t);
	const candidates = units.filter((u) =>
		['energy', 'mass', 'volume', 'emission_mass_co2', 'emission_mass_co2e'].includes(u.dimension)
	);
	const resolves = (text: string) => {
		const out = converter.convertText(text);
		return !('error' in out) && out.target?.resolved === true;
	};
	it('offers a target if and only if asking for it gives a number', () => {
		for (const [unitId, fuelId] of [
			['kilowatt_hour', 'diesel'],
			['liter', 'diesel'],
			['kilogram', 'natural-gas']
		] as const) {
			const offered = new Set(
				answerableTargets(unitId, fuelId, candidates, units, fuels, convert).map((u) => u.id)
			);
			const unit = units.find((u) => u.id === unitId)!;
			const fuel = fuels.find((f) => f.id === fuelId)!;
			for (const c of candidates) {
				const asked = resolves(`10 ${unit.symbols[0]} ${fuel.names[0]} to ${c.symbols[0]}`);
				expect(offered.has(c.id), `${unitId} ${fuelId} → ${c.id}`).toBe(asked);
			}
		}
	});
	it('10 L of diesel can be answered in pounds and therms, not only the default list', () => {
		const ids = answerableTargets('liter', 'diesel', candidates, units, fuels, convert).map(
			(u) => u.id
		);
		expect(ids).toContain('pound');
		expect(ids).toContain('therm');
	});
	it('10 kWh of diesel has no litre figure', () => {
		const ids = answerableTargets('kilowatt_hour', 'diesel', candidates, units, fuels, convert).map(
			(u) => u.id
		);
		expect(ids).not.toContain('liter');
	});
});

describe('the cost form offers only per-units a price can be applied to', () => {
	const convert = (t: string) => converter.convertText(t);
	const candidates = units.filter((u) => ['energy', 'volume', 'mass'].includes(u.dimension));
	it('every offered per-unit yields a cost', () => {
		const offered = priceablePerUnits(
			'kilowatt_hour',
			'',
			'EUR',
			candidates,
			units,
			fuels,
			convert
		);
		expect(offered.map((u) => u.id)).toContain('kilowatt_hour');
		for (const u of offered) {
			const out = converter.convertText(`1000 kWh at 0.30 EUR/${u.symbols[0]}`);
			if ('error' in out) throw new Error(out.error.message);
			const cost = out.groups.find((g) => g.key === 'cost');
			expect(
				cost?.results.some((r) => r.value !== null),
				u.id
			).toBe(true);
		}
		expect(offered.map((u) => u.id)).not.toContain('cubic_foot');
	});
});

describe('amounts the parser accepts are amounts in the form', () => {
	it.each(['1e3', '2.5E-2', '.5', '1,5', '1000'])('%s', (t) => {
		expect(isAmount(t)).toBe(true);
	});
	it.each(['abc', '1e', '--1', ''])('not %s', (t) => {
		expect(isAmount(t)).toBe(false);
	});
});

describe('arrow keys move through a radio group', () => {
	it.each([
		['ArrowRight', 0, 1],
		['ArrowDown', 4, 0],
		['ArrowLeft', 0, 4],
		['ArrowUp', 2, 1],
		['Home', 3, 0],
		['End', 1, 4]
	] as const)('%s from %i → %i', (key, from, to) => {
		expect(nextRadioIndex(key, from, 5)).toBe(to);
	});
	it('other keys do nothing', () => {
		expect(nextRadioIndex('a', 1, 5)).toBeUndefined();
	});
});
