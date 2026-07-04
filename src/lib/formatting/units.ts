/**
 * Unit display helpers: the canonical label to show for a unit id.
 */

import type { Unit } from '$lib/conversion/types';

/** The label shown next to a value — the unit's first (canonical) symbol. */
export function unitLabel(unit: Unit): string {
	return unit.symbols[0] ?? unit.names[0] ?? unit.id;
}

/** A longer, human-friendly label (canonical name), for headings/tooltips. */
export function unitName(unit: Unit): string {
	return unit.names[0] ?? unit.symbols[0] ?? unit.id;
}
