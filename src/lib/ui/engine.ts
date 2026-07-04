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
import type {
	Converter,
	DataBundle,
	Fuel,
	Source,
	Unit,
	BaseDimension,
	Dimension
} from '$lib/conversion/types';

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

/** Dimensions a user can pick as a conversion target in the structured combobox. */
export const CONVERTIBLE_DIMENSIONS: BaseDimension[] = [
	'energy',
	'power',
	'mass',
	'volume',
	'time'
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

/** Distinct fuel categories present in the catalog, in first-seen order. */
export function fuelCategories(): string[] {
	const seen: string[] = [];
	for (const f of bundle().fuels) if (!seen.includes(f.category)) seen.push(f.category);
	return seen;
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
