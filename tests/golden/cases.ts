/**
 * GOLDEN TEST CASES (spec §13.6) — end-to-end input -> expected key results,
 * checked against the REAL, shipped data catalog (data/fuels.json,
 * data/emission-factors.json, data/units.json), not a synthetic fixture.
 *
 * Every case's expected numbers are DERIVED BY HAND from the catalog and
 * commented with the source_id + arithmetic, so a silent data or engine
 * regression (wrong factor, wrong basis, wrong unit conversion) is caught
 * here even if the unit tests elsewhere only check shapes/behaviour.
 *
 * Tolerance policy:
 *  - `exact_raw`: assert the full-precision `raw` decimal string EXACTLY
 *    (used for exact/standard_definition conversions with a closed-form value).
 *  - `tolerance`: assert `Number(raw)` is within `tolerance` (absolute) of
 *    `expected` (used for source-based/region_year_specific values, since the
 *    engine's decimal.js division can carry many non-terminating digits).
 *  - Never exact-equality on a source-based estimate (rulebook §C.7) — even
 *    though the DESNZ inputs are finite decimals, the ENGINE's derived ratios
 *    (e.g. mass from volume x density) are asserted with tolerance so this
 *    fixture doesn't silently encode float/rounding-mode assumptions.
 */

import type { Exactness, ResultGroupKey } from '$lib/conversion/types';

export interface GoldenCheck {
	/** Which result to find: category + unit_id (unit_id '' matches pseudo-groups). */
	category: ResultGroupKey;
	unit_id: string;
	/** Expect this exact exactness level. */
	exactness: Exactness;
	/** Present (not null) vs absent (null) value, when that alone is the point. */
	valueIsNull?: boolean;
	/** Exact full-precision decimal string match (for closed-form exact conversions). */
	exactRaw?: string;
	/** Numeric expectation with an absolute tolerance (for source-based/derived values). */
	expected?: number;
	tolerance?: number;
	/** Regex the result's source_refs must contain at least one match for. */
	sourceRefIncludes?: string;
	/** Regex applied to warnings (joined text) of the whole result set. */
	warningTextMatches?: RegExp;
	/** Regex applied to this result's own formula/explanation, if present. */
	formulaMatches?: RegExp;
	/**
	 * When a category+unit_id pair has multiple rows (e.g. LHV primary + HHV
	 * secondary energy in the same target unit), pick the Nth match (0-based)
	 * rather than the first. Rows appear in the order the engine emits them:
	 * primary basis first, secondary basis second (rulebook §C.1).
	 */
	nth?: number;
}

export interface GoldenCase {
	id: string;
	/** Free-text input, as a user would type it. */
	input: string;
	/** Engine options (basis toggle, time, region/year), if any. */
	options?: { basis?: 'lhv' | 'hhv'; region?: string; year?: number };
	/** Human documentation: which source_id(s) and what arithmetic produced `expected`. */
	derivation: string;
	checks: GoldenCheck[];
}

