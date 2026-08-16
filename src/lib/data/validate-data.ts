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
 *  - no two fuels claim the same name or alias. The registry keeps the FIRST
 *    registration for a colliding key, so a duplicate would silently answer with
 *    whichever fuel happens to sit earlier in the file — the exact "quietly wrong
 *    number" failure this project exists to avoid (see ADR 0005, where variants
 *    deliberately share vocabulary with their parents);
 *  - no two UNITS claim the same lookup key either, unless the two tokens are
 *    case-sensitively distinct symbols/aliases ("mg"/"Mg", "cal"/"Cal") that the
 *    registry resolves before it ever consults the loose map;
 *  - no fuel and unit claim the same key: the parser assigns those two roles by
 *    slot, so a collision would be decided by sentence position, not by data;
 *  - `related_fuels` links are symmetric — a one-way link renders on one page
 *    only, and the reader on the other page never learns the pair exists;
 *  - every emission factor's `metric` agrees with its `unit` (a per-litre factor
 *    may not claim to be per-energy);
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
import { normalizeLoose, normalizeSymbol } from '$lib/units/aliases';

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

/**
 * The physical amount an emission-factor unit divides by, keyed by the
 * denominator in its unit id (`kg_co2e_per_l` → `l`). An unknown denominator is
 * reported rather than skipped, so adding an emission-intensity unit forces a
 * decision about which metric it carries instead of silently escaping the check.
 */
