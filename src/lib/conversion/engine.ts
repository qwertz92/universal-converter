/**
 * The conversion engine (spec §3, rulebook §B/§C). `createConverter(dataBundle)`
 * returns `{ parse, convert, convertText }`.
 *
 * Responsibilities:
 *  - dimension-internal result groups for pure units (exact / standard_definition);
 *  - fuel-equivalent + industrial-unit groups for energy inputs (rulebook §C.8);
 *  - power → context_required for the missing time (NEVER auto kW→kWh — §D.1);
 *  - power×time → energy when a time is supplied (§B.3);
 *  - CO2 ↔ CO2e → unsupported, no path (§B.2, §C.5, §D.6);
 *  - fuel pipeline: volume↔mass (density), volume/mass→energy (HV, basis-labeled),
 *    energy densities, fuel equivalents (§B.3, §C.1);
 *  - emissions pipeline: fuel → CO2 (+ CO2e only when a CO2e factor exists),
 *    biogenic CO2 separate, hydrogen combustion = 0, electricity context_required
 *    (§C.5, §C.6).
 *
 * All arithmetic is decimal.js on decimal strings; display rounding is applied
 * by the formatting layer, keyed off each result's exactness (§C.7).
 */

import Decimal from 'decimal.js';
import type {
	Assumption,
	ConversionResult,
	ConversionResultSet,
	Converter,
	DataBundle,
	Efficiency,
	EmissionFactor,
	EngineOptions,
	Exactness,
	Fuel,
	HeatingBasis,
	IllustrativeExample,
	ParsedQuery,
	ParseError,
	Price,
	Quantity,
	ResultGroupKey,
	Unit,
	Warning
} from './types';
import { UnitRegistry } from '$lib/units/registry';
import { FuelRegistry } from '$lib/fuels/registry';
import { convertWithinDimension, toBaseValue } from '$lib/units/exact-conversions';
import { parseQuery } from './parser';
import { combineExactness } from './precision';
import { ResultSetBuilder } from './result-groups';
import { formatValue, roundToSigFigs, sigFigsFor } from '$lib/formatting/numbers';
import { unitLabel } from '$lib/formatting/units';
import { step } from './formulas';
import { resolveDensity, volumeToMassKg, massToVolumeM3 } from '$lib/fuels/density';
import {
	allHeatingValues,
	amountToEnergyJ,
	basisLabel,
	energyToAmountBase,
	pickHeatingValue,
	type HeatingValueResolved
} from '$lib/fuels/heating-values';
import { isElectricity, isHydrogen } from '$lib/fuels/fuel-types';
import { CO2_CO2E_EXPLANATION, isCo2Co2eCrossing } from '$lib/emissions/co2-vs-co2e';
import { applyFactor, factorInputKind, factorUnitLabel } from '$lib/emissions/factors';
import { POLLUTANT_LABEL, SCOPE_LABEL } from '$lib/emissions/scopes';
import {
	biogenicCo2Warning,
	boeConventionWarning,
	hydrogenCombustionWarning,
	negativeAmountWarning,
	representativeValueWarning
} from './warnings';

Decimal.set({ precision: 40 });

/** A fuel amount's energy on one basis, with the resolved HV and (when the
 *  source records genuine spread) the low–high energy range in joules. */
interface EnergyForBasis {
	joules: string;
	joulesRange?: { low: string; high: string };
	hv: HeatingValueResolved;
	/** Which heating value was actually used — the caller needs this to write an
	 *  honest calculation path when a VOLUME input had to go through a per-MASS
	 *  heating value (the density step must be visible, not implied). */
	via: 'per_mass' | 'per_volume';
}

/**
 * `unit_id` for a cost row. Money is not a catalog unit — there are no exchange
 * rates in this tool and the currency is whatever label the user typed — but
 * `ConversionResult.unit_id` is required, so cost rows carry this sentinel. It
 * deliberately does not resolve in the unit registry, which is what keeps a
 * cost out of every dimension-based lookup.
 */
const CURRENCY_UNIT_ID = 'currency';

/** Dimensions the fuel pipeline can bridge between (via density / heating value). */
const BRIDGEABLE_VIA_FUEL = new Set<Unit['dimension']>(['mass', 'volume', 'energy']);

/** True for a value that is strictly below zero, tolerating a non-numeric string. */
function isNegativeValue(value: string): boolean {
	try {
		return new Decimal(value).isNegative() && !new Decimal(value).isZero();
	} catch {
		return false;
	}
}

/** Whether a dimension is a GHG mass (the thing an emissions answer is in). */
function isEmissionMass(dim: Unit['dimension']): boolean {
	return dim === 'emission_mass_co2' || dim === 'emission_mass_co2e';
}

/** Energy units to show in the "Fuel Equivalents" group for a pure energy input. */
const FUEL_EQUIVALENT_UNITS = ['toe', 'boe', 'tce'];
/** Energy units to show in the "Industrial Units" group. */
const INDUSTRIAL_UNITS = ['therm', 'mmbtu', 'quad'];
/** Primary energy display targets for a pure energy input. */
const ENERGY_DISPLAY_UNITS = [
	'joule',
	'kilojoule',
	'megajoule',
	'gigajoule',
	'kilowatt_hour',
	'megawatt_hour',
	'btu'
];