export const GOLDEN_CASES: GoldenCase[] = [
	// ---------------------------------------------------------------- *
	// Pure energy (exact / standard_definition), spec §13.1/§13.6
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-kwh-exact',
		input: '1 kWh',
		derivation: '1 kWh = 3.6 MJ exactly (SI prefix identity, no source needed).',
		checks: [
			{ category: 'energy', unit_id: 'megajoule', exactness: 'exact', exactRaw: '3.6' },
			{ category: 'energy', unit_id: 'joule', exactness: 'exact', exactRaw: '3600000' }
		]
	},
	{
		id: 'golden-1-mwh-exact',
		input: '1 MWh',
		derivation: '1 MWh = 3.6 GJ exactly.',
		checks: [{ category: 'energy', unit_id: 'gigajoule', exactness: 'exact', exactRaw: '3.6' }]
	},
	{
		id: 'golden-1-toe-standard-definition',
		input: '1 toe',
		derivation:
			'iea-unit-conventions: 1 toe = 41.868 GJ exactly (IEA/OECD convention, standard_definition).',
		checks: [
			{
				category: 'energy',
				unit_id: 'gigajoule',
				exactness: 'standard_definition',
				exactRaw: '41.868'
			}
		]
	},
	{
		id: 'golden-1-boe-standard-definition',
		input: '1 boe',
		derivation:
			'nist-sp811 / spec-conversion-rules: 1 boe = 5.8 MMBTU_IT = 5.8 x 1,055,055,852.62 J ' +
			'= 6,119,323,945.196 J = 6119.323945196 MJ (US/IRS convention, standard_definition). ' +
			'Computed independently here from the IT BTU definition, matching units.json boe.to_base_factor.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'standard_definition',
				exactRaw: '6119.323945196'
			},
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'standard_definition',
				warningTextMatches: /5\.8 MMBTU/
			}
		]
	},
	{
		id: 'golden-1000-kcal',
		input: '1000 kcal',
		derivation: '1 kcal_IT = 4186.8 J (nist-sp811) => 1000 kcal = 4,186,800 J = 4.1868 MJ exactly.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'standard_definition',
				exactRaw: '4.1868'
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Power -> context_required (never silent kWh), spec §9.1/§13.6
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-kw-context-required',
		input: '1 kW',
		derivation: 'Power has no energy without a time input (rulebook D.1) — no number, ever.',
		checks: [
			{
				category: 'energy',
				unit_id: 'kilowatt_hour',
				exactness: 'context_required',
				valueIsNull: true
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Diesel: volume -> mass, volume -> energy (LHV + HHV), CO2 + CO2e
	// Source: uk-desnz-ghg-2025, "Diesel (average biofuel blend)"
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-l-diesel-mass',
		input: '1 liter diesel',
		derivation:
			'uk-desnz-ghg-2025 diesel density = 832.361 kg/m3 = 0.832361 kg/L. ' +
			'mass = 1 L x 0.832361 kg/L = 0.832361 kg.',
		checks: [
			{
				category: 'mass',
				unit_id: 'kilogram',
				exactness: 'source_based',
				expected: 0.832361,
				tolerance: 0.0000005,
				sourceRefIncludes: 'uk-desnz-ghg-2025'
			}
		]
	},
	{
		id: 'golden-1-l-diesel-energy-lhv',
		input: '1 liter diesel',
		derivation:
			'uk-desnz-ghg-2025 diesel Net CV (LHV) = 9.905 kWh/L (default basis, rulebook C.1). ' +
			'energy = 1 L x 9.905 kWh/L = 9.905 kWh = 9.905 x 3.6 MJ = 35.658 MJ.',
		checks: [
			{
				category: 'energy',
				unit_id: 'kilowatt_hour',
				exactness: 'source_based',
				expected: 9.905,
				tolerance: 0.0005,
				sourceRefIncludes: 'uk-desnz-ghg-2025'
			},
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 35.658,
				tolerance: 0.002,
				formulaMatches: /LHV\/NCV/
			}
		]
	},
	{
		id: 'golden-1-l-diesel-energy-hhv-secondary',
		input: '1 liter diesel',
		derivation:
			'uk-desnz-ghg-2025 diesel Gross CV (HHV) = 10.531 kWh/L, shown ALONGSIDE the LHV default ' +
			'(rulebook C.1 rule 2) = 10.531 x 3.6 = 37.9116 MJ.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 37.9116,
				tolerance: 0.002,
				formulaMatches: /HHV\/GCV/,
				nth: 1
			}
		]
	},
	{
		id: 'golden-1-l-diesel-co2',
		input: '1 liter diesel',
		derivation: 'uk-desnz-ghg-2025 diesel CO2 component = 2.53763 kg CO2 / L (direct combustion).',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2',
				exactness: 'region_year_specific',
				expected: 2.53763,
				tolerance: 0.00005,
				sourceRefIncludes: 'uk-desnz-ghg-2025'
			}
		]
	},
	{
		id: 'golden-1-l-diesel-co2e-differs-from-co2',
		input: '1 liter diesel',
		derivation:
			'uk-desnz-ghg-2025 diesel total CO2e = 2.57082 kg CO2e / L (CO2 2.53763 + CH4 0.00029 + ' +
			'N2O 0.0329) — DIFFERENT from the CO2-only figure 2.53763, both separately sourced ' +
			'(rulebook C.5, D.6: CO2e is never derived from CO2).',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2e',
				exactness: 'region_year_specific',
				expected: 2.57082,
				tolerance: 0.00005
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Gasoline: mass + energy + CO2/CO2e (spec §8.2 example)
	// Source: uk-desnz-ghg-2025, "Petrol (average biofuel blend)"
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-l-gasoline-mass',
		input: '1 L gasoline',
		derivation:
			'uk-desnz-ghg-2025 petrol density = 746.204 kg/m3 = 0.746204 kg/L => mass = 0.746204 kg.',
		checks: [
			{
				category: 'mass',
				unit_id: 'kilogram',
				exactness: 'source_based',
				expected: 0.746204,
				tolerance: 0.0000005
			}
		]
	},
	{
		id: 'golden-1-l-gasoline-energy',
		input: '1 L gasoline',
		derivation: 'uk-desnz-ghg-2025 petrol Net CV (LHV) = 8.926 kWh/L => 8.926 x 3.6 = 32.1336 MJ.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 32.1336,
				tolerance: 0.002,
				formulaMatches: /LHV\/NCV/
			}
		]
	},
	{
		id: 'golden-1-l-gasoline-co2',
		input: '1 L gasoline',
		derivation: 'uk-desnz-ghg-2025 petrol CO2 component = 2.05523 kg CO2 / L.',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2',
				exactness: 'region_year_specific',
				expected: 2.05523,
				tolerance: 0.00005
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Heating oil (spec §8.2 example)
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-l-heating-oil-energy',
		input: '1 liter heating oil',
		derivation:
			"uk-desnz-ghg-2025 'Fuel Oil' Net CV (LHV) = 11.131 kWh/L => 11.131 x 3.6 = 40.0716 MJ.",
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 40.0716,
				tolerance: 0.002
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Natural gas m3 -> energy: source_based (NEVER exact), + billing warning
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-m3-natural-gas-energy-lhv',
		input: '1 m3 natural gas',
		derivation:
			'uk-desnz-ghg-2025 natural gas volumetric Net CV (LHV) = 10.191 kWh/m3 (DERIVED by the ' +
			'Data agent from density 0.802 kg/m3 x 12.707 kWh/kg — noted in data/fuels.json).',
		checks: [
			{
				category: 'energy',
				unit_id: 'kilowatt_hour',
				exactness: 'source_based',
				expected: 10.191,
				tolerance: 0.001
			},
			{
				category: 'energy',
				unit_id: 'kilowatt_hour',
				exactness: 'source_based',
				warningTextMatches: /billing|Brennwert|Zustandszahl/i
			}
		]
	},
	{
		id: 'golden-1-m3-natural-gas-co2',
		input: '1 m3 natural gas',
		derivation: 'uk-desnz-ghg-2025 natural gas CO2 component = 2.0627 kg CO2 / m3.',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2',
				exactness: 'region_year_specific',
				expected: 2.0627,
				tolerance: 0.0001
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Hydrogen: LHV vs HHV divergence case (spec §13.3/§13.6), CO2 = 0
	// Source: h2tools / nist-webbook
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-kg-hydrogen-lhv',
		input: '1 kg hydrogen',
		derivation: 'h2tools LHV = 119.96 MJ/kg => 119.96 / 3.6 = 33.3222... kWh/kg.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 119.96,
				tolerance: 0.01,
				formulaMatches: /LHV\/NCV/
			},
			{
				category: 'energy',
				unit_id: 'kilowatt_hour',
				exactness: 'source_based',
				expected: 33.3222,
				tolerance: 0.001
			}
		]
	},
	{
		id: 'golden-1-kg-hydrogen-hhv-diverges-from-lhv',
		input: '1 kg hydrogen',
		options: { basis: 'hhv' },
		derivation:
			'h2tools/nist-webbook HHV = 141.79 MJ/kg — the user toggled basis=hhv, so HHV becomes ' +
			'the PRIMARY figure (141.79 MJ/kg, ~18% above the 119.96 MJ/kg LHV — the classic LHV/HHV ' +
			'divergence for hydrogen, rulebook D.2).',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 141.79,
				tolerance: 0.01,
				formulaMatches: /HHV\/GCV(?! —)/
			}
		]
	},
	{
		id: 'golden-1-kg-hydrogen-co2-zero',
		input: '1 kg hydrogen',
		derivation:
			'Direct combustion of H2 has no carbon => CO2 = 0 exactly (physical fact, not a factor lookup).',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2',
				exactness: 'exact',
				exactRaw: '0',
				warningTextMatches: /combustion only|upstream/i
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Wood pellets: biogenic CO2 separate line, Scope-1 CO2e excludes it
	// Source: uk-desnz-ghg-2025 Bioenergy / Outside of scopes
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-kg-wood-pellets-energy',
		input: '1 kg wood pellets',
		derivation: 'uk-desnz-ghg-2025 Wood Pellets Net CV (LHV) = 17.28 MJ/kg.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'source_based',
				expected: 17.28,
				tolerance: 0.001
			}
		]
	},
	{
		id: 'golden-1-kg-wood-pellets-biogenic',
		input: '1 kg wood pellets',
		derivation:
			"uk-desnz-ghg-2025 'Outside of scopes' biogenic combustion CO2 for Wood Pellets = " +
			'1.67718 kg CO2/kg — reported on its own line, distinct from the Scope-1 CO2e figure.',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2',
				exactness: 'region_year_specific',
				expected: 1.67718,
				tolerance: 0.0001,
				warningTextMatches: /biogenic/i
			}
		]
	},
	{
		id: 'golden-1-kg-wood-pellets-scope1-co2e',
		input: '1 kg wood pellets',
		derivation:
			'uk-desnz-ghg-2025 Wood Pellets Scope-1 CO2e (CH4+N2O only, biogenic CO2 netted to zero) ' +
			'= 0.05519389 kg CO2e/kg — much smaller than and independent of the 1.67718 biogenic figure.',
		checks: [
			{
				category: 'emissions',
				unit_id: 'kilogram_co2e',
				exactness: 'region_year_specific',
				expected: 0.05519389,
				tolerance: 0.000005
			}
		]
	},

	// ---------------------------------------------------------------- *
	// Crude oil barrel: graceful degradation, NOT an invented number
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-barrel-crude-oil-volume-exact',
		input: '1 barrel crude oil',
		derivation: '1 barrel = 158.987294928 L exactly (pure volume unit, no fuel context needed).',
		checks: [
			{
				category: 'volume',
				unit_id: 'liter',
				exactness: 'exact',
				exactRaw: '158.987294928'
			}
		]
	},
	{
		id: 'golden-1-barrel-crude-oil-mass-not-available',
		input: '1 barrel crude oil',
		derivation:
			'data/fuels.json crude-oil has NO density field (deliberately omitted — "not found in a ' +
			'serious primary source", data-model.md gap table) => mass must be context_required, ' +
			'never a guessed number.',
		checks: [{ category: 'mass', unit_id: '', exactness: 'context_required', valueIsNull: true }]
	},

	// ---------------------------------------------------------------- *
	// Electricity: context_required without region/year (spec §13.4/§9.6)
	// data/fuels.json HAS an "electricity" fuel entry (category "electricity").
	// "1 kWh electricity" parses against the real catalog: energy converts
	// exactly (1 kWh = 3.6 MJ, an SI identity), while emissions is
	// context_required (no region/year given) and surfaces both illustrative
	// examples wired via emission_factor_ids — UK 2025 CO2e (uk-desnz-ghg-2025)
	// and EU-27 2023 CO2 (eea-electricity-intensity). See
	// tests/golden/data-gaps.test.ts for the fuller documented probe (including
	// the region+year-supplied path) against the real data.
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-kwh-electricity-energy-exact-emissions-context-required',
		input: '1 kWh electricity',
		derivation:
			'Energy: 1 kWh = 3.6 MJ exactly (SI definitional identity, no fuel context needed). ' +
			'Emissions: data/fuels.json "electricity" fuel has no density/heating-value (pure grid ' +
			'commodity) and its emission_factor_ids reference two region+year-tagged illustrative ' +
			'factors (electricity-uk-2025-co2e, electricity-eu27-2023-co2) — with no region/year ' +
			'supplied, the engine returns context_required (missing region+year) and surfaces both ' +
			'as illustrative_examples rather than guessing a default grid.',
		checks: [
			{
				category: 'energy',
				unit_id: 'megajoule',
				exactness: 'exact',
				exactRaw: '3.6'
			},
			{
				category: 'emissions',
				unit_id: 'g_co2e_per_kwh',
				exactness: 'context_required',
				valueIsNull: true
			}
		]
	},

	// ---------------------------------------------------------------- *
	// toe/boe/tce fuel-equivalents for a plain energy input (spec §8.3/§C.8)
	// ---------------------------------------------------------------- *
	{
		id: 'golden-1-gj-toe-equivalent',
		input: '1 GJ',
		derivation: '1 GJ / 41.868 GJ per toe = 0.023884... toe (standard_definition, IEA convention).',
		checks: [
			{
				category: 'fuel_equivalents',
				unit_id: 'toe',
				exactness: 'standard_definition',
				expected: 0.0238845900447292,
				tolerance: 0.0000001
			}
		]
	}
];
