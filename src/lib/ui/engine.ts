/**
 * UI-facing facade over the conversion engine + data catalog. Everything the
 * pages/components need to read from the engine and the data bundle goes through
 * here so components never import engine internals directly (spec §4.1: SvelteKit
 * is presentation only).
 *
 * The catalog getters power the /units, /fuels, /sources index + detail pages and
 * the searchable comboboxes. All are pure reads of the validated data bundle; the
 * bundle may be sparse (e.g. an empty fuel catalog) and callers must handle that.
 */

import { getConverter, loadDataBundle } from '$lib';
import { factorInputKind } from '$lib/emissions/factors';
import type { Converter, DataBundle, Fuel, Source, Unit, Dimension } from '$lib/conversion/types';

let _bundle: DataBundle | undefined;

function bundle(): DataBundle {
	if (!_bundle) _bundle = loadDataBundle();
	return _bundle;
}

/** The shared converter instance. */
export function engine(): Converter {
	return getConverter();
}

/* ------------------------------------------------------------------ *
 * Units
 * ------------------------------------------------------------------ */

export function allUnits(): Unit[] {
	return bundle().units;
}

export function unitById(id: string): Unit | undefined {
	return bundle().units.find((u) => u.id === id);
}

/** Human-readable dimension label for grouping (index pages, comboboxes). */
export const DIMENSION_LABEL: Record<Dimension, string> = {
	energy: 'Energy',
	power: 'Power',
	mass: 'Mass',
	volume: 'Volume',
	time: 'Time',
	emission_mass_co2: 'CO₂ mass',
	emission_mass_co2e: 'CO₂e mass',
	energy_density_mass: 'Energy density (per mass)',
	energy_density_volume: 'Energy density (per volume)',
	emission_intensity: 'Emission intensity',
	mass_density: 'Density (mass per volume)'
};

/** Order dimensions are shown in on index pages. */
export const DIMENSION_ORDER: Dimension[] = [
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
];

/* ------------------------------------------------------------------ *
 * Fuels
 * ------------------------------------------------------------------ */

export function allFuels(): Fuel[] {
	return bundle().fuels;
}

export function fuelById(id: string): Fuel | undefined {
	return bundle().fuels.find((f) => f.id === id);
}

/* ------------------------------------------------------------------ *
 * Grid electricity factors (rulebook §C.6, roadmap 0.2)
 * ------------------------------------------------------------------ */

/** One selectable region/year grid-intensity option, straight from the catalog. */
export interface GridIntensityOption {
	region: string;
	year: number;
	/** The factor's metric — 'CO2' and 'CO2e' stay visually distinct (§D.6). */
	pollutant: string;
	value: string;
	unit: string;
	source_id: string;
}

/**
 * Region/year combinations for which a cited, energy-based grid factor exists.
 * Data-driven: derived from the electricity fuel's emission_factor_ids — the
 * UI never offers a combination the engine cannot answer.
 */
export function gridIntensityOptions(): GridIntensityOption[] {
	const b = bundle();
	const electricity = b.fuels.find((f) => f.category === 'electricity');
	if (!electricity) return [];
	const byId = new Map(b.emissionFactors.map((f) => [f.id, f]));
	const out: GridIntensityOption[] = [];
	for (const id of electricity.emission_factor_ids ?? []) {
		const f = byId.get(id);
		if (!f || !f.region || f.year === undefined) continue;
		if (factorInputKind(f) !== 'energy') continue;
		out.push({
			region: f.region,
			year: f.year,
			pollutant: f.pollutant,
			value: f.value,
			unit: f.unit,
			source_id: f.source_id
		});
	}
	return out.sort((a, b2) => a.region.localeCompare(b2.region) || b2.year - a.year);
}

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */

export function allSources(): Source[] {
	return bundle().sources;
}

export function sourceById(id: string): Source | undefined {
	return bundle().sources.find((s) => s.id === id);
}

/** Resolve a list of source_refs into full Source objects (dropping unknowns). */
export function resolveSources(refs: string[] | undefined): Source[] {
	if (!refs || refs.length === 0) return [];
	const out: Source[] = [];
	const seen = new Set<string>();
	for (const ref of refs) {
		if (seen.has(ref)) continue;
		seen.add(ref);
		const s = sourceById(ref);
		if (s) out.push(s);
	}
	return out;
}
