/**
 * The guided converter: a handful of task-specific forms that each compose a
 * query in the engine's own text grammar ("10 L diesel", "5 kW for 3 h").
 *
 * The forms never compute anything themselves. They build the same text a
 * reader could have typed, so both modes share one parser, one engine, one
 * URL (`?q=`) and one set of guards — the guided mode cannot answer anything
 * the text mode would refuse. `stateFromQuery` goes the other way, so a shared
 * link opens with its fields filled in; a query the forms cannot express
 * (an efficiency, a target with a duration…) returns undefined and the UI
 * falls back to the text mode rather than dropping part of the question.
 */

import type {
	ConversionResultSet,
	Dimension,
	Fuel,
	ParsedQuery,
	ParseError,
	Unit
} from '#lib/conversion/types.js';

export type GuidedTask = 'units' | 'fuel' | 'electricity' | 'power' | 'cost';

export const GUIDED_TASKS: readonly { id: GuidedTask; label: string; blurb: string }[] = [
	{ id: 'units', label: 'Units', blurb: 'Energy, power, mass, volume — one unit into others.' },
	{ id: 'fuel', label: 'Fuel', blurb: 'An amount of fuel → its energy, mass and CO₂.' },
	{
		id: 'electricity',
		label: 'Electricity',
		blurb: 'Grid electricity → CO₂ for a region and year.'
	},
	{ id: 'power', label: 'Power × time', blurb: 'kW running for some hours → kWh.' },
	{ id: 'cost', label: 'Cost', blurb: 'An amount at the price you pay.' }
];

export interface GuidedState {
	task: GuidedTask;
	amount: string;
	unitId: string;
	/** '' = show every result; otherwise the unit to answer in. */
	targetId: string;
	/** '' = none. */
	fuelId: string;
	durationAmount: string;
	durationUnitId: string;
	price: string;
	currency: string;
	perUnitId: string;
}

/** Currencies offered in the cost form. A label only — nothing is converted. */
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

const DEFAULTS = {
	units: blank('units', '1', 'kilowatt_hour'),
	fuel: { ...blank('fuel', '10', 'liter'), fuelId: 'diesel' },
	electricity: { ...blank('electricity', '1000', 'kilowatt_hour'), fuelId: 'electricity' },
	power: {
		...blank('power', '5', 'kilowatt'),
		durationAmount: '3',
		durationUnitId: 'hour'
	},
	cost: { ...blank('cost', '1000', 'kilowatt_hour'), price: '0.30', perUnitId: 'kilowatt_hour' }
} satisfies Record<GuidedTask, GuidedState>;

function blank(task: GuidedTask, amount: string, unitId: string): GuidedState {
	return {
		task,
		amount,
		unitId,
		targetId: '',
		fuelId: '',
		durationAmount: '',
		durationUnitId: 'hour',
		price: '',
		currency: 'EUR',
		perUnitId: ''
	};
}

/** A fresh form for a task, with an example already filled in. */
export function defaultState(task: GuidedTask): GuidedState {
	return { ...DEFAULTS[task] };
}

/** Which unit dimensions each task's "unit" field offers. */
const TASK_DIMENSIONS = {
	units: [
		'energy',
		'power',
		'mass',
		'volume',
		'time',
		'emission_mass_co2',
		'emission_mass_co2e',
		'energy_density_mass',
		'energy_density_volume',
		'emission_intensity',
		'mass_density'
	],
	fuel: ['volume', 'mass', 'energy'],
	electricity: ['energy'],
	power: ['power'],
	cost: ['energy', 'volume', 'mass']
} satisfies Record<GuidedTask, Dimension[]>;

export function unitDimensions(task: GuidedTask): Dimension[] {
	return TASK_DIMENSIONS[task];
}

/** Target units for the "show as" field: the dimensions a result can come out in. */
export function targetDimensions(task: GuidedTask, unit: Unit | undefined): Dimension[] {
	if (task === 'units') return unit ? [unit.dimension] : [];
	if (task === 'fuel')
		return ['energy', 'mass', 'volume', 'emission_mass_co2', 'emission_mass_co2e'];
	return [];
}

/** The text a unit is written as in a composed query. */
export function unitToken(unit: Unit): string {
	return unit.symbols[0] ?? unit.names[0];
}

/**
 * A typed amount the parser will accept: digits with one decimal separator,
 * a leading separator (".5") and an exponent ("1e3", as a shared link may
 * carry it).
 */
export function isAmount(text: string): boolean {
	return /^\s*-?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?\s*$/.test(text);
}

/** The engine's text entry point, injected so these helpers stay testable. */
export type ConvertText = (text: string) => ConversionResultSet | { error: ParseError };

