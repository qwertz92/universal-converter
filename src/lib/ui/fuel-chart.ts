/**
 * The data behind the /fuels comparison chart: one figure per fuel, for two
 * metrics, sorted for a bar chart.
 *
 * Nothing in here is a number of its own. Each fuel is put through the engine
 * once, as "1 kg of the fuel", and the chart takes two of the rows that comes
 * back: the energy in kWh on the net (LHV) basis, and the kg of CO₂e. A CO₂e
 * per kWh figure is the second divided by the first. One kilogram is the
 * common ground because every fuel in the catalog can be taken to a mass,
 * while "1 kWh of diesel" cannot carry a per-litre emission factor in the
 * engine today (see docs/BUGS.md).
 *
 * A fuel the engine cannot answer is listed with the reason, never plotted as
 * 0 — and CO₂ is never offered as CO₂e. The three guards below keep the
 * chart's caption true as the catalog grows: a fuel with several CO₂e factors,
 * or with one that is not a direct-combustion figure (the roadmap has
 * well-to-wheel factors coming), drops out of the chart instead of being
 * silently picked or silently mixed in.
 *
 * Framework-free: no Svelte imports (AGENTS.md).
 */

import Decimal from 'decimal.js';
import { combineExactness } from '#lib/conversion/precision.js';
import { formatValue } from '#lib/formatting/numbers.js';
import { allEmissionFactors, allFuels, engine } from '#lib/ui/engine.js';
import type {
	ConversionResult,
	Converter,
	EmissionFactor,
	Exactness,
	Fuel,
	Scope,
	SourceRef
} from '#lib/conversion/types.js';

export type FuelChartMetric = 'co2e_per_kwh' | 'kwh_per_kg';

export interface FuelChartMetricInfo {
	id: FuelChartMetric;
	/** The choice in the metric switch. */
	label: string;
	/** What the bars measure, as a heading for the list. */
	title: string;
	/** Printed after each value. */
	unit: string;
}

export const FUEL_CHART_METRICS: readonly FuelChartMetricInfo[] = [
	{
		id: 'co2e_per_kwh',
		label: 'CO₂e per kWh',
		title: 'CO₂e per kWh of fuel energy',
		unit: 'g/kWh'
	},
	{ id: 'kwh_per_kg', label: 'Energy per kg', title: 'Energy per kilogram of fuel', unit: 'kWh/kg' }
];

export interface FuelChartRow {
	fuelId: string;
	name: string;
	category: string;
	/** The value as the engine would print it: significant figures and `~` by exactness. */
	value: string;
	/** Full-precision decimal string; the bar length comes from this. */
	raw: string;
	exactness: Exactness;
	/** Bar length as a fraction of the largest value in the chart, 0–1. */
	share: number;
	/**
	 * Biogenic CO₂ per kWh, for fuels whose CO₂e figure leaves it out (wood,
	 * biofuels). A separate quantity in the catalog, shown next to the bar and
	 * never added to it.
	 */
	biogenic?: { value: string; raw: string };
	source_refs: SourceRef[];
}

export interface FuelChartOmission {
	reason: string;
	fuels: { fuelId: string; name: string }[];
}

export interface FuelChart {
	metric: FuelChartMetric;
	rows: FuelChartRow[];
	/** The fuels not plotted, grouped by why. */
	omitted: FuelChartOmission[];
	/** Every source behind a plotted figure, in order of first use. */
	sources: SourceRef[];
	/** "UK 2025": the region and year of the plotted emission factors (CO₂e metric only). */
	factorLabels: string[];
}

/** Both charts, by metric. */
export interface FuelCharts {
	co2e_per_kwh: FuelChart;
	kwh_per_kg: FuelChart;
}

export interface FuelChartInput {
	converter: Converter;
	fuels: readonly Fuel[];
	emissionFactors: readonly EmissionFactor[];
}

/** Scopes whose CO₂e figure is what burning the fuel releases, nothing upstream. */
const DIRECT_SCOPES: ReadonlySet<Scope> = new Set(['direct_combustion', 'scope_1']);

