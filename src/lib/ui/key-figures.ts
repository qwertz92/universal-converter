/**
 * "At a glance": one headline figure per kind of result, so `10 L diesel`
 * opens with its energy, mass and CO₂ before the full grouped tables.
 *
 * Every figure is an existing result row, picked — never recomputed, never
 * rounded differently — and keeps its own exactness and basis. A group in
 * the input's own dimension is skipped (10 L restated as 10,000 mL tells the
 * reader nothing), and a group with no value is skipped rather than shown as
 * a blank tile.
 */

import type {
	ConversionResult,
	ConversionResultSet,
	Dimension,
	ResultGroupKey
} from '$lib/conversion/types';

export interface KeyFigure {
	label: string;
	row: ConversionResult;
}

interface Headline {
	label: string;
	/** The units the tile is shown in, by preference; else the group's first row. */
	preferred: string[];
	/** Skipped when the input is already in this dimension. */
	dimension?: Dimension;
}

/** The groups that get a tile (emissions are handled per metric below). */
function headline(key: ResultGroupKey): Headline | undefined {
	switch (key) {
		case 'energy':
			return { label: 'Energy', preferred: ['kilowatt_hour', 'megajoule'], dimension: 'energy' };
		case 'delivered':
			return { label: 'Delivered energy', preferred: ['kilowatt_hour'] };
		case 'power':
			return { label: 'Power', preferred: ['kilowatt', 'watt'], dimension: 'power' };
		case 'mass':
			return { label: 'Mass', preferred: ['kilogram', 'tonne'], dimension: 'mass' };
		case 'volume':
			return { label: 'Volume', preferred: ['liter', 'cubic_meter'], dimension: 'volume' };
		case 'cost':
			return { label: 'Cost', preferred: [] };
		default:
			return undefined;
	}
}

export function keyFigures(rs: ConversionResultSet, inputDimension: Dimension): KeyFigure[] {
	const out: KeyFigure[] = [];
	for (const group of rs.groups) {
		const rows = group.results.filter((r) => r.value !== null);
		if (rows.length === 0) continue;

		if (group.key === 'emissions') {
			// One tile per metric: CO₂ and CO₂e are different quantities and are
			// never folded into one figure.
			for (const metric of ['co2', 'co2e'] as const) {
				// An emission input ("10 kg CO2e") would only be restated.
				if (inputDimension === `emission_mass_${metric}`) continue;
				const row = rows.find((r) => r.unit_id === `kilogram_${metric}`);
				if (row) out.push({ label: metric === 'co2' ? 'CO₂' : 'CO₂e', row });
			}
			continue;
		}

		const head = headline(group.key);
		if (!head || head.dimension === inputDimension) continue;
		// The first row is the requested basis (LHV by default) — the engine
		// orders it first — so the headline never mixes bases.
		const row =
			head.preferred.map((id) => rows.find((r) => r.unit_id === id)).find(Boolean) ?? rows[0];
		const basis = row.basis ? ` · ${row.basis.toUpperCase()}` : '';
		out.push({ label: `${head.label}${basis}`, row });
	}
	return out;
}
