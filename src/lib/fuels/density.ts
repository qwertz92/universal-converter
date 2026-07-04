/**
 * Volume ↔ mass via fuel density (rulebook §B.3: `m = V·ρ`). Density is a fuel
 * property from data or the user; the result is `source_based` (or
 * `user_assumption` when the user supplied it), never `exact`.
 */

import Decimal from 'decimal.js';
import type { Assumption, Density, Fuel } from '$lib/conversion/types';

Decimal.set({ precision: 40 });

export interface DensityResolved {
	/** Density expressed in kg per m³ (SI), for dimension-consistent arithmetic. */
	kgPerM3: string;
	assumption: Assumption;
	source_refs: string[];
}

/**
 * Resolve a fuel's density to kg/m³. The density.unit tells us the stored basis;
 * v0.1 supports the two units the Data agent uses: "kg_per_l" and "kg_per_m3".
 * Returns undefined when the fuel has no density (→ engine emits context_required
 * / "not available" rather than inventing one).
 */
export function resolveDensity(fuel: Fuel): DensityResolved | undefined {
	const d = fuel.density;
	if (!d) return undefined;
	const kgPerM3 = densityToKgPerM3(d);
	if (kgPerM3 === undefined) return undefined;
	const assumption: Assumption = {
		kind: 'density',
		text: `assumed ${fuel.names[0]} density ${d.value} ${displayDensityUnit(d.unit)}${
			d.reference_conditions ? ` at ${d.reference_conditions}` : ''
		}`,
		value: d.value,
		unit: d.unit,
		source_refs: d.source_refs
	};
	return { kgPerM3, assumption, source_refs: d.source_refs };
}

function densityToKgPerM3(d: Density): string | undefined {
	const v = new Decimal(d.value);
	switch (d.unit) {
		case 'kg_per_l':
			return v.times(1000).toFixed(); // kg/L → kg/m³
		case 'kg_per_m3':
			return v.toFixed();
		case 'g_per_cm3':
			return v.times(1000).toFixed(); // g/cm³ = kg/L → kg/m³
		default:
			return undefined;
	}
}

function displayDensityUnit(unit: string): string {
	switch (unit) {
		case 'kg_per_l':
			return 'kg/L';
		case 'kg_per_m3':
			return 'kg/m³';
		case 'g_per_cm3':
			return 'g/cm³';
		default:
			return unit;
	}
}

/** mass(kg) = volume(m³) × density(kg/m³). */
export function volumeToMassKg(volumeM3: string, kgPerM3: string): string {
	return new Decimal(volumeM3).times(new Decimal(kgPerM3)).toFixed();
}

/** volume(m³) = mass(kg) / density(kg/m³). */
export function massToVolumeM3(massKg: string, kgPerM3: string): string {
	return new Decimal(massKg).div(new Decimal(kgPerM3)).toFixed();
}
