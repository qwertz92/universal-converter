/**
 * Display metadata for result groups (rulebook §C.8). Titles + short blurbs +
 * a small glyph, so the converter renders a coherent set of section cards.
 */

import type { ResultGroupKey } from '$lib/conversion/types';

export interface GroupMeta {
	title: string;
	blurb?: string;
}

export const GROUP_META = {
	energy: { title: 'Energy', blurb: 'Same energy expressed in other units.' },
	power: { title: 'Power', blurb: 'Rate of energy — not energy itself.' },
	mass: { title: 'Mass' },
	volume: { title: 'Volume' },
	time: { title: 'Time' },
	fuel_equivalents: {
		title: 'Fuel equivalents',
		blurb: 'Convention-defined energy-equivalence units (toe, boe, tce).'
	},
	emissions: {
		title: 'Emissions',
		blurb: 'CO₂ and CO₂e are separate — never derived from each other.'
	},
	energy_density: { title: 'Energy density', blurb: 'Energy per unit of mass or volume.' },
	delivered: {
		title: 'Delivered energy',
		blurb: 'What actually reaches the room, at the efficiency you typed.'
	},
	cost: {
		title: 'Cost',
		blurb: 'At the rate you typed. This tool carries no tariffs and converts no currencies.'
	},
	industrial_units: { title: 'Industrial units', blurb: 'therm, MMBTU, quad.' },
	assumptions: { title: 'Assumptions' },
	warnings: { title: 'Warnings' },
	sources: { title: 'Sources' },
	formula: { title: 'Calculation path' }
} satisfies Record<ResultGroupKey, GroupMeta>;

/**
 * The display metadata for one group. Read through this rather than indexing
 * GROUP_META directly: `satisfies` keeps each entry's own literal shape, so an
 * entry that carries no blurb has no `blurb` property at all to read. The named
 * return type is what makes `meta.blurb` mean "absent here" instead of "not a
 * field". The key type covers every entry, so this is total.
 */
export function groupMeta(key: ResultGroupKey): GroupMeta {
	return GROUP_META[key];
}
