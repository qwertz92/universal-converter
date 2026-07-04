/**
 * Emission-factor application (rulebook §C.5). Turns a fuel amount into a GHG
 * mass using a cited factor. CO2 and CO2e are computed from SEPARATE factors —
 * CO2e is never derived from CO2. Biogenic CO2 is carried through as its own
 * pollutant so the engine can report it on a separate line (§C.5, §D.14).
 *
 * A factor's `metric` + `unit` tell us what physical amount it multiplies:
 *  - mass_per_volume  (kg_co2_per_l, kg_co2_per_m3,
 *                      kg_co2e_per_l, kg_co2e_per_m3)  → needs volume
 *  - mass_per_mass    (kg_co2_per_kg, kg_co2e_per_kg)  → needs mass
 *  - mass_per_energy  (kg_co2_per_gj, g_co2_per_kwh,
 *                      g_co2e_per_kwh)                 → needs energy (basis-labeled)
 *
 * The CO2 and CO2e unit families are handled by SEPARATE cases and SEPARATE data
 * factors; CO2e is never derived from CO2 (rulebook §C.5, §D.6).
 */

import Decimal from 'decimal.js';
import type { EmissionFactor } from '$lib/conversion/types';

Decimal.set({ precision: 40 });

export type FactorInputKind = 'volume' | 'mass' | 'energy';

interface FactorSpec {
	inputKind: FactorInputKind;
	/** Convert the input amount (in the factor's expected input unit) — see below. */
	inputUnitToFactorBasis: (amount: Decimal) => Decimal;
	/** Output GHG mass unit (kg / g / t) the factor produces. */
	outputMassScaleToKg: Decimal;
	displayUnit: string;
}

/**
 * Interpret a factor's `unit`. Input amounts are supplied to `applyFactor` in
 * SI base units (m³ for volume, kg for mass, J for energy); we rescale to the
 * factor's expected input unit here.
 */
function specForUnit(unit: string): FactorSpec | undefined {
	switch (unit) {
		// mass per volume (kg CO2 per L / per m³)
		case 'kg_co2_per_l':
			// input given in m³ → L = ×1000; output kg
			return {
				inputKind: 'volume',
				inputUnitToFactorBasis: (a) => a.times(1000),
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2'
			};
		case 'kg_co2_per_m3':
			return {
				inputKind: 'volume',
				inputUnitToFactorBasis: (a) => a,
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2'
			};
		// mass per mass (kg CO2 per kg fuel)
		case 'kg_co2_per_kg':
			return {
				inputKind: 'mass',
				inputUnitToFactorBasis: (a) => a,
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2'
			};
		// CO2e variants (kg CO2e per L / m³ / kg). Separate factors from the CO2
		// ones — CO2e is NEVER derived from CO2 (rulebook §C.5, §D.6); the engine
		// keeps them apart by pollutant and by output unit id (kilogram_co2e).
		case 'kg_co2e_per_l':
			return {
				inputKind: 'volume',
				inputUnitToFactorBasis: (a) => a.times(1000),
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2e'
			};
		case 'kg_co2e_per_m3':
			return {
				inputKind: 'volume',
				inputUnitToFactorBasis: (a) => a,
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2e'
			};
		case 'kg_co2e_per_kg':
			return {
				inputKind: 'mass',
				inputUnitToFactorBasis: (a) => a,
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2e'
			};
		// mass per energy
		case 'kg_co2_per_gj':
			// input given in J → GJ = /1e9; output kg
			return {
				inputKind: 'energy',
				inputUnitToFactorBasis: (a) => a.div('1e9'),
				outputMassScaleToKg: new Decimal(1),
				displayUnit: 'kg CO2'
			};
		case 'g_co2_per_kwh':
			// input J → kWh = /3.6e6; output g → kg = /1000
			return {
				inputKind: 'energy',
				inputUnitToFactorBasis: (a) => a.div('3600000'),
				outputMassScaleToKg: new Decimal('0.001'),
				displayUnit: 'kg CO2'
			};
		case 'g_co2e_per_kwh':
			return {
				inputKind: 'energy',
				inputUnitToFactorBasis: (a) => a.div('3600000'),
				outputMassScaleToKg: new Decimal('0.001'),
				displayUnit: 'kg CO2e'
			};
		default:
			return undefined;
	}
}

export interface AppliedFactor {
	/** GHG mass in kg (of the factor's pollutant). */
	massKg: string;
	factor: EmissionFactor;
	displayUnit: string;
	inputKind: FactorInputKind;
}

/**
 * Apply an emission factor to an input amount in SI base units.
 * `amountBase` is m³ (volume), kg (mass) or J (energy) per the factor's kind.
 * Returns undefined if the factor's unit is unrecognised (caller marks n/a).
 */
export function applyFactor(factor: EmissionFactor, amountBase: string): AppliedFactor | undefined {
	const spec = specForUnit(factor.unit);
	if (!spec) return undefined;
	const inputInFactorBasis = spec.inputUnitToFactorBasis(new Decimal(amountBase));
	const massInFactorUnit = inputInFactorBasis.times(new Decimal(factor.value));
	const massKg = massInFactorUnit.times(spec.outputMassScaleToKg).toFixed();
	return { massKg, factor, displayUnit: spec.displayUnit, inputKind: spec.inputKind };
}

/** The SI-base input kind a factor consumes (volume→m³, mass→kg, energy→J). */
export function factorInputKind(factor: EmissionFactor): FactorInputKind | undefined {
	return specForUnit(factor.unit)?.inputKind;
}
