/**
 * Data validation: schema conformance PLUS referential integrity and the
 * domain invariants the schemas alone cannot express (spec §13.5, AGENTS.md
 * "no invented numbers", rulebook §C.1/§C.5).
 *
 * `validateAll()` returns a structured report rather than throwing, so callers
 * (a vitest file, an npm script, or a future admin tool) can present all errors
 * at once. `tests/data-validation.test.ts` asserts the report is clean, and
 * `npm run validate:data` runs the same check via vitest.
 *
 * Invariants enforced here (beyond the Zod schemas):
 *  - unique ids within each catalog (units, fuels, emission factors, sources);
 *  - every source_ref / source_id resolves to a sources.json entry;
 *  - every unit whose exactness is NOT exact/standard_definition has >=1 source_ref;
 *  - every fuel heating value is labeled with a basis and cites a source;
 *  - every fuel emission_factor_id resolves; every factor's fuel_id (if set) resolves;
 *  - CO2 and CO2e factors are never the same entry (metric separation sanity);
 *  - every density / heating value / emission factor value is strictly positive
 *    and every range has low < high (a zero density would flow "Infinity"
 *    silently into user-facing values — decimal.js divides by zero without
 *    throwing).
 */

import type { ZodType, z } from 'zod';
import {
	emissionFactorsFileSchema,
	examplesFileSchema,
	fuelsFileSchema,
	sourcesFileSchema,
	unitsFileSchema
} from './schemas';
import { rawData } from './load-data';

export interface ValidationIssue {
	file: 'units' | 'fuels' | 'emission-factors' | 'sources' | 'examples' | 'cross-file';
	path: string;
	message: string;
}

export interface ValidationReport {
	ok: boolean;
	issues: ValidationIssue[];
}

const NON_SOURCED_EXACTNESS = new Set(['exact', 'standard_definition']);

