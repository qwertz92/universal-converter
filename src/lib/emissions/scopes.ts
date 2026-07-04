/**
 * Scope / system-boundary labels and their human-readable descriptions
 * (spec §7.4, rulebook §C.5). Every emission result states its scope explicitly;
 * `unknown_or_mixed` is only ever shown clearly marked.
 */

import type { Pollutant, Scope } from '$lib/conversion/types';

export const SCOPE_LABEL: Record<Scope, string> = {
	direct_combustion: 'direct combustion',
	scope_1: 'Scope 1 (direct)',
	scope_2: 'Scope 2 (purchased energy)',
	scope_3_upstream: 'Scope 3 upstream',
	well_to_tank: 'well-to-tank (upstream)',
	tank_to_wheel: 'tank-to-wheel (combustion)',
	well_to_wheel: 'well-to-wheel (lifecycle)',
	unknown_or_mixed: 'unknown / mixed boundary'
};

export const POLLUTANT_LABEL: Record<Pollutant, string> = {
	CO2: 'CO2',
	CH4: 'CH4',
	N2O: 'N2O',
	CO2e: 'CO2e',
	biogenic_CO2: 'biogenic CO2'
};

/** Whether a pollutant is a CO2e-family metric (kept separate from CO2 family). */
export function isCo2eMetric(p: Pollutant): boolean {
	return p === 'CO2e';
}

/** Whether a pollutant is direct CO2 (fossil), excluding biogenic + CO2e. */
export function isFossilCo2(p: Pollutant): boolean {
	return p === 'CO2';
}