const METRIC_BY_DENOMINATOR: Record<string, string> = {
	j: 'mass_per_energy',
	kj: 'mass_per_energy',
	mj: 'mass_per_energy',
	gj: 'mass_per_energy',
	tj: 'mass_per_energy',
	wh: 'mass_per_energy',
	kwh: 'mass_per_energy',
	mwh: 'mass_per_energy',
	gwh: 'mass_per_energy',
	btu: 'mass_per_energy',
	mmbtu: 'mass_per_energy',
	therm: 'mass_per_energy',
	g: 'mass_per_mass',
	kg: 'mass_per_mass',
	t: 'mass_per_mass',
	tonne: 'mass_per_mass',
	lb: 'mass_per_mass',
	ml: 'mass_per_volume',
	l: 'mass_per_volume',
	cm3: 'mass_per_volume',
	m3: 'mass_per_volume',
	ft3: 'mass_per_volume',
	gal: 'mass_per_volume'
};

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
	const fuelIds = new Set(fuels.map((f) => f.id));

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
		for (const rid of f.related_fuels) {
			if (rid === f.id) {
				issues.push({
					file: 'fuels',
					path: `fuels[${i}] (${f.id}).related_fuels`,
					message: `related_fuel '${rid}' points at itself`
				});
			} else if (!fuelIds.has(rid)) {
				issues.push({
					file: 'cross-file',
					path: `fuels[${i}] (${f.id}).related_fuels`,
					message: `related_fuel '${rid}' does not resolve`
				});
			} else if (!fuels.find((o) => o.id === rid)?.related_fuels.includes(f.id)) {
				// ADR 0005's whole point is that neighbours name each other. A one-way
				// link renders the pair on one detail page and hides it on the other —
				// which is precisely the reader who needed to be warned off.
				issues.push({
					file: 'fuels',
					path: `fuels[${i}] (${f.id}).related_fuels`,
					message: `related_fuel '${rid}' does not name '${f.id}' back — related_fuels must be symmetric`
				});
			}
		}
	}

	// 4b. No two fuels may claim the same lookup key. FuelRegistry keeps the first
	// registration, so a collision resolves by file order — silently returning one
	// fuel's density and another's emission factors to someone who typed a phrase
	// both entries claim.
	const claimedBy = new Map<string, string>();
	for (const [i, f] of fuels.entries()) {
		for (const token of [f.id, ...f.names, ...f.aliases]) {
			const key = normalizeLoose(token);
			const owner = claimedBy.get(key);
			if (owner === undefined) {
				claimedBy.set(key, f.id);
			} else if (owner !== f.id) {
				issues.push({
					file: 'fuels',
					path: `fuels[${i}] (${f.id})`,
					message: `'${token}' is already claimed by fuel '${owner}' — one of them would never be reachable`
				});
			}
		}
	}

	// 4c. No two UNITS may share a lookup key either. UnitRegistry resolves a
	// token case-SENSITIVELY across symbols and aliases first and only then falls
	// back to the loose (lowercased, ³→3, μ→µ) key, so a loose clash is tolerable
	// exactly when the case-sensitive pass can still tell the two apart — "mg"
	// (milligram) vs "Mg" (megagram/tonne), "cal" vs "Cal". Anything else, and one
	// unit becomes unreachable or the pair answers by file order. Names never take
	// part in the case-sensitive pass, so a name in the clash is always a defect.
	const unitTokens = new Map<string, Map<string, { tokens: string[]; viaName: boolean }>>();
	for (const u of units) {
		const record = (token: string, viaName: boolean) => {
			const key = normalizeLoose(token);
			const owners = unitTokens.get(key) ?? new Map();
			const entry = owners.get(u.id) ?? { tokens: [], viaName: false };
			entry.tokens.push(token);
			entry.viaName ||= viaName;
			owners.set(u.id, entry);
			unitTokens.set(key, owners);
		};
		for (const s of u.symbols) record(s, false);
		for (const a of u.aliases) record(a, false);
		for (const n of u.names) record(n, true);
		record(u.id, true);
	}
	for (const [key, owners] of unitTokens) {
		if (owners.size < 2) continue;
		const ids = [...owners.keys()];
		const viaName = [...owners.values()].some((o) => o.viaName);
		// Compare case-sensitive forms ACROSS units only: a unit repeating its own
		// token (milligram lists "mg" as both symbol and alias) is not a clash.
		const seen = new Set<string>();
		let caseDistinct = true;
		for (const owner of owners.values()) {
			for (const token of new Set(owner.tokens.map(normalizeSymbol))) {
				if (seen.has(token)) caseDistinct = false;
				seen.add(token);
			}
		}
		if (viaName || !caseDistinct) {
			issues.push({
				file: 'units',
				path: `units (${ids.join(', ')})`,
				message:
					`'${key}' is claimed by ${ids.length} units (${ids.join(', ')}) and cannot be told apart ` +
					`case-sensitively${viaName ? ' (one of them claims it as a NAME, which is only ever matched loosely)' : ''} — ` +
					`one of them would be unreachable`
			});
		}
	}

	// 4d. A fuel and a unit must not claim the same key. The parser fills the unit
	// and material slots by position, so a shared token would be read as whichever
	// the sentence shape suggested rather than as what the data says it is.
	for (const [key, owners] of unitTokens) {
		const fuelOwner = claimedBy.get(key);
		if (fuelOwner === undefined) continue;
		issues.push({
			file: 'cross-file',
			path: `fuels (${fuelOwner}) / units (${[...owners.keys()].join(', ')})`,
			message: `'${key}' is claimed by both fuel '${fuelOwner}' and unit(s) '${[...owners.keys()].join(', ')}' — which one wins would depend on where it sits in the query`
		});
	}

	// 5. Emission factors: source resolves, fuel_id (if set) resolves, unit resolves.
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

		// `metric` says what the factor multiplies; `unit` says the same thing in
		// the unit id's denominator. They must agree, or the label above a number
		// describes a different calculation than the one the engine performs.
		const denominator = /_per_([a-z0-9]+)$/.exec(ef.unit)?.[1];
		const expected = denominator ? METRIC_BY_DENOMINATOR[denominator] : undefined;
		if (!expected) {
			issues.push({
				file: 'emission-factors',
				path: `emission_factors[${i}] (${ef.id}).unit`,
				message: `cannot derive a metric from unit '${ef.unit}' — add its denominator to METRIC_BY_DENOMINATOR so the metric stays checkable`
			});
		} else if (ef.metric !== expected) {
			issues.push({
				file: 'emission-factors',
				path: `emission_factors[${i}] (${ef.id}).metric`,
				message: `metric '${ef.metric}' disagrees with unit '${ef.unit}', which is ${expected}`
			});
		}
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
