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
	EngineOptions,
	Fuel,
	HeatingBasis,
	IllustrativeExample,
	ParsedQuery,
	ParseError,
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
import { formatValue } from '$lib/formatting/numbers';
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
import { applyFactor, factorInputKind } from '$lib/emissions/factors';
import { POLLUTANT_LABEL, SCOPE_LABEL } from '$lib/emissions/scopes';
import {
	biogenicCo2Warning,
	boeConventionWarning,
	hydrogenCombustionWarning,
	representativeValueWarning
} from './warnings';

Decimal.set({ precision: 40 });

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
		const basis: HeatingBasis = options.basis ?? 'lhv';
		const unit = units.get(query.unit_id);
		if (!unit) {
			// Should not happen (parser validated), but fail safe.
			return unsupportedSet(query, `Unknown unit '${query.unit_id}'.`);
		}
		const fuel = query.fuel_id ? fuels.get(query.fuel_id) : undefined;

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

		// Route by the input unit's dimension.
		switch (unit.dimension) {
			case 'energy':
				buildEnergyGroups(builder, query.value, unit, options);
				if (fuel) buildFuelFromEnergy(builder, query.value, unit, fuel, basis, options);
				break;
			case 'power':
				buildPowerGroups(builder, query.value, unit, options);
				break;
			case 'mass':
				buildMassGroups(builder, query.value, unit);
				if (fuel) buildFuelFromMass(builder, query.value, unit, fuel, basis, options);
				else builder.add(contextPickMaterial('energy', unit));
				break;
			case 'volume':
				buildVolumeGroups(builder, query.value, unit);
				if (fuel) buildFuelFromVolume(builder, query.value, unit, fuel, basis, options);
				else builder.add(contextPickMaterial('energy', unit));
				break;
			default:
				// Pseudo-dimensions: show the value in its own group; no bridging.
				builder.add(
					simpleResult(query.value, unit, unit, groupForDimension(unit.dimension), unit.exactness)
				);
		}

		return builder.build();
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
		for (const targetId of ENERGY_DISPLAY_UNITS) {
			const target = units.get(targetId);
			if (target && target.id !== unit.id) {
				builder.add(convertResult(value, unit, target, 'energy', options));
			}
		}
		// Always include the source unit itself as the first energy row.
		builder.add(convertResult(value, unit, unit, 'energy', options));

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
		if (options.time) {
			const energyResult = powerTimesTime(value, unit, options.time, options);
			if (energyResult) builder.add(energyResult);
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
					'This tool never silently assumes an hour.',
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
		options: EngineOptions
	): ConversionResult | undefined {
		const timeUnit = units.get(time.unit_id);
		if (!timeUnit || timeUnit.dimension !== 'time') return undefined;
		const watts = new Decimal(toBaseValue(value, powerUnit));
		const seconds = new Decimal(toBaseValue(time.value, timeUnit));
		const joules = watts.times(seconds).toFixed();
		const kwhUnit = units.get('kilowatt_hour')!;
		const kwh = convertWithinDimension(joules, units.get('joule')!, kwhUnit);
		// Arithmetic is exact but bounded by the least-exact input (§A.3, §C.7).
		const exactness = combineExactness(powerUnit.exactness, timeUnit.exactness);
		return {
			value: formatValue(kwh, exactness, { maxExactSigFigs: options.maxSigFigs }),
			raw: kwh,
			unit_id: kwhUnit.id,
			unit_label: unitLabel(kwhUnit),
			category: 'energy',
			exactness,
			formula: step(
				`${value} ${unitLabel(powerUnit)}`,
				'×',
				`${time.value} ${unitLabel(timeUnit)}`,
				`${formatValue(kwh, exactness)} kWh`,
				'E = P·t'
			),
			assumptions: [],
			warnings: [],
			source_refs: []
		};
	}

	function buildMassGroups(builder: ResultSetBuilder, value: string, unit: Unit): void {
		for (const targetId of ['milligram', 'gram', 'kilogram', 'tonne', 'pound']) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'mass', {}));
		}
	}

	function buildVolumeGroups(builder: ResultSetBuilder, value: string, unit: Unit): void {
		for (const targetId of [
			'milliliter',
			'liter',
			'cubic_meter',
			'us_gallon',
			'imperial_gallon',
			'barrel'
		]) {
			const target = units.get(targetId);
			if (target) builder.add(convertResult(value, unit, target, 'volume', {}));
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

		addEnergyFromFuel(builder, fuel, basis, options, {
			volumeM3,
			massKg,
			label: `${value} ${unitLabel(unit)} ${fuel.names[0]}`
		});

		addEmissions(builder, fuel, options, { volumeM3, massKg });
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
			builder.add(
				massResult(massKg, fuel, hvBasisAssumption(fuel, hvMass), hvMass.source_refs, [
					step(
						`${value} ${unitLabel(unit)}`,
						'÷',
						`${hvMass.displayValue} ${hvMass.displayUnit}`,
						`${formatValue(kgToKgDisplay(massKg), 'source_based')} kg`,
						`${basisLabel(basis)} heating value`
					)
				])
			);
			addEmissions(builder, fuel, _options, { massKg, volumeM3: undefined });
		} else if (hvVol) {
			const volumeM3 = energyToAmountBase(energyJ, hvVol.jPerBase);
			builder.add(
				volumeResult(volumeM3, fuel, hvBasisAssumption(fuel, hvVol), hvVol.source_refs, [])
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
		amount: { volumeM3?: string; massKg?: string; label: string }
	): void {
		const all = allHeatingValues(fuel);
		if (all.length === 0) {
			builder.add(notAvailable('energy', 'heating_value', fuel));
			return;
		}

		// Compute energy on the requested basis first, then any other basis present.
		const orderedBases: HeatingBasis[] = basis === 'lhv' ? ['lhv', 'hhv'] : ['hhv', 'lhv'];
		let anyEnergy = false;
		for (const b of orderedBases) {
			const energyJ = energyForBasis(fuel, b, amount);
			if (!energyJ) continue;
			anyEnergy = true;
			addEnergyResults(builder, energyJ.joules, b, energyJ.hv, amount.label, options, b === basis);
		}
		if (!anyEnergy) builder.add(notAvailable('energy', 'heating_value', fuel));

		// Energy density group (per kg and/or per L) from the requested basis HV.
		addEnergyDensity(builder, fuel, basis);
	}

	function energyForBasis(
		fuel: Fuel,
		basis: HeatingBasis,
		amount: { volumeM3?: string; massKg?: string }
	): { joules: string; hv: HeatingValueResolved } | undefined {
		// Prefer per-volume HV when we have a volume, else per-mass with a mass.
		if (amount.volumeM3 !== undefined) {
			const hvVol = pickHeatingValue(fuel, basis, 'per_volume');
			if (hvVol) return { joules: amountToEnergyJ(amount.volumeM3, hvVol.jPerBase), hv: hvVol };
		}
		if (amount.massKg !== undefined) {
			const hvMass = pickHeatingValue(fuel, basis, 'per_mass');
			if (hvMass) return { joules: amountToEnergyJ(amount.massKg, hvMass.jPerBase), hv: hvMass };
		}
		return undefined;
	}

	function addEnergyResults(
		builder: ResultSetBuilder,
		joules: string,
		basis: HeatingBasis,
		hv: HeatingValueResolved,
		label: string,
		options: EngineOptions,
		isPrimary: boolean
	): void {
		const exactness = combineExactness('source_based'); // fuel HV floor
		for (const targetId of ['megajoule', 'kilowatt_hour', 'gigajoule', 'btu']) {
			const target = units.get(targetId)!;
			const converted = convertWithinDimension(joules, units.get('joule')!, target);
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
				range: hv.range
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
		amount: { volumeM3?: string; massKg?: string; energyJ?: string }
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
			addFactorEmissions(builder, fuel, amount);
			return;
		}

		const any = addFactorEmissions(builder, fuel, amount);
		if (!any) {
			builder.add(notAvailable('emissions', 'emission_factor', fuel));
		}
	}

	/** Apply every cited emission factor of a fuel. Returns true if any produced a value. */
	function addFactorEmissions(
		builder: ResultSetBuilder,
		fuel: Fuel,
		amount: { volumeM3?: string; massKg?: string }
	): boolean {
		let produced = false;
		for (const fid of fuel.emission_factor_ids ?? []) {
			const factor = factorsById.get(fid);
			if (!factor) continue;
			const kind = factorInputKind(factor);
			if (!kind) continue;

			let amountBase: string | undefined;
			if (kind === 'volume') amountBase = amount.volumeM3;
			else if (kind === 'mass') amountBase = amount.massKg;
			// energy-based factors would need the fuel energy; v0.1 wires volume/mass
			// factors (the common case). Energy-based factors are applied when the
			// Data agent supplies a per-energy factor together with a heating value:
			else if (kind === 'energy') amountBase = energyBaseForFactor(fuel, factor, amount);
			if (amountBase === undefined) continue;

			const applied = applyFactor(factor, amountBase);
			if (!applied) continue;
			produced = true;

			const isCo2e = factor.pollutant === 'CO2e';
			const biogenic = factor.biogenic === true || factor.pollutant === 'biogenic_CO2';
			const exactness = factor.region ? 'region_year_specific' : 'source_based';
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

	function energyBaseForFactor(
		fuel: Fuel,
		factor: { basis?: HeatingBasis },
		amount: { volumeM3?: string; massKg?: string }
	): string | undefined {
		const basis: HeatingBasis = factor.basis ?? 'lhv';
		const e = energyForBasis(fuel, basis, amount);
		return e?.joules;
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
		if (haveContext && energyJ !== undefined) {
			const factorId = (fuel.emission_factor_ids ?? []).find((id) => {
				const f = factorsById.get(id);
				return (
					f &&
					f.region === options.region &&
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
				unit_label: factor.unit,
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
		formulas: string[]
	): ConversionResult {
		return {
			value: formatValue(kgToKgDisplay(massKg), 'source_based'),
			raw: massKg,
			unit_id: 'kilogram',
			unit_label: 'kg',
			category: 'mass',
			exactness: 'source_based',
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
		formulas: string[]
	): ConversionResult {
		const liters = new Decimal(volumeM3).times(1000).toFixed();
		return {
			value: formatValue(liters, 'source_based'),
			raw: liters,
			unit_id: 'liter',
			unit_label: 'L',
			category: 'volume',
			exactness: 'source_based',
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

	function notAvailable(category: ResultGroupKey, missing: string, fuel: Fuel): ConversionResult {
		return {
			value: null,
			raw: null,
			unit_id: '',
			unit_label: '',
			category,
			exactness: 'context_required',
			explanation: `Not available: ${fuel.names[0]} has no ${missing.replace('_', ' ')} in the data set. No value is invented.`,
			missing: missing === 'density' ? ['density'] : undefined,
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
			explanation: `To convert ${unitLabel(unit)} to energy/mass/emissions, pick a material (e.g. diesel, natural gas, wood pellets).`,
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

function groupForDimension(dim: Unit['dimension']): ResultGroupKey {
	switch (dim) {
		case 'emission_mass_co2':
		case 'emission_mass_co2e':
			return 'emissions';
		case 'energy_density_mass':
		case 'energy_density_volume':
			return 'energy_density';
		default:
			return 'energy';
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

function emissionExplanation(factor: {
	pollutant: keyof typeof POLLUTANT_LABEL;
	scope: keyof typeof SCOPE_LABEL;
	basis?: HeatingBasis;
	region?: string;
	year?: number;
	source_table_or_page?: string;
}): string {
	const parts = [
		`metric: ${POLLUTANT_LABEL[factor.pollutant]}`,
		`scope: ${SCOPE_LABEL[factor.scope]}`
	];
	if (factor.basis) parts.push(`basis: ${basisLabel(factor.basis)}`);
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
