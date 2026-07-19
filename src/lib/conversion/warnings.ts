/**
 * Reusable warning/assumption constructors (rulebook §C.2, §C.3, §C.5, §D).
 * Centralised so wording stays consistent and testable.
 */

import type { Warning } from './types';

// NOTE: the gas-billing / reference-condition / phase warnings users see come
// from the fuel catalog's own `warnings[]` entries (data-driven, kind
// 'fuel_warning'); dedicated builders for them were removed as dead duplicates.

export function boeConventionWarning(): Warning {
	return {
		kind: 'boe_convention',
		severity: 'info',
		text:
			'boe uses the 5.8 MMBTU (US/IRS) convention (≈ 6.12 GJ). Other conventions exist ' +
			'(e.g. IEA’s ~7.15–7.40 boe per toe imply a slightly different value). A boe is an ' +
			'energy-equivalence unit, not the measured energy of a specific physical barrel.'
	};
}

export function biogenicCo2Warning(): Warning {
	return {
		kind: 'biogenic_co2',
		severity: 'info',
		text:
			'Biogenic CO2 is reported on its own line, outside the main scopes. The carbon is ' +
			'still emitted at the stack; the separate accounting reflects the biological carbon ' +
			'cycle (IPCC / GHG Protocol convention), not a claim of zero physical emission.'
	};
}

export function hydrogenCombustionWarning(): Warning {
	return {
		kind: 'hydrogen_combustion_only',
		severity: 'caution',
		text:
			'Combustion only: H₂ contains no carbon, so direct-combustion CO2 = 0. Upstream ' +
			'emissions depend entirely on the production pathway (grey/SMR, blue, green) and are ' +
			'NOT included here — a bare "hydrogen = 0 CO2" is not a lifecycle claim.'
	};
}

export function representativeValueWarning(): Warning {
	return {
		kind: 'representative_value',
		severity: 'info',
		text:
			'Fuel properties are representative, sourced values — not a measurement of your ' +
			'specific fuel batch. Real densities, heating values and emission factors vary with ' +
			'grade, composition, temperature and source.'
	};
}