const KWH_UNIT = 'kilowatt_hour';
const KG_CO2E = 'kilogram_co2e';
const KG_CO2 = 'kilogram_co2';

const REASON = {
	unresolved: 'the converter could not look this fuel up by name',
	noLhv: 'no net (LHV) heating value in the catalog',
	gridMix: 'emissions depend on the country and the year; there is no single figure',
	noFactor: 'no CO₂e factor in the catalog',
	co2Only: 'the catalog has a CO₂ factor but no CO₂e factor, and CO₂ and CO₂e are never mixed',
	co2Zero: 'burning it releases no CO₂, but the catalog has no CO₂e figure for it',
	several: 'the catalog holds several CO₂e factors for it, and the chart does not pick one',
	notDirect: 'its CO₂e factor is not a direct-combustion figure',
	notComputable: 'the converter cannot take it from a mass to CO₂e with the catalog data'
} as const;

type Outcome = { row: Omit<FuelChartRow, 'share'>; factor?: EmissionFactor } | { reason: string };

/** What the engine says about "1 kg of this fuel", reduced to the rows the chart reads. */
interface Probe {
	/** Net-basis energy for the kilogram; absent when the catalog cannot give one. */
	energy?: ConversionResult;
	emissions: ConversionResult[];
}

function probe(converter: Converter, fuel: Fuel): Probe | undefined {
	const out = converter.convertText(`1 kg ${fuel.names[0]} to kWh`, { basis: 'lhv' });
	// The name must find this very fuel: a name that resolves to a neighbour would
	// plot the neighbour's numbers under this fuel's label.
	if ('error' in out || out.input.fuel_id !== fuel.id) return undefined;
	const rows = out.groups.flatMap((g) => g.results);
	return {
		energy: rows.find(
			(r) =>
				r.category === 'energy' && r.unit_id === KWH_UNIT && r.basis === 'lhv' && r.raw !== null
		),
		emissions: rows.filter((r) => r.category === 'emissions')
	};
}

const isBiogenic = (r: ConversionResult): boolean =>
	r.warnings.some((w) => w.kind === 'biogenic_co2');

function positive(raw: string | null | undefined): Decimal | undefined {
	if (!raw) return undefined;
	const d = new Decimal(raw);
	return d.isFinite() && d.gt(0) ? d : undefined;
}

function build(
	fuel: Fuel,
	raw: Decimal,
	exactness: Exactness,
	source_refs: SourceRef[],
	biogenic?: { raw: Decimal; exactness: Exactness }
): Omit<FuelChartRow, 'share'> {
	return {
		fuelId: fuel.id,
		name: fuel.names[0],
		category: fuel.category,
		value: formatValue(raw.toFixed(), exactness),
		raw: raw.toFixed(),
		exactness,
		biogenic: biogenic
			? {
					value: formatValue(biogenic.raw.toFixed(), biogenic.exactness),
					raw: biogenic.raw.toFixed()
				}
			: undefined,
		source_refs
	};
}

function energyPerKg(fuel: Fuel, p: Probe | undefined): Outcome {
	if (!p) return { reason: REASON.unresolved };
	const kwh = positive(p.energy?.raw);
	if (!p.energy || !kwh) return { reason: REASON.noLhv };
	return { row: build(fuel, kwh, p.energy.exactness, p.energy.source_refs) };
}

