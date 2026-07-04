/**
 * Compute a small "common conversions" table for a unit's detail page, using the
 * engine's exact within-dimension conversion. We pick a curated set of sensible
 * targets per dimension so the table stays readable (rather than N×N).
 */

import { convertWithinDimension } from '$lib/units/exact-conversions';
import { combineExactness } from '$lib/conversion/precision';
import { formatValue } from '$lib/formatting/numbers';
import type { Unit, Dimension, Exactness } from '$lib/conversion/types';

/** Preferred target unit ids per dimension (shown if present in the catalog). */
const TARGETS: Partial<Record<Dimension, string[]>> = {
	energy: [
		'joule',
		'kilojoule',
		'megajoule',
		'gigajoule',
		'kilowatt_hour',
		'megawatt_hour',
		'btu',
		'mmbtu',
		'therm',
		'toe'
	],
	power: ['watt', 'kilowatt', 'megawatt', 'gigawatt'],
	mass: ['gram', 'kilogram', 'tonne', 'pound', 'short_ton', 'long_ton'],
	volume: [
		'milliliter',
		'liter',
		'cubic_meter',
		'us_gallon',
		'imperial_gallon',
		'barrel',
		'cubic_foot'
	],
	time: ['second', 'minute', 'hour', 'day', 'year']
};

export interface CommonConversion {
	targetId: string;
	label: string;
	symbol: string;
	value: string;
	exactness: Exactness;
}

/**
 * For `1 <unit>`, compute the value in each curated target of the same dimension.
 * `all` is the full unit list (from the data bundle).
 */
export function commonConversions(unit: Unit, all: Unit[]): CommonConversion[] {
	const targetIds = TARGETS[unit.dimension];
	if (!targetIds) return [];
	const byId = new Map(all.map((u) => [u.id, u]));
	const out: CommonConversion[] = [];
	for (const id of targetIds) {
		if (id === unit.id) continue;
		const target = byId.get(id);
		if (!target) continue;
		const raw = convertWithinDimension('1', unit, target);
		const exactness = combineExactness(unit.exactness, target.exactness);
		out.push({
			targetId: id,
			label: target.names[0],
			symbol: target.symbols[0],
			value: formatValue(raw, exactness),
			exactness
		});
	}
	return out;
}