export function createConverter(data: DataBundle): Converter {
	const units = new UnitRegistry(data.units);
	const fuels = new FuelRegistry(data.fuels);
	const factorsById = new Map(data.emissionFactors.map((f) => [f.id, f]));

	function parse(text: string) {
		return parseQuery(text, units, fuels);
	}

	function convert(query: ParsedQuery, options: EngineOptions = {}): ConversionResultSet {
		// Runtime-normalise the basis: a raw JSON caller can bypass TS and any
		// unknown string would otherwise silently produce "not available" rows.
		const basis: HeatingBasis = options.basis === 'hhv' ? 'hhv' : 'lhv';
		const unit = units.get(query.unit_id);
		if (!unit) {
			// Should not happen (parser validated), but fail safe.
			return unsupportedSet(query, `Unknown unit '${query.unit_id}'.`);
		}
		const fuel = query.fuel_id ? fuels.get(query.fuel_id) : undefined;
		const target = query.target_unit_id ? units.get(query.target_unit_id) : undefined;
		// A duration written into the query ("5 kW for 3 h") is as explicit as one
		// supplied via options, and it is the one the user can actually see, so it
		// wins. Neither is ever assumed (rulebook §D.1).
		const opts: EngineOptions = { ...options, basis, time: query.time ?? options.time };

		const input: ConversionResultSet['input'] = {
			value: query.value,
			unit_id: unit.id,
			unit_label: unitLabel(unit),
			fuel_id: fuel?.id,
			fuel_label: fuel?.names[0],
			original_input: query.original_input
		};
		const builder = new ResultSetBuilder(input);
		for (const note of query.notes ?? []) {
			builder.addAssumption({ kind: 'parser_note', text: note });
		}
		// A negative amount is deliberately allowed (see tests/engine-robustness),
		// but an unlabeled "-2.54 kg CO2" reads as a removal rather than a saving.
		if (isNegativeValue(query.value)) builder.addWarning(negativeAmountWarning());

		// Route by the input unit's dimension. convert() is public API: a
		// hand-built ParsedQuery/EngineOptions can carry non-numeric strings that
		// would throw deep inside decimal.js — fail as a structured result, not
		// an exception (the parser-validated path never hits this).
		try {
			switch (unit.dimension) {
				case 'energy':
					buildEnergyGroups(builder, query.value, unit, opts);
					if (fuel) buildFuelFromEnergy(builder, query.value, unit, fuel, basis, opts);
					break;
				case 'power':
					buildPowerGroups(builder, query.value, unit, opts);
					break;
				case 'mass':
					buildMassGroups(builder, query.value, unit, opts);
					if (fuel) buildFuelFromMass(builder, query.value, unit, fuel, basis, opts);
					else builder.add(contextPickMaterial('energy', unit));
					break;
				case 'volume':
					buildVolumeGroups(builder, query.value, unit, opts);
					if (fuel) buildFuelFromVolume(builder, query.value, unit, fuel, basis, opts);
					else builder.add(contextPickMaterial('energy', unit));
					break;
				case 'time':
					buildTimeGroups(builder, query.value, unit, opts);
					break;
				default:
					// Pseudo-dimensions: show the value in its own group; no bridging.
					builder.add(
						simpleResult(query.value, unit, unit, groupForDimension(unit.dimension), unit.exactness)
					);
			}
			// An explicitly requested target must always be answered — or told,
			// precisely, why it cannot be (§C.8). It never replaces the other groups.
			if (target) ensureTarget(builder, query.value, unit, target, fuel, opts);
			// A price is the user's own number, so it is applied last, on top of
			// whatever the pipeline managed to produce.
			// Efficiency before price, so a cost can be asked of either the energy
			// bought or the heat delivered without the two being confused.
			if (query.efficiency) addDelivered(builder, query.efficiency, unit, opts);
			if (query.price) addCost(builder, query.price, unit);
		} catch (e) {
			return unsupportedSet(
				query,
				`Could not compute this conversion: ${e instanceof Error ? e.message : String(e)}`
			);
		}

		const set = builder.build();
		if (target) highlightTarget(set, target);
		return set;
	}

	/**
	 * Apply an appliance efficiency the USER supplied: how much of the energy
	 * bought actually reaches the room.
	 *
	 * Same licence as `addCost` — the catalog ships no efficiency table because
	 * real boilers and heat pumps vary far too widely for a default to be true of
	 * anyone, but the number on someone's own data plate is theirs. It is applied
	 * to the energy figure the pipeline produced, so `100 m³ natural gas at 85%
	 * efficiency` works through the calorific value already in hand.
	 *
	 * The input energy is deliberately NOT replaced: buying 100 kWh of gas and
	 * getting 85 kWh of heat are two different facts and both stay on screen.
	 */
	function addDelivered(
		builder: ResultSetBuilder,
		efficiency: Efficiency,
		from: Unit,
		options: EngineOptions
	): void {
		const kwh = units.get('kilowatt_hour');
		// Which unit the delivered figure appears in must not depend on bucket
		// order. Answer in the unit the reader typed when they typed an energy
		// one; otherwise in kWh, which is how heat and electricity are billed.
		const source =
			(from.dimension === 'energy' ? builder.resultFor(from.id) : undefined) ??
			builder.resultFor('kilowatt_hour') ??
			builder.findValueInDimension('energy', (id) => units.get(id));

		if (!source || source.raw === null || !kwh) {
			builder.add({
				value: null,
				raw: null,
				unit_id: kwh?.id ?? from.id,
				unit_label: kwh ? unitLabel(kwh) : unitLabel(from),
				category: 'delivered',
				exactness: 'context_required',
				explanation: `An efficiency of ${efficiency.label} applies to an amount of energy, and this query does not produce one. For a fuel, name it (e.g. "100 m³ natural gas at ${efficiency.label}") so the energy can be derived first.`,
				assumptions: [],
				warnings: [],
				source_refs: []
			});
			return;
		}

		const sourceUnit = units.get(source.unit_id) ?? kwh;
		const delivered = new Decimal(source.raw).times(efficiency.ratio);
		// The BADGE is what a reader scans, and it must not claim a provenance
		// this number does not have. EXACTNESS_ORDER deliberately ranks a user
		// assumption ABOVE source_based (the reader's own figure is exact FOR
		// THEM), so combineExactness returns source_based here — technically the
		// documented floor, but it puts a provenance claim on a figure that rests
		// on a tariff nobody sourced. A number containing the reader's own input is
		// at best a user assumption, whatever the rest of the chain was; the
		// underlying quality is named in the explanation instead.
		const underlying = source.exactness;
		const exactness: Exactness = 'user_assumption';
		const rounded = roundToSigFigs(delivered.toFixed(), sigFigsFor(exactness, options.maxSigFigs));

		builder.add({
			value: formatValue(rounded, exactness),
			raw: delivered.toFixed(),
			unit_id: sourceUnit.id,
			unit_label: unitLabel(sourceUnit),
			category: 'delivered',
			exactness,
			formula: `${source.raw} ${unitLabel(sourceUnit)} × ${efficiency.ratio} (${efficiency.label}) = ${rounded} ${unitLabel(sourceUnit)}`,
			assumptions: [
				{
					kind: 'user_input',
					text: `efficiency: your figure of ${efficiency.label} — this tool ships no efficiency table`
				}
			],
			warnings:
				efficiency.kind === 'percent' && new Decimal(efficiency.ratio).greaterThan(1)
					? [
							{
								kind: 'representative_value',
								severity: 'caution',
								text: `${efficiency.label} is above 100%. That is real for a heat pump, which moves heat rather than making it — but then the figure is a COP, and on a gross calorific value basis a condensing boiler can also read above 100%. Check which one you meant.`
							}
						]
					: [],
			source_refs: source.source_refs,
			explanation: `Of the ${source.value} ${unitLabel(sourceUnit)} going in, ${rounded} ${unitLabel(sourceUnit)} is delivered at ${efficiency.label}. The efficiency is yours, not a published one; the energy it acts on is ${underlying.replace(/_/g, ' ')}.`
		});
	}

	/**
	 * Multiply a result by a price the USER supplied.
	 *
	 * This is the one number in the whole tool that does not come from a source,
	 * and it is allowed precisely because it does not come from us either: the
	 * catalog holds no tariffs, so the rate is the reader's own figure and the
	 * cost is labeled `user_assumption`. Three things follow from that and are
	 * enforced here:
	 *
	 *  - the cost is never more exact than the quantity it rests on, so the
	 *    exactness is combined rather than taken from the price alone;
	 *  - the currency is echoed as a label and never converted — there are no
	 *    exchange rates in this tool and there will not be any;
	 *  - if the priced unit is not among the results, the answer says which unit
	 *    is missing instead of silently pricing something else. Pricing gas per
	 *    kWh when the query was in m³ works only because the fuel pipeline has
	 *    already produced the kWh row; where it has not, that is reported.
	 */
	function addCost(builder: ResultSetBuilder, price: Price, from: Unit): void {
		const perUnit = units.get(price.per_unit_id);
		if (!perUnit) return;
		const label = `${price.currency}/${unitLabel(perUnit)}`;
		const row = builder.resultFor(price.per_unit_id);

		if (!row || row.raw === null) {
			builder.add({
				value: null,
				raw: null,
				unit_id: CURRENCY_UNIT_ID,
				unit_label: price.currency,
				category: 'cost',
				exactness: 'context_required',
				explanation: `A price of ${price.amount} ${label} needs a figure in ${unitLabel(perUnit)}, and this query does not produce one${
					from.dimension === perUnit.dimension
						? '.'
						: ` — ${unitLabel(from)} is ${from.dimension}, ${unitLabel(perUnit)} is ${perUnit.dimension}. For a fuel, name it (e.g. "1 L diesel at ${price.amount} ${label}") so the energy can be derived.`
				}`,
				assumptions: [],
				warnings: [],
				source_refs: []
			});
			return;
		}

		const total = new Decimal(row.raw).times(price.amount);
		// The BADGE is what a reader scans, and it must not claim a provenance
		// this number does not have. EXACTNESS_ORDER deliberately ranks a user
		// assumption ABOVE source_based (the reader's own figure is exact FOR
		// THEM), so combineExactness returns source_based here — technically the
		// documented floor, but it puts a provenance claim on a figure that rests
		// on a tariff nobody sourced. A number containing the reader's own input is
		// at best a user assumption, whatever the rest of the chain was; the
		// underlying quality is named in the explanation instead.
		const underlying = row.exactness;
		const exactness: Exactness = 'user_assumption';
		builder.add({
			// Money is read to the cent, so this is rounded for display rather than
			// shown to the engine's full internal precision.
			value: `~${formatMoney(total)}`,
			raw: total.toFixed(),
			unit_id: CURRENCY_UNIT_ID,
			unit_label: price.currency,
			category: 'cost',
			exactness,
			formula: `${row.raw} ${unitLabel(perUnit)} × ${price.amount} ${label} = ${formatMoney(total)} ${price.currency}`,
			assumptions: [
				{
					kind: 'user_input',
					text: `price: your figure of ${price.amount} ${label} — this tool carries no tariffs`
				}
			],
			warnings: [],
			source_refs: row.source_refs,
			explanation: `${formatMoney(total)} ${price.currency} at your rate of ${price.amount} ${label}. The rate is yours, not a published figure, so this cost is only as good as it is; the quantity it multiplies is ${underlying.replace(/_/g, ' ')}.`
		});
	}

	/** Two decimals, the way money is read. */
	function formatMoney(d: Decimal): string {
		return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
	}

	/**
	 * Make sure the requested target unit is present. Same-dimension targets are
	 * simply computed (they may sit outside the default display lists — nobody
	 * would find `1 kWh to cal` otherwise). Cross-dimension targets are produced
	 * by the fuel pipeline when it can; when it cannot, we say which piece of
	 * context is missing instead of quietly omitting the answer.
	 */
	function ensureTarget(
		builder: ResultSetBuilder,
		value: string,
		from: Unit,
		target: Unit,
		fuel: Fuel | undefined,
		options: EngineOptions
	): void {
		if (builder.hasValueFor(target.id)) return;

		if (target.dimension === from.dimension) {
			builder.add(convertResult(value, from, target, primaryGroupFor(target.dimension), options));
			return;
		}

		// Power → energy: answerable exactly once a duration is given. Without one
		// the request is still ANSWERED — as a prompt in the requested unit, not
		// dropped (§C.9: silently omitting a target reads as "there is no answer").
		if (from.dimension === 'power' && target.dimension === 'energy') {
			const row = options.time
				? powerTimesTime(value, from, options.time, options, target)
				: undefined;
			builder.add(
				row ?? {
					value: null,
					raw: null,
					unit_id: target.id,
					unit_label: unitLabel(target),
					category: 'energy',
					exactness: 'context_required',
					explanation: `Power is not energy. ${unitLabel(from)} → ${unitLabel(target)} needs a duration: energy = power × time. Add one, e.g. "${value} ${unitLabel(from)} for 3 h".`,
					missing: ['time'],
					assumptions: [],
					warnings: [],
					source_refs: []
				}
			);
			return;
		}

		// The fuel pipeline emits a fixed handful of display units (kg, L, MJ,
		// kWh, GJ, BTU). A target of the same dimension as one of those rows is
		// therefore already answerable — convert the row we have rather than
		// claiming the catalog lacks data it demonstrably used.
		const bridged = bridgeFromExistingRow(builder, target, options);
		if (bridged) {
			builder.add(bridged);
			return;
		}

		const bridgeable =
			BRIDGEABLE_VIA_FUEL.has(from.dimension) && BRIDGEABLE_VIA_FUEL.has(target.dimension);
		if (bridgeable && !fuel) {
			builder.add({
				value: null,
				raw: null,
				unit_id: target.id,
				unit_label: unitLabel(target),
				category: primaryGroupFor(target.dimension),
				exactness: 'context_required',
				explanation: `${unitLabel(from)} → ${unitLabel(target)} depends on the material: a litre of diesel and a litre of water differ. Pick a fuel and this becomes answerable.`,
				missing: ['fuel'],
				assumptions: [],
				warnings: [],
				source_refs: []
			});
			return;
		}
		if (bridgeable && fuel) {
			builder.add({
				value: null,
				raw: null,
				unit_id: target.id,
				unit_label: unitLabel(target),
				category: primaryGroupFor(target.dimension),
				exactness: 'context_required',
				explanation: `Not available: the catalog has no ${from.dimension === 'mass' || target.dimension === 'mass' ? 'density' : 'heating value'} for ${fuel.names[0]} that would reach ${unitLabel(target)}. No value is invented.`,
				missing: [
					target.dimension === 'volume' || from.dimension === 'volume' ? 'density' : 'heating_value'
				],
				assumptions: [],
				warnings: [],
				source_refs: []
			});
			return;
		}

		// Electricity → a GHG mass IS answerable, just not without a region and a
		// year. Saying "there is no conversion path" would contradict the
		// context_required row sitting right beside it (§A.2).
		if (fuel && isElectricity(fuel) && isEmissionMass(target.dimension)) {
			builder.add({
				value: null,
				raw: null,
				unit_id: target.id,
				unit_label: unitLabel(target),
				category: 'emissions',
				exactness: 'context_required',
				explanation: `Grid electricity has no single ${unitLabel(target)} figure — it depends on the country/region and the year. Pick one and this becomes answerable.`,
				missing: ['region', 'year'],
				assumptions: [],
				warnings: [],
				source_refs: []
			});
			return;
		}

		builder.add({
			value: null,
			raw: null,
			unit_id: target.id,
			unit_label: unitLabel(target),
			category: primaryGroupFor(target.dimension),
			exactness: 'unsupported',
			// The CO2 ↔ CO2e crossing has a specific, carefully written reason
			// (GWP sets; there is no uplift factor) that used to live in a module
			// nothing imported.
			explanation: isCo2Co2eCrossing(from.dimension, target.dimension)
				? CO2_CO2E_EXPLANATION
				: `There is no conversion path from ${unitLabel(from)} to ${unitLabel(target)}. They measure different things, and this tool will not invent a bridge between them.`,
			assumptions: [],
			warnings: [],
			source_refs: []
		});
	}

	/**
	 * Convert an already-computed row of the target's own dimension into the
	 * requested unit, carrying its exactness, assumptions and sources. This is
	 * how a cross-dimension target reaches units the fuel pipeline does not
	 * display directly (`1 L diesel to t`, `1 kg diesel to gal`).
	 */
	function bridgeFromExistingRow(
		builder: ResultSetBuilder,
		target: Unit,
		options: EngineOptions
	): ConversionResult | undefined {
		const source = builder.findValueInDimension(target.dimension, (id) => units.get(id));
		if (!source) return undefined;
		const sourceUnit = units.get(source.unit_id);
		if (!sourceUnit) return undefined;
		const converted = convertWithinDimension(source.raw!, sourceUnit, target);
		return {
			...source,
			value: formatValue(converted, source.exactness, { maxExactSigFigs: options.maxSigFigs }),
			raw: converted,
			unit_id: target.id,
			unit_label: unitLabel(target),
			category: primaryGroupFor(target.dimension),
			// The formula belongs to the row we derived from; repeating it here
			// would attribute the wrong calculation path to this value.
			formula: undefined,
			range: source.range
				? {
						low: convertWithinDimension(source.range.low, sourceUnit, target),
						high: convertWithinDimension(source.range.high, sourceUnit, target)
					}
				: undefined
		};
	}

	/** Flag the requested row, float it to the top of its group, and echo the
	 *  target on the set so the UI can lead with the answer that was asked for. */
	function highlightTarget(set: ConversionResultSet, target: Unit): void {
		let resolved = false;
		for (const group of set.groups) {
			const idx = group.results.findIndex((r) => r.unit_id === target.id);
			if (idx === -1) continue;
			const row = group.results[idx];
			row.is_target = true;
			if (row.value !== null) resolved = true;
			group.results.splice(idx, 1);
			group.results.unshift(row);
			break;
		}
		set.target = {
			unit_id: target.id,
			unit_label: unitLabel(target),
			dimension: target.dimension,
			resolved
		};
	}

	function convertText(
		text: string,
		options: EngineOptions = {}
	): ConversionResultSet | { error: ParseError } {
		const parsed = parse(text);
		if (!parsed.ok) return { error: parsed.error };
		return convert(parsed.query, options);
	}

	/* -------------------------------------------------------------- *
	 * Dimension-internal builders
	 * -------------------------------------------------------------- */

	function buildEnergyGroups(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		options: EngineOptions
	): void {
		// The source unit itself IS the first energy row (input echo), then the
		// display targets.
		builder.add(convertResult(value, unit, unit, 'energy', options));
		for (const targetId of ENERGY_DISPLAY_UNITS) {
			const target = units.get(targetId);
			if (target && target.id !== unit.id) {
				builder.add(convertResult(value, unit, target, 'energy', options));
			}
		}

		for (const targetId of FUEL_EQUIVALENT_UNITS) {
			const target = units.get(targetId);
			if (target) {
				const r = convertResult(value, unit, target, 'fuel_equivalents', options);
				if (target.id === 'boe') r.warnings.push(boeConventionWarning());
				builder.add(r);
			}
		}
		for (const targetId of INDUSTRIAL_UNITS) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'industrial_units', options));
		}
	}

	function buildPowerGroups(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		options: EngineOptions
	): void {
		// Power → power display.
		for (const targetId of ['watt', 'kilowatt', 'megawatt', 'gigawatt']) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'power', options));
		}

		// Power → Energy requires a time. NEVER auto kW→kWh (rulebook §D.1).
		// A supplied-but-unusable time (unknown unit, wrong dimension) falls back
		// to the same context prompt instead of silently dropping the group.
		const energyResult = options.time
			? powerTimesTime(value, unit, options.time, options)
			: undefined;
		if (energyResult) {
			builder.add(energyResult);
		} else {
			builder.add({
				value: null,
				raw: null,
				unit_id: 'kilowatt_hour',
				unit_label: 'kWh',
				category: 'energy',
				exactness: 'context_required',
				explanation:
					'Power is not energy. To get energy (kWh, MJ, …) supply a duration: energy = power × time. ' +
					'This tool never silently assumes an hour.' +
					(options.time ? ' (The supplied time could not be used — check its unit.)' : ''),
				missing: ['time'],
				assumptions: [],
				warnings: [],
				source_refs: []
			});
		}
	}

	function powerTimesTime(
		value: string,
		powerUnit: Unit,
		time: Quantity,
		options: EngineOptions,
		/** Energy unit to express the result in; defaults to kWh. */
		energyUnit?: Unit
	): ConversionResult | undefined {
		const timeUnit = units.get(time.unit_id);
		if (!timeUnit || timeUnit.dimension !== 'time') return undefined;
		const outUnit = energyUnit ?? units.get('kilowatt_hour')!;
		if (outUnit.dimension !== 'energy') return undefined;
		const watts = new Decimal(toBaseValue(value, powerUnit));
		const seconds = new Decimal(toBaseValue(time.value, timeUnit));
		const joules = watts.times(seconds).toFixed();
		const energy = convertWithinDimension(joules, units.get('joule')!, outUnit);
		// Arithmetic is exact but bounded by the least-exact input (§A.3, §C.7).
		const exactness = combineExactness(powerUnit.exactness, timeUnit.exactness, outUnit.exactness);
		return {
			value: formatValue(energy, exactness, { maxExactSigFigs: options.maxSigFigs }),
			raw: energy,
			unit_id: outUnit.id,
			unit_label: unitLabel(outUnit),
			category: 'energy',
			exactness,
			formula: step(
				`${value} ${unitLabel(powerUnit)}`,
				'×',
				`${time.value} ${unitLabel(timeUnit)}`,
				`${formatValue(energy, exactness)} ${unitLabel(outUnit)}`,
				'E = P·t'
			),
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	function buildMassGroups(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		options: EngineOptions
	): void {
		for (const targetId of ['milligram', 'gram', 'kilogram', 'tonne', 'pound']) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'mass', options));
		}
	}

	function buildVolumeGroups(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		options: EngineOptions
	): void {
		for (const targetId of [
			'milliliter',
			'liter',
			'cubic_meter',
			'us_gallon',
			'imperial_gallon',
			'barrel'
		]) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'volume', options));
		}
	}

	function buildTimeGroups(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		options: EngineOptions
	): void {
		for (const targetId of ['second', 'minute', 'hour', 'day', 'year']) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'time', options));
		}
	}

	/* -------------------------------------------------------------- *
	 * Fuel pipeline
	 * -------------------------------------------------------------- */

	function buildFuelFromVolume(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		fuel: Fuel,
		basis: HeatingBasis,
		options: EngineOptions
	): void {
		applyFuelWarnings(builder, fuel);
		const volumeM3 = toBaseValue(value, unit);

		// Volume → Mass via density.
		const dens = resolveDensity(fuel);
		let massKg: string | undefined;
		if (dens) {
			massKg = volumeToMassKg(volumeM3, dens.kgPerM3);
			builder.add(
				massResult(massKg, fuel, dens.assumption, dens.source_refs, [
					step(
						`${value} ${unitLabel(unit)} ${fuel.names[0]}`,
						'×',
						`${dens.assumption.value} ${densUnitLabel(dens.assumption.unit)}`,
						`${formatValue(kgToKgDisplay(massKg), 'source_based')} kg`,
						'density'
					)
				])
			);
		} else {
			builder.add(notAvailable('mass', 'density', fuel));
		}

		// Volume → Energy: prefer a per-volume HV; else via mass + per-mass HV.
		addEnergyFromFuel(builder, fuel, basis, options, {
			volumeM3,
			massKg,
			label: `${value} ${unitLabel(unit)} ${fuel.names[0]}`
		});

		addEmissions(builder, fuel, options, { volumeM3, massKg });
	}

	function buildFuelFromMass(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		fuel: Fuel,
		basis: HeatingBasis,
		options: EngineOptions
	): void {
		applyFuelWarnings(builder, fuel);
		const massKg = toBaseValue(value, unit);

		// Mass → Volume via density (where meaningful).
		const dens = resolveDensity(fuel);
		let volumeM3: string | undefined;
		if (dens) {
			volumeM3 = massToVolumeM3(massKg, dens.kgPerM3);
			const liters = new Decimal(volumeM3).times(1000).toFixed();
			builder.add(
				volumeResult(volumeM3, fuel, dens.assumption, dens.source_refs, [
					step(
						`${value} ${unitLabel(unit)} ${fuel.names[0]}`,
						'÷',
						`${dens.assumption.value} ${densUnitLabel(dens.assumption.unit)}`,
						`${formatValue(liters, 'source_based')} L`,
						'density'
					)
				])
			);
		}

		// A mass input is priced with the per-mass heating value (§C.9).
		addEnergyFromFuel(
			builder,
			fuel,
			basis,
			options,
			{
				volumeM3,
				massKg,
				label: `${value} ${unitLabel(unit)} ${fuel.names[0]}`
			},
			'per_mass'
		);

		addEmissions(builder, fuel, options, { volumeM3, massKg }, 'per_mass');
	}

	function buildFuelFromEnergy(
		builder: ResultSetBuilder,
		value: string,
		unit: Unit,
		fuel: Fuel,
		basis: HeatingBasis,
		_options: EngineOptions
	): void {
		applyFuelWarnings(builder, fuel);
		const energyJ = toBaseValue(value, unit);

		// Electricity: energy is the input; emissions need region+year (§C.6).
		// No mass/volume derivation — electricity is not a bulk fuel.
		if (isElectricity(fuel)) {
			addEmissions(builder, fuel, _options, { energyJ });
			return;
		}

		// Energy → mass and/or volume of that fuel (inverse via HV, then density).
		const hvMass = pickHeatingValue(fuel, basis, 'per_mass');
		const hvVol = pickHeatingValue(fuel, basis, 'per_volume');
		if (hvMass) {
			const massKg = energyToAmountBase(energyJ, hvMass.jPerBase);
			// The heating value's own floor carries into the mass it produced.
			const massExactness = heatingValueExactness(hvMass);
			builder.add(
				massResult(
					massKg,
					fuel,
					hvBasisAssumption(fuel, hvMass),
					hvMass.source_refs,
					[
						step(
							`${value} ${unitLabel(unit)}`,
							'÷',
							`${hvMass.displayValue} ${hvMass.displayUnit}`,
							`${formatValue(kgToKgDisplay(massKg), massExactness)} kg`,
							`${basisLabel(basis)} heating value`
						)
					],
					massExactness
				)
			);
			addEmissions(builder, fuel, _options, { massKg, volumeM3: undefined });
		} else if (hvVol) {
			const volumeM3 = energyToAmountBase(energyJ, hvVol.jPerBase);
			builder.add(
				volumeResult(
					volumeM3,
					fuel,
					hvBasisAssumption(fuel, hvVol),
					hvVol.source_refs,
					[],
					heatingValueExactness(hvVol)
				)
			);
			addEmissions(builder, fuel, _options, { volumeM3, massKg: undefined });
		} else {
			builder.add(notAvailable('mass', 'heating_value', fuel));
		}
	}

	/**
	 * Add the Energy group + energy-density group for a fuel amount, using the
	 * requested basis and showing the other basis alongside where data exists
	 * (rulebook §C.1). `volumeM3` and/or `massKg` are the SI-base amounts.
	 */
	function addEnergyFromFuel(
		builder: ResultSetBuilder,
		fuel: Fuel,
		basis: HeatingBasis,
		options: EngineOptions,
		amount: { volumeM3?: string; massKg?: string; label: string },
		prefer: 'per_mass' | 'per_volume' = 'per_volume'
	): void {
		const all = allHeatingValues(fuel);
		if (all.length === 0) {
			// Grid electricity has no heating value because it is not a combustible
			// material — a category difference, not a gap in the catalog. Saying
			// "not available" would contradict the fuel page, which tells the
			// reader mass/volume simply do not apply here.
			if (isElectricity(fuel)) {
				builder.add({
					value: null,
					raw: null,
					unit_id: '',
					unit_label: '',
					category: 'energy',
					exactness: 'unsupported',
					explanation: `${fuel.names[0]} is not a combustible material: it has no heating value or density, so mass and volume conversions do not apply. A kWh of electricity is already energy.`,
					assumptions: [],
					warnings: [],
					source_refs: []
				});
				return;
			}
			builder.add(notAvailable('energy', 'heating_value', fuel));
			return;
		}

		// Compute energy on the requested basis first, then any other basis present.
		const orderedBases: HeatingBasis[] = basis === 'lhv' ? ['lhv', 'hhv'] : ['hhv', 'lhv'];
		let anyEnergy = false;
		const basesProduced = new Set<HeatingBasis>();
		// "Secondary" only means something when a PRIMARY exists. If the requested
		// basis has no value for this fuel, the other basis is not an alternative
		// shown alongside a default — it is the only figure there is, and calling
		// it secondary implied a primary the reader could never find.
		const requestedBasisExists = Boolean(energyForBasis(fuel, basis, amount, prefer));
		for (const b of orderedBases) {
			const energyJ = energyForBasis(fuel, b, amount, prefer);
			if (!energyJ) continue;
			anyEnergy = true;
			const stepLabel = amountInHvDenominator(energyJ, amount, prefer);
			addEnergyResults(
				builder,
				energyJ,
				b,
				stepLabel,
				options,
				requestedBasisExists ? b === basis : true
			);
			basesProduced.add(b);
		}
		if (!anyEnergy) {
			// Name the piece that is ACTUALLY missing. `1 barrel crude oil` said
			// "crude oil has no heating value" — it has one, stated per kilogram;
			// what it has no density for is getting from barrels to kilograms.
			// Pointing at the wrong gap sends the reader looking for the wrong fix.
			const hasAnyHeatingValue = allHeatingValues(fuel).length > 0;
			const blockedByDensity =
				hasAnyHeatingValue && amount.massKg === undefined && amount.volumeM3 !== undefined;
			builder.add(notAvailable('energy', blockedByDensity ? 'density' : 'heating_value', fuel));
		}

		// Rulebook §C.1 rule 4: when only ONE basis exists in data, show it AND
		// state that the other is not available. Without this, asking for HHV on
		// an LHV-only fuel (crude oil, lignite, anthracite) returned the LHV
		// figure carrying a "shown alongside the default" warning — which implies
		// a primary HHV figure that does not exist, and made the basis toggle look
		// broken rather than honest.
		if (anyEnergy && !basesProduced.has(basis)) {
			builder.add(missingBasis(fuel, basis));
		}

		// Energy density group (per kg and/or per L) from the requested basis HV.
		addEnergyDensity(builder, fuel, basis);
	}

	/**
	 * The amount, expressed in the unit the heating value is stated PER, so the
	 * calculation path multiplies out.
	 *
	 * The formula line used to print the amount exactly as the reader typed it,
	 * against a factor in whatever unit the source published. That produced
	 * products that do not compute — `1 t coking coal × 30.24 MJ/kg = 30,240 MJ`
	 * (1 × 30.24 is 30.24), `1 bbl diesel × 9.905 kWh/L = 5,669 MJ`, `1 L gas oil
	 * × 42.569 MJ/kg`. The values were right; every one of those lines was an
	 * arithmetic claim that a reader checking our work would find false, on the
	 * one surface whose entire job is to be checkable.
	 *
	 * When the conversion is not the identity, the converted amount is shown with
	 * the step that produced it named — a unit conversion, a density, or both.
	 */
	function amountInHvDenominator(
		energy: EnergyForBasis,
		amount: { volumeM3?: string; massKg?: string; label: string },
		prefer: 'per_mass' | 'per_volume'
	): string {
		const denominator = energy.hv.displayUnit.split('/')[1]?.trim();
		if (!denominator) return amount.label;

		// The density step is separate from the unit step and is named when it ran:
		// a volume input priced by a per-mass heating value went through it.
		const viaDensity = energy.via === 'per_mass' && prefer === 'per_volume';
		let converted: string | undefined;
		if (denominator === 'kg' && amount.massKg !== undefined) {
			converted = formatValue(kgToKgDisplay(amount.massKg), 'source_based');
		} else if (denominator === 'L' && amount.volumeM3 !== undefined) {
			converted = formatValue(new Decimal(amount.volumeM3).times(1000).toFixed(), 'source_based');
		} else if ((denominator === 'm³' || denominator === 'm3') && amount.volumeM3 !== undefined) {
			converted = formatValue(amount.volumeM3, 'source_based');
		}
		if (converted === undefined) return amount.label;

		const shown = `${converted} ${denominator}`;
		// Identity: the reader typed exactly this, so naming a step would be noise.
		if (!viaDensity && amount.label.startsWith(`${converted} ${denominator}`)) return amount.label;
		if (amount.label === shown) return amount.label;
		return `${shown} (${amount.label}${viaDensity ? ' × density' : ''})`;
	}

	/**
	 * Energy of a fuel amount on one basis.
	 *
	 * `prefer` follows what the user actually typed: a mass input is priced with
	 * the per-MASS heating value, a volume input with the per-VOLUME one. Taking
	 * whichever happened to exist produced a calculation path reading
	 * "1 kg diesel × 9.905 kWh/L", which is dimensionally meaningless and hides
	 * the density step it silently went through. The other kind is still used as
	 * a fallback when the preferred one is not in the catalog.
	 */
	function energyForBasis(
		fuel: Fuel,
		basis: HeatingBasis,
		amount: { volumeM3?: string; massKg?: string },
		prefer: 'per_mass' | 'per_volume' = 'per_volume'
	): EnergyForBasis | undefined {
		const byVolume = () => {
			if (amount.volumeM3 === undefined) return undefined;
			const hv = pickHeatingValue(fuel, basis, 'per_volume');
			if (!hv) return undefined;
			return {
				joules: amountToEnergyJ(amount.volumeM3, hv.jPerBase),
				joulesRange: energyRangeJ(amount.volumeM3, hv),
				hv,
				via: 'per_volume' as const
			};
		};
		const byMass = () => {
			if (amount.massKg === undefined) return undefined;
			const hv = pickHeatingValue(fuel, basis, 'per_mass');
			if (!hv) return undefined;
			return {
				joules: amountToEnergyJ(amount.massKg, hv.jPerBase),
				joulesRange: energyRangeJ(amount.massKg, hv),
				hv,
				via: 'per_mass' as const
			};
		};
		return prefer === 'per_mass' ? (byMass() ?? byVolume()) : (byVolume() ?? byMass());
	}

	/** Energy range (J) for an amount whose heating value has a genuine spread. */
	function energyRangeJ(
		amountBase: string,
		hv: HeatingValueResolved
	): { low: string; high: string } | undefined {
		if (!hv.jPerBaseRange) return undefined;
		return {
			low: amountToEnergyJ(amountBase, hv.jPerBaseRange.low),
			high: amountToEnergyJ(amountBase, hv.jPerBaseRange.high)
		};
	}

	function addEnergyResults(
		builder: ResultSetBuilder,
		energy: EnergyForBasis,
		basis: HeatingBasis,
		label: string,
		options: EngineOptions,
		isPrimary: boolean
	): void {
		const { joules, joulesRange, hv } = energy;
		// Exactness floor: a tabulated single-source value is source_based; a value
		// whose OWN source records a wide genuine spread (>25% high/low, e.g.
		// rank-variable coal) is a representative pick within that spread —
		// `estimated` per rulebook §A / types.ts (three sig figs + `~`).
		const wideSpread = hv.jPerBaseRange
			? new Decimal(hv.jPerBaseRange.high).div(new Decimal(hv.jPerBaseRange.low)).gt('1.25')
			: false;
		const exactness = combineExactness(wideSpread ? 'estimated' : 'source_based');
		for (const targetId of ['megajoule', 'kilowatt_hour', 'gigajoule', 'btu']) {
			const target = units.get(targetId)!;
			const converted = convertWithinDimension(joules, units.get('joule')!, target);
			// The displayed range must be CONVERTED into this row's target unit —
			// never the raw per-kg/per-m³ source numbers reused across rows.
			// Rounded to the row's own cap: these bounds ship to API and CSV
			// consumers, where 40 significant digits on a bound whose value shows
			// three is a false claim about precision.
			const range = joulesRange
				? {
						low: roundToSigFigs(
							convertWithinDimension(joulesRange.low, units.get('joule')!, target),
							sigFigsFor(exactness, options.maxSigFigs),
							Decimal.ROUND_FLOOR
						),
						high: roundToSigFigs(
							convertWithinDimension(joulesRange.high, units.get('joule')!, target),
							sigFigsFor(exactness, options.maxSigFigs),
							Decimal.ROUND_CEIL
						)
					}
				: undefined;
			const a: Assumption = hvBasisAssumption(undefined, hv, basis);
			builder.add({
				value: formatValue(converted, exactness, { maxExactSigFigs: options.maxSigFigs }),
				raw: converted,
				unit_id: target.id,
				unit_label: unitLabel(target),
				category: 'energy',
				exactness,
				formula:
					targetId === 'megajoule'
						? step(
								label,
								'×',
								`${hv.displayValue} ${hv.displayUnit}`,
								`${formatValue(converted, exactness)} ${unitLabel(target)}`,
								`${basisLabel(basis)}${isPrimary ? '' : ' — secondary'}`
							)
						: undefined,
				assumptions: [a],
				warnings: isPrimary
					? []
					: [
							{
								kind: 'basis_secondary',
								severity: 'info',
								text: `${basisLabel(basis)} figure shown alongside the default.`
							}
						],
				source_refs: hv.source_refs,
				range
			});
		}
	}

	function addEnergyDensity(builder: ResultSetBuilder, fuel: Fuel, basis: HeatingBasis): void {
		const perMass = pickHeatingValue(fuel, basis, 'per_mass');
		const perVol = pickHeatingValue(fuel, basis, 'per_volume');
		if (perMass) {
			builder.add(
				densityDisplayResult(
					perMass.displayValue,
					perMass.displayUnit,
					'energy_density',
					fuel,
					basis,
					perMass.source_refs
				)
			);
		}
		if (perVol) {
			builder.add(
				densityDisplayResult(
					perVol.displayValue,
					perVol.displayUnit,
					'energy_density',
					fuel,
					basis,
					perVol.source_refs
				)
			);
		}
	}

	/* -------------------------------------------------------------- *
	 * Emissions pipeline
	 * -------------------------------------------------------------- */

	function addEmissions(
		builder: ResultSetBuilder,
		fuel: Fuel,
		options: EngineOptions,
		amount: { volumeM3?: string; massKg?: string; energyJ?: string },
		prefer: 'per_mass' | 'per_volume' = 'per_volume'
	): void {
		// Electricity → CO2/CO2e is region_year_specific; default is context_required (§C.6).
		if (isElectricity(fuel)) {
			builder.add(electricityEmissions(fuel, options, amount.energyJ));
			return;
		}

		// Hydrogen: direct combustion CO2 = 0 (physical fact), combustion-only label (§C.5).
		if (isHydrogen(fuel)) {
			builder.add({
				value: '0',
				raw: '0',
				unit_id: 'kilogram_co2',
				unit_label: 'kg CO2',
				category: 'emissions',
				exactness: 'exact',
				explanation: 'Direct combustion of H₂ produces no CO2 (no carbon in the molecule).',
				formula: 'H₂ + ½O₂ → H₂O  (no carbon → CO2 = 0)',
				assumptions: [],
				warnings: [hydrogenCombustionWarning()],
				source_refs: []
			});
			// Upstream is context_required (pathway + region/year); shown only if data exists.
			addFactorEmissions(builder, fuel, amount, prefer);
			return;
		}

		const any = addFactorEmissions(builder, fuel, amount, prefer);
		if (!any) {
			// Name the piece that is ACTUALLY missing, the same way the energy path
			// does. Crude oil HAS a cited factor (IPCC, per GJ); what it has no
			// density for is getting from a barrel to the mass that factor needs.
			// Saying "no emission factor" sent the reader looking for the wrong
			// gap — and, for a catalog whose credibility rests on provenance,
			// wrongly implied nobody had sourced one.
			const hasFactor = (fuel.emission_factor_ids ?? []).some((id) => factorsById.has(id));
			const blockedByDensity =
				hasFactor && amount.massKg === undefined && amount.volumeM3 !== undefined;
			builder.add(
				notAvailable('emissions', blockedByDensity ? 'density' : 'emission_factor', fuel)
			);
		}
	}

	/** Apply every cited emission factor of a fuel. Returns true if any produced a value. */
	function addFactorEmissions(
		builder: ResultSetBuilder,
		fuel: Fuel,
		amount: { volumeM3?: string; massKg?: string },
		prefer: 'per_mass' | 'per_volume' = 'per_volume'
	): boolean {
		let produced = false;
		for (const fid of fuel.emission_factor_ids ?? []) {
			const factor = factorsById.get(fid);
			if (!factor) continue;
			const kind = factorInputKind(factor);
			if (!kind) continue;

			let amountBase: string | undefined;
			// A per-energy factor is applied to energy the fuel pipeline derived, so
			// this row can be no more exact than that energy was (§A: the floor is
			// set by the weakest link). Lignite's CO2 was printed as `source_based`
			// with 4 significant figures although it came from an `estimated`
			// energy spanning 5.5–21.6 MJ/kg.
			let pathExactness: Exactness | undefined;
			if (kind === 'volume') amountBase = amount.volumeM3;
			else if (kind === 'mass') amountBase = amount.massKg;
			else if (kind === 'energy') {
				const energy = energyForFactor(fuel, factor, amount, prefer);
				amountBase = energy?.joules;
				pathExactness = energy ? heatingValueExactness(energy.hv) : undefined;
			}
			if (amountBase === undefined) continue;

			const applied = applyFactor(factor, amountBase);
			if (!applied) continue;
			produced = true;

			const isCo2e = factor.pollutant === 'CO2e';
			const biogenic = factor.biogenic === true || factor.pollutant === 'biogenic_CO2';
			// "global" is a coverage statement, not a geographic specificity —
			// a worldwide IPCC default is source_based, not region_year_specific.
			const factorExactness =
				factor.region && factor.region !== 'global' ? 'region_year_specific' : 'source_based';
			const exactness = pathExactness
				? combineExactness(factorExactness, pathExactness)
				: factorExactness;
			const unitId = isCo2e ? 'kilogram_co2e' : 'kilogram_co2';
			const massDisplay = kgToKgDisplay(applied.massKg);

			const warnings: Warning[] = [representativeValueWarning()];
			if (biogenic) warnings.push(biogenicCo2Warning());
			if (factor.uncertainty) {
				warnings.push({ kind: 'factor_uncertainty', severity: 'info', text: factor.uncertainty });
			}

			builder.add({
				value: formatValue(massDisplay, exactness),
				raw: applied.massKg,
				unit_id: unitId,
				unit_label: applied.displayUnit,
				category: 'emissions',
				exactness,
				explanation: emissionExplanation(factor),
				formula: step(
					`${fuel.names[0]} amount`,
					'×',
					`${factor.value} ${factor.unit} [${POLLUTANT_LABEL[factor.pollutant]}, ${SCOPE_LABEL[factor.scope]}${factor.region ? `, ${factor.region} ${factor.year ?? ''}` : ''}]`,
					`${formatValue(massDisplay, exactness)} ${applied.displayUnit}`
				),
				assumptions: [],
				warnings,
				source_refs: [factor.source_id]
			});
		}
		return produced;
	}

	/** The exactness a heating value imposes on anything derived from it: a
	 *  recorded spread wider than 25% makes it a representative pick, not a
	 *  tabulated value (mirrors the rule applied to the energy rows themselves). */
	function heatingValueExactness(hv: HeatingValueResolved): Exactness {
		if (!hv.jPerBaseRange) return 'source_based';
		return new Decimal(hv.jPerBaseRange.high).div(new Decimal(hv.jPerBaseRange.low)).gt('1.25')
			? 'estimated'
			: 'source_based';
	}

	function energyForFactor(
		fuel: Fuel,
		factor: { basis?: HeatingBasis },
		amount: { volumeM3?: string; massKg?: string },
		prefer: 'per_mass' | 'per_volume'
	): EnergyForBasis | undefined {
		return energyForBasis(fuel, factor.basis ?? 'lhv', amount, prefer);
	}

	/**
	 * Grid-electricity emissions (§C.6). With a matching region+year factor the
	 * input energy is multiplied through `applyFactor` and the result is
	 * `region_year_specific`, labeled with the factor's own metric (CO2 vs CO2e
	 * stay separate — §D.6). Without region+year (or with a combination the
	 * catalog has no factor for) the result stays `context_required` with the
	 * illustrative examples; no default grid is ever assumed.
	 */
	function electricityEmissions(
		fuel: Fuel,
		options: EngineOptions,
		energyJ?: string
	): ConversionResult {
		const haveContext = Boolean(options.region && options.year !== undefined);
		// Region match is case/whitespace-forgiving ("uk" finds "UK") — a near-miss
		// silently falling through to context_required would read as missing data.
		const wantRegion = options.region?.trim().toLowerCase();
		if (haveContext && energyJ !== undefined) {
			const factorId = (fuel.emission_factor_ids ?? []).find((id) => {
				const f = factorsById.get(id);
				return (
					f &&
					f.region?.toLowerCase() === wantRegion &&
					f.year === options.year &&
					factorInputKind(f) === 'energy'
				);
			});
			const factor = factorId ? factorsById.get(factorId) : undefined;
			const applied = factor ? applyFactor(factor, energyJ) : undefined;
			if (factor && applied) {
				const isCo2e = factor.pollutant === 'CO2e';
				const massDisplay = kgToKgDisplay(applied.massKg);
				const warnings: Warning[] = [];
				if (factor.uncertainty) {
					warnings.push({ kind: 'factor_uncertainty', severity: 'info', text: factor.uncertainty });
				}
				return {
					value: formatValue(massDisplay, 'region_year_specific'),
					raw: applied.massKg,
					unit_id: isCo2e ? 'kilogram_co2e' : 'kilogram_co2',
					unit_label: applied.displayUnit,
					category: 'emissions',
					exactness: 'region_year_specific',
					explanation: emissionExplanation(factor),
					formula: step(
						'electricity amount',
						'×',
						`${factor.value} ${factor.unit} [${POLLUTANT_LABEL[factor.pollutant]}, ${SCOPE_LABEL[factor.scope]}, ${factor.region} ${factor.year}]`,
						`${formatValue(massDisplay, 'region_year_specific')} ${applied.displayUnit}`
					),
					assumptions: [
						{
							kind: 'grid_intensity',
							text: `grid intensity ${factor.region} ${factor.year}: ${factor.value} ${factor.unit.replace(/_per_/, '/').replace(/_/g, ' ')} (${POLLUTANT_LABEL[factor.pollutant]}, ${SCOPE_LABEL[factor.scope]})`,
							value: factor.value,
							unit: factor.unit,
							source_refs: [factor.source_id]
						}
					],
					warnings,
					source_refs: [factor.source_id]
				};
			}
		}
		const unmatched = haveContext
			? ` No cited factor for "${options.region} ${options.year}" is in the catalog — pick one of the available region/year combinations below; nothing is estimated.`
			: '';
		return {
			value: null,
			raw: null,
			unit_id: 'g_co2e_per_kwh',
			unit_label: 'gCO2e/kWh',
			category: 'emissions',
			exactness: 'context_required',
			explanation:
				'Grid electricity CO2/CO2e intensity depends on the country/region, the year, and even ' +
				'the time of day — there is no single correct global factor. Pick a region and year.' +
				unmatched,
			missing: ['region', 'year'],
			assumptions: [],
			warnings: [],
			source_refs: [],
			illustrative_examples: illustrativeElectricityExamples(fuel)
		};
	}

	/**
	 * Region+year-tagged illustrative (never default) electricity factors for the
	 * "Illustrative examples" sub-block (rulebook §C.6: "(region, year, gCO2e/kWh,
	 * source) rows"). Shown as the factor's own per-kWh RATE, not a mass computed
	 * for the caller's input amount — these are reference examples of what a real
	 * region+year factor looks like, not a computed answer for this query.
	 */
	function illustrativeElectricityExamples(fuel: Fuel): IllustrativeExample[] | undefined {
		const examples: IllustrativeExample[] = [];
		for (const fid of fuel.emission_factor_ids ?? []) {
			const factor = factorsById.get(fid);
			if (!factor || !factor.region || factor.year === undefined) continue;
			if (factorInputKind(factor) !== 'energy') continue;
			examples.push({
				label: `${factor.region} ${factor.year}`,
				value: factor.value,
				unit_label: factorUnitLabel(factor.unit),
				pollutant: POLLUTANT_LABEL[factor.pollutant],
				region: factor.region,
				year: factor.year,
				source_refs: [factor.source_id]
			});
		}
		return examples.length ? examples : undefined;
	}

	/* -------------------------------------------------------------- *
	 * Small result constructors
	 * -------------------------------------------------------------- */

	function convertResult(
		value: string,
		from: Unit,
		to: Unit,
		category: ResultGroupKey,
		options: EngineOptions
	): ConversionResult {
		const converted = convertWithinDimension(value, from, to);
		const exactness = combineExactness(from.exactness, to.exactness);
		return {
			value: formatValue(converted, exactness, { maxExactSigFigs: options.maxSigFigs }),
			raw: converted,
			unit_id: to.id,
			unit_label: unitLabel(to),
			category,
			exactness,
			assumptions: [],
			warnings: [],
			source_refs: dedupeSourceRefs(from, to)
		};
	}

	function massResult(
		massKg: string,
		fuel: Fuel,
		assumption: Assumption,
		refs: string[],
		formulas: string[],
		/**
		 * Floor of the chain that produced this mass (rulebook §A: exactness is a
		 * floor, propagated by the weakest link; §B.3 gives energy→mass "same
		 * floor"). Density is source_based, but an energy→mass step runs back
		 * through a heating value that may only be an estimate — lignite's IPCC
		 * 95% CI is 5.50–21.6 MJ/kg, so "1 GJ lignite" is anywhere from 46 to
		 * 182 kg. Printing 84.03 kg as source_based claimed four significant
		 * figures it had not earned.
		 */
		exactness: Exactness = 'source_based'
	): ConversionResult {
		return {
			value: formatValue(kgToKgDisplay(massKg), exactness),
			raw: massKg,
			unit_id: 'kilogram',
			unit_label: 'kg',
			category: 'mass',
			exactness,
			formula: formulas[0],
			assumptions: [assumption],
			warnings: [],
			source_refs: refs
		};
	}

	function volumeResult(
		volumeM3: string,
		fuel: Fuel,
		assumption: Assumption,
		refs: string[],
		formulas: string[],
		/** See `massResult` — same rulebook §B.3 "same floor" requirement. */
		exactness: Exactness = 'source_based'
	): ConversionResult {
		const liters = new Decimal(volumeM3).times(1000).toFixed();
		return {
			value: formatValue(liters, exactness),
			raw: liters,
			unit_id: 'liter',
			unit_label: 'L',
			category: 'volume',
			exactness,
			formula: formulas[0],
			assumptions: [assumption],
			warnings: [],
			source_refs: refs
		};
	}

	function densityDisplayResult(
		value: string,
		displayUnit: string,
		category: ResultGroupKey,
		fuel: Fuel,
		basis: HeatingBasis,
		refs: string[]
	): ConversionResult {
		return {
			value: formatValue(value, 'source_based'),
			raw: value,
			unit_id: '',
			unit_label: displayUnit,
			category,
			exactness: 'source_based',
			explanation: `${basisLabel(basis)} energy density of ${fuel.names[0]}.`,
			assumptions: [],
			warnings: [],
			source_refs: refs
		};
	}

	function simpleResult(
		value: string,
		from: Unit,
		to: Unit,
		category: ResultGroupKey,
		exactness: Unit['exactness']
	): ConversionResult {
		return {
			value: formatValue(value, exactness),
			raw: value,
			unit_id: to.id,
			unit_label: unitLabel(to),
			category,
			exactness,
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	function notAvailable(
		category: ResultGroupKey,
		missing: 'density' | 'heating_value' | 'emission_factor',
		fuel: Fuel
	): ConversionResult {
		return {
			value: null,
			raw: null,
			unit_id: '',
			unit_label: '',
			category,
			exactness: 'context_required',
			explanation: `Not available: ${fuel.names[0]} has no ${missing.replace('_', ' ')} in the data set. No value is invented.`,
			missing: [missing],
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	/**
	 * "You asked for HHV; this fuel only has LHV in the data set."
	 *
	 * Rulebook §C.1 rule 4 requires saying this out loud, and §D.2 forbids
	 * deriving one basis from the other — the LHV→HHV gap depends on the fuel's
	 * hydrogen and moisture content, so there is no generic factor to apply.
	 * Silence here was worse than a missing number: the reader saw an LHV figure
	 * after asking for HHV and had no way to tell the toggle had done nothing.
	 */
	function missingBasis(fuel: Fuel, basis: HeatingBasis): ConversionResult {
		const other: HeatingBasis = basis === 'hhv' ? 'lhv' : 'hhv';
		return {
			value: null,
			raw: null,
			unit_id: '',
			unit_label: '',
			category: 'energy',
			exactness: 'context_required',
			explanation: `Not available: ${fuel.names[0]} has no ${basisLabel(basis)} value in the data set, so the ${basisLabel(other)} figure above is the only one there is. The two are never derived from each other — the gap depends on the fuel's hydrogen and moisture content.`,
			missing: ['heating_value'],
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	function contextPickMaterial(category: ResultGroupKey, unit: Unit): ConversionResult {
		return {
			value: null,
			raw: null,
			unit_id: '',
			unit_label: '',
			category,
			exactness: 'context_required',
			explanation: `${unitLabel(unit)} of what? Pick a fuel (e.g. diesel, natural gas, wood pellets) and this becomes energy, mass and emissions.`,
			missing: ['fuel'],
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	function applyFuelWarnings(builder: ResultSetBuilder, fuel: Fuel): void {
		for (const w of fuel.warnings ?? []) {
			builder.addWarning({ kind: 'fuel_warning', severity: 'caution', text: w });
		}
	}

	function unsupportedSet(query: ParsedQuery, explanation: string): ConversionResultSet {
		const builder = new ResultSetBuilder({
			value: query.value,
			unit_id: query.unit_id,
			unit_label: query.unit_id,
			original_input: query.original_input
		});
		builder.add({
			value: null,
			raw: null,
			unit_id: query.unit_id,
			unit_label: query.unit_id,
			category: 'energy',
			exactness: 'unsupported',
			explanation,
			assumptions: [],
			warnings: [],
			source_refs: []
		});
		return builder.build();
	}

	return { parse, convert, convertText };
}

/* ------------------------------------------------------------------ *
 * Module-level helpers
 * ------------------------------------------------------------------ */

/** The group a unit of this dimension primarily belongs to. */
function primaryGroupFor(dim: Unit['dimension']): ResultGroupKey {
	switch (dim) {
		case 'energy':
			return 'energy';
		case 'power':
			return 'power';
		case 'mass':
			return 'mass';
		case 'volume':
			return 'volume';
		case 'time':
			return 'time';
		default:
			return groupForDimension(dim);
	}
}

function groupForDimension(dim: Unit['dimension']): ResultGroupKey {
	switch (dim) {
		case 'emission_mass_co2':
		case 'emission_mass_co2e':
		case 'emission_intensity':
			return 'emissions';
		case 'energy_density_mass':
		case 'energy_density_volume':
			return 'energy_density';
		// A density is a mass per volume, not an energy. "1 kg/L" used to be
		// filed under Energy by the default branch.
		case 'mass_density':
			return 'mass';
		case 'energy':
		case 'power':
		case 'time':
		case 'volume':
		case 'mass':
			return dim;
	}
}

/** kg value is already in kg for display (helper name documents intent). */
function kgToKgDisplay(massKg: string): string {
	return massKg;
}

function densUnitLabel(unit?: string): string {
	switch (unit) {
		case 'kg_per_l':
			return 'kg/L';
		case 'kg_per_m3':
			return 'kg/m³';
		case 'g_per_cm3':
			return 'g/cm³';
		default:
			return unit ?? '';
	}
}

function hvBasisAssumption(
	_fuel: Fuel | undefined,
	hv: HeatingValueResolved,
	basis?: HeatingBasis
): Assumption {
	const b = basis ?? hv.basis;
	return {
		kind: 'heating_value_basis',
		text: `energy on ${basisLabel(b)} basis, ${hv.displayValue} ${hv.displayUnit}`,
		value: hv.displayValue,
		unit: hv.displayUnit,
		source_refs: hv.source_refs
	};
}

function emissionExplanation(factor: EmissionFactor): string {
	const parts = [
		`metric: ${POLLUTANT_LABEL[factor.pollutant]}`,
		`scope: ${SCOPE_LABEL[factor.scope]}`
	];
	// The heating-value basis only bears on a factor expressed PER ENERGY. On a
	// per-kg or per-litre factor it records which source column the figure came
	// from, and printing it as part of the answer is misleading noise.
	if (factor.basis && factorInputKind(factor) === 'energy') {
		parts.push(`basis: ${basisLabel(factor.basis)}`);
	}
	if (factor.region) parts.push(`region: ${factor.region}`);
	if (factor.year) parts.push(`year: ${factor.year}`);
	// Cell-level provenance (e.g. "'Fuels' sheet, 'Diesel (average biofuel blend)'")
	// — the traceability this product exists for, surfaced instead of shelved.
	if (factor.source_table_or_page) parts.push(`source table: ${factor.source_table_or_page}`);
	return parts.join(' · ');
}

function dedupeSourceRefs(a: Unit, b: Unit): string[] {
	const set = new Set<string>();
	// Only surface refs for non-exact factors (exact SI identities need none).
	if (a.exactness !== 'exact') for (const r of a.source_refs) set.add(r);
	if (b.exactness !== 'exact') for (const r of b.source_refs) set.add(r);
	return [...set];
}