/**
 * The units the fuel form's "Answer in" list can offer for this unit and
 * fuel: those the engine actually produces a value for. 10 kWh of diesel has
 * no litre figure (no heating value reaches back to a volume), and offering
 * it only led to a "no conversion path" row. Undefined when the engine has
 * no answer at all, so the caller keeps its full list.
 */
export function reachableTargets(
	unitId: string,
	fuelId: string,
	units: Unit[],
	fuels: Fuel[],
	convert: ConvertText
): Set<string> | undefined {
	const text = composeQuery({ ...defaultState('fuel'), unitId, fuelId }, units, fuels);
	if (!text) return undefined;
	const out = convert(text);
	if ('error' in out) return undefined;
	return new Set(
		out.groups.flatMap((g) => g.results.filter((r) => r.value !== null).map((r) => r.unit_id))
	);
}

/**
 * The per-units the cost form's "Per" list can offer: those a price can be
 * applied to for this amount unit and fuel. A price per ft³ of an amount in
 * kWh has no path and came back as "context required".
 */
export function priceablePerUnits(
	unitId: string,
	fuelId: string,
	currency: string,
	candidates: Unit[],
	units: Unit[],
	fuels: Fuel[],
	convert: ConvertText
): Unit[] {
	return candidates.filter((per) => {
		const text = composeQuery(
			{ ...defaultState('cost'), unitId, fuelId, currency, price: '1', perUnitId: per.id },
			units,
			fuels
		);
		if (!text) return false;
		const out = convert(text);
		if ('error' in out) return false;
		return out.groups.some((g) => g.key === 'cost' && g.results.some((r) => r.value !== null));
	});
}

/**
 * The query a filled-in form stands for, or undefined while the form is still
 * incomplete. Never fills a gap with a default: an empty price is no price.
 */
export function composeQuery(s: GuidedState, units: Unit[], fuels: Fuel[]): string | undefined {
	const unit = units.find((u) => u.id === s.unitId);
	if (!unit || !isAmount(s.amount)) return undefined;
	const amount = s.amount.trim();
	const head = `${amount} ${unitToken(unit)}`;
	const target = units.find((u) => u.id === s.targetId);
	const fuel = fuels.find((f) => f.id === s.fuelId);

	switch (s.task) {
		case 'units':
			return target ? `${head} to ${unitToken(target)}` : head;
		case 'fuel': {
			if (!fuel) return undefined;
			const base = `${head} ${fuel.names[0]}`;
			return target ? `${base} to ${unitToken(target)}` : base;
		}
		case 'electricity':
			return `${head} electricity`;
		case 'power': {
			const time = units.find((u) => u.id === s.durationUnitId);
			if (!time || !isAmount(s.durationAmount)) return undefined;
			return `${head} for ${s.durationAmount.trim()} ${unitToken(time)}`;
		}
		case 'cost': {
			const per = units.find((u) => u.id === s.perUnitId);
			if (!per || !isAmount(s.price) || !s.currency.trim()) return undefined;
			const base = fuel ? `${head} ${fuel.names[0]}` : head;
			return `${base} at ${s.price.trim()} ${s.currency.trim()}/${unitToken(per)}`;
		}
	}
}

/**
 * The form that reproduces a parsed query, or undefined when no form can say
 * all of it. Losing part of a shared question would answer a different one.
 */
export function stateFromQuery(q: ParsedQuery): GuidedState | undefined {
	if (q.efficiency) return undefined;
	const base = blank('units', q.value, q.unit_id);
	// "5 kg diesel to kg" asks for the input unit itself; the target lists
	// leave it out, so keeping it would show a blank select.
	const targetId = q.target_unit_id === q.unit_id ? '' : (q.target_unit_id ?? '');

	if (q.price) {
		if (q.time || q.target_unit_id) return undefined;
		return {
			...base,
			task: 'cost',
			fuelId: q.fuel_id ?? '',
			price: q.price.amount,
			currency: q.price.currency,
			perUnitId: q.price.per_unit_id
		};
	}
	if (q.time) {
		if (q.fuel_id || q.target_unit_id || q.dimension !== 'power') return undefined;
		return {
			...base,
			task: 'power',
			durationAmount: q.time.value,
			durationUnitId: q.time.unit_id
		};
	}
	if (q.fuel_id === 'electricity') {
		if (q.target_unit_id || q.dimension !== 'energy') return undefined;
		return { ...base, task: 'electricity', fuelId: 'electricity' };
	}
	if (q.fuel_id) {
		if (!unitDimensions('fuel').includes(q.dimension)) return undefined;
		return { ...base, task: 'fuel', fuelId: q.fuel_id, targetId };
	}
	return { ...base, task: 'units', targetId };
}