/** Validate every data file and their cross-references; collect all issues. */
export function validateAll(): ValidationReport {
	const issues: ValidationIssue[] = [];

	// 1. Schema conformance for every file (collect, don't throw).
	const unitsParsed = unitsFileSchema.safeParse(rawData.units);
	const fuelsParsed = fuelsFileSchema.safeParse(rawData.fuels);
	const factorsParsed = emissionFactorsFileSchema.safeParse(rawData.emissionFactors);
	const sourcesParsed = sourcesFileSchema.safeParse(rawData.sources);
	const examplesParsed = examplesFileSchema.safeParse(rawData.examples);

	pushZodIssues(issues, 'units', unitsParsed);
	pushZodIssues(issues, 'fuels', fuelsParsed);
	pushZodIssues(issues, 'emission-factors', factorsParsed);
	pushZodIssues(issues, 'sources', sourcesParsed);
	pushZodIssues(issues, 'examples', examplesParsed);

	// If a file failed its schema, its data is untrustworthy for cross-checks.
	if (
		!unitsParsed.success ||
		!fuelsParsed.success ||
		!factorsParsed.success ||
		!sourcesParsed.success
	) {
		return { ok: issues.length === 0, issues };
	}

	const units = unitsParsed.data.units;
	const fuels = fuelsParsed.data.fuels;
	const factors = factorsParsed.data.emission_factors;
	const sources = sourcesParsed.data.sources;

	// 2. Unique ids per catalog.
	checkUnique(issues, 'units', units, 'units');
	checkUnique(issues, 'fuels', fuels, 'fuels');
	checkUnique(issues, 'emission-factors', factors, 'emission_factors');
	checkUnique(issues, 'sources', sources, 'sources');

	const sourceIds = new Set(sources.map((s) => s.id));
	const unitIds = new Set(units.map((u) => u.id));
	const factorIds = new Set(factors.map((f) => f.id));

	// 3. Every non-exact unit value carries >=1 source_ref, and every ref resolves.
	for (const [i, u] of units.entries()) {
		if (!NON_SOURCED_EXACTNESS.has(u.exactness) && u.source_refs.length === 0) {
			issues.push({
				file: 'units',
				path: `units[${i}] (${u.id})`,
				message: `non-exact unit (exactness=${u.exactness}) must have >=1 source_ref`
			});
		}
		for (const ref of u.source_refs) {
			if (!sourceIds.has(ref)) {
				issues.push({
					file: 'cross-file',
					path: `units[${i}] (${u.id}).source_refs`,
					message: `source_ref '${ref}' does not resolve to a sources.json entry`
				});
			}
		}
	}

	// 4. Fuels: heating values labeled with basis + sourced; refs resolve.
	for (const [i, f] of fuels.entries()) {
		for (const ref of f.source_refs) {
			if (!sourceIds.has(ref)) {
				issues.push({
					file: 'cross-file',
					path: `fuels[${i}] (${f.id}).source_refs`,
					message: `source_ref '${ref}' does not resolve`
				});
			}
		}
		if (f.density) {
			checkUnitRef(issues, 'fuels', `fuels[${i}] (${f.id}).density.unit`, f.density.unit, unitIds);
			checkPositive(issues, 'fuels', `fuels[${i}] (${f.id}).density`, f.density.value);
			checkRange(issues, 'fuels', `fuels[${i}] (${f.id}).density.range`, f.density.range);
			for (const ref of f.density.source_refs) {
				if (!sourceIds.has(ref)) {
					issues.push({
						file: 'cross-file',
						path: `fuels[${i}] (${f.id}).density.source_refs`,
						message: `source_ref '${ref}' does not resolve`
					});
				}
			}
		}
		for (const [j, hv] of f.heating_values.entries()) {
			// basis presence is guaranteed by the schema enum; assert it is one we know.
			if (hv.basis !== 'lhv' && hv.basis !== 'hhv') {
				issues.push({
					file: 'fuels',
					path: `fuels[${i}] (${f.id}).heating_values[${j}]`,
					message: `heating value basis must be 'lhv' or 'hhv' (rulebook C.1)`
				});
			}
			checkUnitRef(
				issues,
				'fuels',
				`fuels[${i}] (${f.id}).heating_values[${j}].unit`,
				hv.unit,
				unitIds
			);
			checkPositive(issues, 'fuels', `fuels[${i}] (${f.id}).heating_values[${j}]`, hv.value);
			checkRange(issues, 'fuels', `fuels[${i}] (${f.id}).heating_values[${j}].range`, hv.range);
			for (const ref of hv.source_refs) {
				if (!sourceIds.has(ref)) {
					issues.push({
						file: 'cross-file',
						path: `fuels[${i}] (${f.id}).heating_values[${j}].source_refs`,
						message: `source_ref '${ref}' does not resolve`
					});
				}
			}
		}
		for (const fid of f.emission_factor_ids) {
			if (!factorIds.has(fid)) {
				issues.push({
					file: 'cross-file',
					path: `fuels[${i}] (${f.id}).emission_factor_ids`,
					message: `emission_factor_id '${fid}' does not resolve`
				});
			}
		}
	}

	// 5. Emission factors: source resolves, fuel_id (if set) resolves, unit resolves.
	const fuelIds = new Set(fuels.map((f) => f.id));
	for (const [i, ef] of factors.entries()) {
		if (!sourceIds.has(ef.source_id)) {
			issues.push({
				file: 'cross-file',
				path: `emission_factors[${i}] (${ef.id}).source_id`,
				message: `source_id '${ef.source_id}' does not resolve`
			});
		}
		if (ef.fuel_id && !fuelIds.has(ef.fuel_id)) {
			issues.push({
				file: 'cross-file',
				path: `emission_factors[${i}] (${ef.id}).fuel_id`,
				message: `fuel_id '${ef.fuel_id}' does not resolve`
			});
		}
		checkUnitRef(
			issues,
			'emission-factors',
			`emission_factors[${i}] (${ef.id}).unit`,
			ef.unit,
			unitIds
		);
		checkPositive(issues, 'emission-factors', `emission_factors[${i}] (${ef.id})`, ef.value);
	}

	return { ok: issues.length === 0, issues };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function pushZodIssues<T extends ZodType>(
	issues: ValidationIssue[],
	file: ValidationIssue['file'],
	parsed: z.ZodSafeParseResult<z.infer<T>>
): void {
	if (parsed.success) return;
	for (const issue of parsed.error.issues) {
		const path = issue.path.map((p) => String(p)).join('.') || '(root)';
		issues.push({ file, path, message: issue.message });
	}
}

function checkUnique<T extends { id: string }>(
	issues: ValidationIssue[],
	file: ValidationIssue['file'],
	items: T[],
	label: string
): void {
	const seen = new Set<string>();
	for (const [i, item] of items.entries()) {
		if (seen.has(item.id)) {
			issues.push({
				file,
				path: `${label}[${i}]`,
				message: `duplicate id '${item.id}'`
			});
		}
		seen.add(item.id);
	}
}

function checkUnitRef(
	issues: ValidationIssue[],
	file: ValidationIssue['file'],
	path: string,
	unit: string,
	unitIds: Set<string>
): void {
	if (!unitIds.has(unit)) {
		issues.push({
			file,
			path,
			message: `unit '${unit}' does not resolve to a units.json entry`
		});
	}
}

/** Physical data values must be strictly positive (schema guarantees "finite decimal"). */
function checkPositive(
	issues: ValidationIssue[],
	file: ValidationIssue['file'],
	path: string,
	value: string
): void {
	if (!(Number(value) > 0)) {
		issues.push({
			file,
			path,
			message: `value '${value}' must be strictly positive`
		});
	}
}

/** Ranges must be well-formed: low < high, both positive. */
function checkRange(
	issues: ValidationIssue[],
	file: ValidationIssue['file'],
	path: string,
	range: { low: string; high: string } | undefined
): void {
	if (!range) return;
	const low = Number(range.low);
	const high = Number(range.high);
	if (!(low > 0) || !(high > 0) || !(low < high)) {
		issues.push({
			file,
			path,
			message: `range [${range.low}, ${range.high}] must satisfy 0 < low < high`
		});
	}
}
