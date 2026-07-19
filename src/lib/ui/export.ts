/**
 * Result-set export (roadmap 0.2 "Import/Export" slice): serialize a
 * ConversionResultSet to CSV / pretty JSON for download or clipboard. Pure
 * string builders — no DOM here — so they are unit-testable; the Converter
 * component wires them to Blob downloads.
 *
 * CSV design: one row per conversion result (meta pseudo-groups excluded —
 * assumptions/warnings/sources travel in the JSON export and as dedicated
 * trailing comment-style rows would corrupt strict CSV consumers). Every row
 * keeps the exactness label and source refs so a spreadsheet can never show a
 * number stripped of its provenance.
 */

import type { ConversionResultSet } from '$lib/conversion/types';

const META_KEYS = new Set(['assumptions', 'warnings', 'sources', 'formula']);

/** RFC-4180-style field quoting. */
function csvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/** Build a CSV of all value groups (comma-separated, CRLF rows, header row). */
export function resultSetToCsv(rs: ConversionResultSet): string {
	const rows: string[] = [];
	rows.push(
		[
			'group',
			'unit',
			'value_display',
			'value_raw',
			'range_low',
			'range_high',
			'exactness',
			'source_refs',
			'note'
		].join(',')
	);
	for (const group of rs.groups) {
		if (META_KEYS.has(group.key)) continue;
		for (const r of group.results) {
			rows.push(
				[
					csvField(group.title),
					csvField(r.unit_label),
					csvField(r.value ?? ''),
					csvField(r.raw ?? ''),
					csvField(r.range?.low ?? ''),
					csvField(r.range?.high ?? ''),
					csvField(r.exactness),
					csvField(r.source_refs.join(' ')),
					csvField(r.value === null ? (r.explanation ?? '') : '')
				].join(',')
			);
		}
	}
	return rows.join('\r\n') + '\r\n';
}

/** Pretty JSON of the full result set (everything, including meta). */
export function resultSetToJson(rs: ConversionResultSet): string {
	return JSON.stringify(rs, null, 2);
}

/** Filesystem-safe export filename from the original input. */
export function exportFilename(rs: ConversionResultSet, ext: 'csv' | 'json'): string {
	const base = (rs.input.original_input ?? `${rs.input.value} ${rs.input.unit_label}`)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return `universal-converter-${base || 'result'}.${ext}`;
}
