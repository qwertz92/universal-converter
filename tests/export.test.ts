/**
 * CSV/JSON export of result sets (roadmap 0.2 import/export slice).
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { exportFilename, resultSetToCsv, resultSetToJson } from '$lib/ui/export';
import type { ConversionResultSet } from '$lib/conversion/types';

function resultSet(input: string): ConversionResultSet {
	const out = getConverter().convertText(input);
	if ('error' in out) throw new Error('parse failed');
	return out;
}

describe('resultSetToCsv', () => {
	const csv = resultSetToCsv(resultSet('1 L diesel'));
	const lines = csv.trim().split('\r\n');

	it('starts with the header row and has one row per value result', () => {
		expect(lines[0]).toBe(
			'group,unit,value_display,value_raw,range_low,range_high,exactness,source_refs,note'
		);
		expect(lines.length).toBeGreaterThan(5);
	});

	it('keeps exactness and sources on every populated row (no provenance-stripped numbers)', () => {
		const dataRows = lines.slice(1).map((l) => l.split(','));
		const massRow = lines.slice(1).find((l) => l.startsWith('Mass,kg,'));
		expect(massRow).toContain('source_based');
		expect(massRow).toContain('uk-desnz-ghg-2025');
		expect(dataRows.every((r) => r.length >= 9)).toBe(true);
	});

	it('excludes the meta pseudo-groups', () => {
		expect(csv).not.toContain('Calculation path');
		expect(lines.some((l) => l.startsWith('Assumptions'))).toBe(false);
	});

	it('quotes fields containing commas or quotes', () => {
		const rs = resultSet('1 kWh electricity');
		const out = resultSetToCsv(rs);
		// The context_required note contains commas → must be quoted.
		expect(out).toMatch(/"[^"]*country\/region, the year[^"]*"/);
	});
});

describe('resultSetToJson', () => {
	it('round-trips through JSON.parse identical to the source object', () => {
		const rs = resultSet('1 m3 natural gas');
		expect(JSON.parse(resultSetToJson(rs))).toEqual(rs);
	});
});

describe('exportFilename', () => {
	it('slugifies the original input', () => {
		expect(exportFilename(resultSet('1 L diesel'), 'csv')).toBe(
			'universal-converter-1-l-diesel.csv'
		);
	});

	it('falls back cleanly for odd input', () => {
		const rs = resultSet('1 kWh');
		expect(exportFilename(rs, 'json').endsWith('.json')).toBe(true);
		expect(exportFilename(rs, 'json')).toMatch(/^universal-converter-/);
	});
});
