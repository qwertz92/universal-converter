/**
 * Small fuel-domain helpers shared across the fuel pipeline.
 */

import type { Fuel } from '$lib/conversion/types';

/** Electricity is modeled as a "fuel" for routing, but is context_required for CO2e. */
export function isElectricity(fuel: Fuel): boolean {
	return fuel.category === 'electricity' || fuel.id === 'electricity';
}

/** Hydrogen gets the "combustion CO2 = 0" treatment (rulebook §C.5, §D.15). */
export function isHydrogen(fuel: Fuel): boolean {
	return fuel.category === 'hydrogen' || fuel.id === 'hydrogen';
}

/** Whether the fuel is (partly) biogenic — its biogenic CO2 is reported separately. */
export function isBiogenic(fuel: Fuel): boolean {
	return fuel.category === 'biomass' || fuel.category === 'biofuel';
}
