/**
 * The structured "Build it with dropdowns" form dead-ended: typing "kWh" into
 * the Unit box without clicking a list entry left the unit unset, so Convert
 * stayed disabled with no message and Enter did nothing. A typed text that
 * names exactly one option now commits it.
 */

import { describe, expect, it } from 'vitest';
import { typedMatch } from '$lib/components/search/Combobox.svelte';

const opts = [
	{ id: 'kilowatt_hour', label: 'kilowatt hour', hint: 'kWh', group: 'Energy' },
	{ id: 'megawatt_hour', label: 'megawatt hour', hint: 'MWh', group: 'Energy' },
	{ id: 'kilowatt', label: 'kilowatt', hint: 'kW', group: 'Power' }
];

describe('typedMatch', () => {
	it('commits the option whose symbol was typed, ignoring case and spaces', () => {
		expect(typedMatch(opts, 'kWh')?.id).toBe('kilowatt_hour');
		expect(typedMatch(opts, '  kwh ')?.id).toBe('kilowatt_hour');
	});

	it('commits the option whose name was typed', () => {
		expect(typedMatch(opts, 'Kilowatt')?.id).toBe('kilowatt');
	});

	it('commits the only remaining option of a filtered list on Enter', () => {
		expect(typedMatch([opts[1]], 'mega')?.id).toBe('megawatt_hour');
	});

	it('does not commit a partial text just because the user left the field', () => {
		// Typing "hydro" in the fuel prompt and clicking back into the main query
		// committed "hydrogen", rewrote the query and ran a conversion while the
		// user was only moving to edit something else.
		expect(typedMatch([opts[1]], 'mega', { exactOnly: true })).toBeUndefined();
		expect(typedMatch(opts, 'MWh', { exactOnly: true })?.id).toBe('megawatt_hour');
	});

	it('does not guess between several partial matches', () => {
		expect(typedMatch(opts, 'kilo')).toBeUndefined();
	});

	it('commits nothing for empty text', () => {
		expect(typedMatch([opts[1]], '  ')).toBeUndefined();
	});
});
