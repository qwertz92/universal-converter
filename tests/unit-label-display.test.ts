/**
 * Display-only subscripts for CO2 in unit labels. The engine and the API keep
 * "kg CO2e" (plain ASCII, what a script or spreadsheet expects); only what the
 * page prints changes.
 */

import { describe, expect, it } from 'vitest';
import { displayUnitLabel } from '#lib/formatting/units.js';

describe('displayUnitLabel', () => {
	it.each([
		['kg CO2', 'kg CO₂'],
		['kg CO2e', 'kg CO₂e'],
		['gCO2e/kWh', 'gCO₂e/kWh'],
		['t CO2e', 't CO₂e']
	])('%s prints as %s', (label, shown) => {
		expect(displayUnitLabel(label)).toBe(shown);
	});

	it('leaves every other label alone', () => {
		for (const label of ['kWh', 'MJ', 'm3', 'L', '', 'EUR', 'kg']) {
			expect(displayUnitLabel(label)).toBe(label);
		}
	});

	it('does not touch a digit that follows CO2', () => {
		expect(displayUnitLabel('CO23')).toBe('CO23');
	});
});
