/**
 * Display metadata for result groups (rulebook §C.8). Titles + short blurbs +
 * a small glyph, so the converter renders a coherent set of section cards.
 */

import type { ResultGroupKey } from '$lib/conversion/types';

export interface GroupMeta {
	title: string;
	blurb?: string;
}

export const GROUP_META: Record<ResultGroupKey, GroupMeta> = {
	energy: { title: 'Energy', blurb: 'Same energy expressed in other units.' },
	power: { title: 'Power', blurb: 'Rate of energy — not energy itself.' },
	mass: { title: 'Mass' },
	volume: { title: 'Volume' },
	fuel_equivalents: {
		title: 'Fuel equivalents',
		blurb: 'Convention-defined energy-equivalence units (toe, boe, tce).'
	},
	emissions: {
		title: 'Emissions',
		blurb: 'CO₂ and CO₂e are separate — never derived from each other.'
	},
	energy_density: { title: 'Energy density', blurb: 'Energy per unit of mass or volume.' },
	industrial_units: { title: 'Industrial units', blurb: 'therm, MMBTU, quad.' },
	assumptions: { title: 'Assumptions' },
	warnings: { title: 'Warnings' },
	sources: { title: 'Sources' },
	formula: { title: 'Calculation path' }
};