function co2ePerKwh(fuel: Fuel, p: Probe | undefined, factors: readonly EmissionFactor[]): Outcome {
	if (!p) return { reason: REASON.unresolved };
	// Grid electricity: the engine itself says what it still needs.
	if (p.emissions.some((r) => r.missing?.includes('region'))) return { reason: REASON.gridMix };
	const kwh = positive(p.energy?.raw);
	if (!p.energy || !kwh) return { reason: REASON.noLhv };

	const own = factors.filter((f) => fuel.emission_factor_ids?.includes(f.id));
	const co2eFactors = own.filter((f) => f.pollutant === 'CO2e' && !f.biogenic);
	if (co2eFactors.length === 0) {
		const co2 = p.emissions.filter((r) => r.unit_id === KG_CO2 && r.raw !== null && !isBiogenic(r));
		if (co2.length === 0) return { reason: REASON.noFactor };
		return {
			reason: co2.every((r) => new Decimal(r.raw ?? 'NaN').isZero())
				? REASON.co2Zero
				: REASON.co2Only
		};
	}
	if (co2eFactors.length > 1) return { reason: REASON.several };
	const factor = co2eFactors[0];
	if (!DIRECT_SCOPES.has(factor.scope)) return { reason: REASON.notDirect };

	const co2e = p.emissions.filter((r) => r.unit_id === KG_CO2E && r.raw !== null);
	const perKg = co2e.length === 1 ? positive(co2e[0].raw) : undefined;
	if (!perKg) return { reason: REASON.notComputable };

	const exactness = combineExactness(co2e[0].exactness, p.energy.exactness);
	const perKwh = (kg: Decimal) => kg.div(kwh).times(1000);

	// Biogenic CO₂, when the catalog reports it for this fuel: kept beside the bar.
	const bio = p.emissions.filter((r) => r.unit_id === KG_CO2 && isBiogenic(r));
	const bioKg = bio.length === 1 ? positive(bio[0].raw) : undefined;
	const biogenic =
		bio.length === 1 && bioKg
			? {
					raw: perKwh(bioKg),
					exactness: combineExactness(bio[0].exactness, p.energy.exactness)
				}
			: undefined;

	return {
		row: build(
			fuel,
			perKwh(perKg),
			exactness,
			[...new Set([...co2e[0].source_refs, ...p.energy.source_refs])],
			biogenic
		),
		factor
	};
}

function assemble(
	metric: FuelChartMetric,
	fuels: readonly Fuel[],
	outcomes: readonly Outcome[]
): FuelChart {
	const plotted: { row: Omit<FuelChartRow, 'share'>; factor?: EmissionFactor }[] = [];
	const byReason = new Map<string, FuelChartOmission>();
	fuels.forEach((fuel, i) => {
		const o = outcomes[i];
		if ('row' in o) {
			plotted.push(o);
			return;
		}
		const group = byReason.get(o.reason) ?? { reason: o.reason, fuels: [] };
		group.fuels.push({ fuelId: fuel.id, name: fuel.names[0] });
		byReason.set(o.reason, group);
	});

	plotted.sort(
		(a, b) => new Decimal(b.row.raw).cmp(a.row.raw) || a.row.name.localeCompare(b.row.name)
	);
	const largest = plotted.length > 0 ? new Decimal(plotted[0].row.raw) : new Decimal(1);

	const labels = plotted.flatMap(({ factor }) =>
		factor?.region ? [[factor.region, factor.year].filter((x) => x !== undefined).join(' ')] : []
	);
	return {
		metric,
		rows: plotted.map(({ row }) => ({
			...row,
			share: new Decimal(row.raw).div(largest).toNumber()
		})),
		omitted: [...byReason.values()],
		sources: [...new Set(plotted.flatMap(({ row }) => row.source_refs))],
		factorLabels: [...new Set(labels)]
	};
}

function defaultInput(): FuelChartInput {
	return { converter: engine(), fuels: allFuels(), emissionFactors: allEmissionFactors() };
}

/** Both charts, from one pass of the engine over the catalog. */
export function fuelCharts(input: FuelChartInput = defaultInput()): FuelCharts {
	const fuels = input.fuels;
	const probes = fuels.map((fuel) => probe(input.converter, fuel));
	return {
		co2e_per_kwh: assemble(
			'co2e_per_kwh',
			fuels,
			fuels.map((fuel, i) => co2ePerKwh(fuel, probes[i], input.emissionFactors))
		),
		kwh_per_kg: assemble(
			'kwh_per_kg',
			fuels,
			fuels.map((fuel, i) => energyPerKg(fuel, probes[i]))
		)
	};
}
