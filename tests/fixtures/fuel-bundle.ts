/**
 * INLINE TEST FIXTURES — made-up-but-clearly-labeled fuel/emission values used
 * only by the engine tests. These NEVER go in data/*.json (real values are the
 * Data agent's job, from verified sources). The numbers here are chosen to make
 * the arithmetic easy to check by hand, not to be physically authoritative.
 */

import { loadDataBundle } from '$lib/data/load-data';
import type { DataBundle, EmissionFactor, Fuel, Source } from '$lib/conversion/types';

const TEST_SOURCE: Source = {
	id: 'test-fixture',
	title: 'Engine test fixture (not a real source)',
	type: 'internal-document',
	reliability: 'FICTIONAL — for unit tests only'
};

/** Diesel-like fuel with round numbers: density 0.84 kg/L, LHV 36 MJ/L & 43 MJ/kg. */
const TEST_DIESEL: Fuel = {
	id: 'test-diesel',
	names: ['test diesel'],
	aliases: ['tdiesel'],
	category: 'oil',
	phase: 'liquid',
	density: {
		value: '0.84',
		unit: 'kg_per_l',
		reference_conditions: '15 °C',
		source_refs: ['test-fixture']
	},
	heating_values: [
		{ basis: 'lhv', value: '36', unit: 'mj_per_l', source_refs: ['test-fixture'] },
		{ basis: 'lhv', value: '43', unit: 'mj_per_kg', source_refs: ['test-fixture'] },
		{ basis: 'hhv', value: '38.5', unit: 'mj_per_l', source_refs: ['test-fixture'] }
	],
	emission_factor_ids: ['test-diesel-co2'],
	source_refs: ['test-fixture']
};

const TEST_DIESEL_CO2: EmissionFactor = {
	id: 'test-diesel-co2',
	fuel_id: 'test-diesel',
	pollutant: 'CO2',
	metric: 'mass_per_volume',
	value: '2.6', // kg CO2 per L (round number for tests)
	unit: 'kg_co2_per_l',
	scope: 'direct_combustion',
	source_id: 'test-fixture'
};

/** Hydrogen fixture: mass-based, LHV 120 MJ/kg; combustion CO2 handled by engine. */
const TEST_HYDROGEN: Fuel = {
	id: 'test-hydrogen',
	names: ['test hydrogen'],
	aliases: ['th2'],
	category: 'hydrogen',
	phase: 'gas',
	heating_values: [
		{ basis: 'lhv', value: '120', unit: 'mj_per_kg', source_refs: ['test-fixture'] }
	],
	source_refs: ['test-fixture']
};

/** Wood-pellets fixture: biogenic, mass-based, with a biogenic CO2 factor. */
const TEST_PELLETS: Fuel = {
	id: 'test-pellets',
	names: ['test wood pellets'],
	aliases: ['tpellets'],
	category: 'biomass',
	phase: 'solid',
	heating_values: [{ basis: 'lhv', value: '17', unit: 'mj_per_kg', source_refs: ['test-fixture'] }],
	emission_factor_ids: ['test-pellets-biogenic'],
	source_refs: ['test-fixture']
};

const TEST_PELLETS_BIOGENIC: EmissionFactor = {
	id: 'test-pellets-biogenic',
	fuel_id: 'test-pellets',
	pollutant: 'biogenic_CO2',
	metric: 'mass_per_mass',
	value: '1.8', // kg CO2 per kg (round number)
	unit: 'kg_co2_per_kg',
	scope: 'direct_combustion',
	biogenic: true,
	source_id: 'test-fixture'
};

/** Electricity fixture: routed to context_required for CO2e. */
const TEST_ELECTRICITY: Fuel = {
	id: 'test-electricity',
	names: ['test electricity'],
	aliases: ['grid'],
	category: 'electricity',
	source_refs: ['test-fixture']
};

/** Natural-gas fixture with a billing warning and a per-volume HV. */
const TEST_GAS: Fuel = {
	id: 'test-natural-gas',
	names: ['test natural gas'],
	aliases: ['tgas'],
	category: 'gas',
	phase: 'gas',
	heating_values: [
		{
			basis: 'lhv',
			value: '10',
			unit: 'kwh_per_m3',
			source_refs: ['test-fixture'],
			notes: 'Nm³ @ 0 °C, 101.325 kPa'
		}
	],
	source_refs: ['test-fixture'],
	warnings: ['Gas billing depends on your supplier Brennwert and Zustandszahl.']
};

/** A data bundle: the real units/sources catalog + inline test fuels/factors. */
export function testBundle(): DataBundle {
	const base = loadDataBundle();
	return {
		units: base.units,
		sources: [...base.sources, TEST_SOURCE],
		fuels: [TEST_DIESEL, TEST_HYDROGEN, TEST_PELLETS, TEST_ELECTRICITY, TEST_GAS],
		emissionFactors: [TEST_DIESEL_CO2, TEST_PELLETS_BIOGENIC]
	};
}
