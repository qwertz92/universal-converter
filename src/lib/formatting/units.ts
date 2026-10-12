/**
 * Unit display helpers: the canonical label to show for a unit id.
 */

import type { Unit } from '#lib/conversion/types.js';

/** The label shown next to a value — the unit's first (canonical) symbol. */
export function unitLabel(unit: Unit): string {
	return unit.symbols[0] ?? unit.names[0] ?? unit.id;
}

/**
 * A unit label as the page prints it: the 2 in CO2 / CO2e becomes a subscript,
 * the way the tile titles already write it. Display only: `unit_label` in the
 * engine and the API stays plain ASCII ("kg CO2e"), because scripts and
 * spreadsheets match on that string and a clipboard copy should paste cleanly.
 * A "2" followed by another digit is left alone.
 */
export function displayUnitLabel(label: string): string {
	return label.replace(/CO2(?![0-9])/g, 'CO₂');
}

/** A longer, human-friendly label (canonical name), for headings/tooltips. */
export function unitName(unit: Unit): string {
	return unit.names[0] ?? unit.symbols[0] ?? unit.id;
}
