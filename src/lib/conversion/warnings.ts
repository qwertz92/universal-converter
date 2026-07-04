/**
 * Reusable warning/assumption constructors (rulebook §C.2, §C.3, §C.5, §D).
 * Centralised so wording stays consistent and testable.
 */

import type { Warning } from './types';

export function gasBillingWarning(): Warning {
	return {
		kind: 'gas_billing',
		severity: 'critical',
		text:
			'This is NOT how a gas bill is calculated. The tool does not know your local ' +
			'calorific value (Brennwert) or your meter’s state number (Zustandszahl / correction ' +
			'factor) that maps operating-condition m³ to reference-condition energy. Use your ' +
			'supplier’s invoice and meter data for an exact figure; do not use this for billing disputes.'
	};
}

export function gasReferenceConditionWarning(condition: string): Warning {
	return {
		kind: 'gas_reference_condition',
		severity: 'caution',
		text:
			`Gas volume is taken at ${condition}. A "normal" m³ (0 °C), a "standard" m³ ` +
			'(15/25 °C) and your operating-condition m³ are different volumes; the tool does ' +
			'not treat them as interchangeable.'
	};
}

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

export function phaseDistinctionWarning(phase: string): Warning {
	return {
		kind: 'phase_distinction',
		severity: 'caution',
		text:
			`This result is for the ${phase} phase. Liquefied natural gas (LNG) and gaseous ` +
			'natural gas are not interchangeable by volume (~600× different energy per volume); ' +
			'conversions go through mass/energy, never m³-LNG ↔ m³-gas directly.'
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
