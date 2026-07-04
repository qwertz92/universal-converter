/**
 * Core type system for the Universal Converter engine.
 *
 * This module is the single source of truth for the engine's domain types.
 * It is framework-independent (no Svelte / DOM / Node imports) so the engine
 * can be reused anywhere (spec §4, §5; AGENTS.md non-negotiable principles).
 *
 * The vocabulary here implements the normative rulebook `docs/conversion-rules.md`:
 * the 8-level exactness taxonomy (§A), the dimensional model (§B) and the result
 * groups / meta-groups (§C.8).
 */

/* ------------------------------------------------------------------ *
 * Dimensions
 * ------------------------------------------------------------------ */

/**
 * Base physical dimensions whose units convert without any material context
 * (rulebook §B.1). Conversions within one of these are `exact` (or
 * `standard_definition` where the unit itself is a convention).
 */
export type BaseDimension = 'energy' | 'power' | 'mass' | 'volume' | 'time';

/**
 * Pseudo-dimensions (rulebook §B.2). These never auto-convert to/from the base
 * dimensions, and — critically — `emission_mass_co2` and `emission_mass_co2e`
 * are SEPARATE with NO conversion path between them (rulebook §B.2 hard rule,
 * §C.5, §D.6).
 */
export type PseudoDimension =
	| 'emission_mass_co2'
	| 'emission_mass_co2e'
	| 'energy_density_mass'
	| 'energy_density_volume'
	| 'emission_intensity';

export type Dimension = BaseDimension | PseudoDimension;

export const BASE_DIMENSIONS: readonly BaseDimension[] = [
	'energy',
	'power',
	'mass',
	'volume',
	'time'
] as const;

export const PSEUDO_DIMENSIONS: readonly PseudoDimension[] = [
	'emission_mass_co2',
	'emission_mass_co2e',
	'energy_density_mass',
	'energy_density_volume',
	'emission_intensity'
] as const;

/* ------------------------------------------------------------------ *
 * Exactness taxonomy (rulebook §A — the 8 levels)
 * ------------------------------------------------------------------ */

/**
 * The exactness taxonomy — the vocabulary every result must speak (rulebook §A).
 * A result is assigned the LEAST exact level any of its inputs/factors demands:
 * exactness is a floor, propagated by the weakest link in the calculation path.
 *
 * NOTE: `context_required` is the one deliberate extension beyond the spec's
 * literal §7.6 enum, added per rulebook §A.2 (the spec's own §10 requires a
 * distinct "context required" UI state).
 */
export type Exactness =
	/** Follows from an SI or definitional identity. No material assumption. */
	| 'exact'
	/** Fixed by a published standard/convention (toe, tce, therm, IT cal/BTU). Exact by fiat. */
	| 'standard_definition'
	/** Measured/tabulated value from a cited source (density, calorific value, factor). */
	| 'source_based'
	/** Derived/representative value with genuine spread (physical barrel energy, "wood"). */
	| 'estimated'
	/** Correct only for a stated region AND year (grid electricity CO2e above all). */
	| 'region_year_specific'
	/** Depends on a value the user supplied or accepted (density, basis toggle, ref condition). */
	| 'user_assumption'
	/** Well-defined in principle but a required piece of context is missing. A prompt for input, not an error. */
	| 'context_required'
	/** Not meaningful, not in scope, or dimensionally impossible even in principle. */
	| 'unsupported';

export const EXACTNESS_LEVELS: readonly Exactness[] = [
	'exact',
	'standard_definition',
	'source_based',
	'estimated',
	'region_year_specific',
	'user_assumption',
	'context_required',
	'unsupported'
] as const;

/**
 * Ordering used to compute the exactness floor for a calculation chain: lower
 * ordinal = more exact. `combineExactness` (see conversion/precision.ts) picks
 * the WEAKEST (highest ordinal among the "numeric" levels) link. The two
 * non-numeric terminal states (`context_required`, `unsupported`) are handled
 * separately by the engine's guards, not blended into numeric chains.
 */
export const EXACTNESS_ORDER: Record<Exactness, number> = {
	exact: 0,
	standard_definition: 1,
	user_assumption: 2,
	source_based: 3,
	region_year_specific: 4,
	estimated: 5,
	context_required: 6,
	unsupported: 7
};

/* ------------------------------------------------------------------ *
 * Units & quantities
 * ------------------------------------------------------------------ */

/** A reference to a source entry in data/sources.json (by its kebab-case id). */
export type SourceRef = string;

/**
 * A unit definition (spec §7.1). `to_base_factor` is stored as an exact decimal
 * STRING in the data file and multiplied via decimal.js — never a float chain.
 */
export interface Unit {
	id: string;
	dimension: Dimension;
	/** Case-sensitive display symbols (e.g. "kWh", "MJ", "m³"). First is canonical. */
	symbols: string[];
	/** Human names (case-insensitive matching), e.g. "kilowatt hour". First is canonical. */
	names: string[];
	/** Generous alias list for parsing (case-insensitive), e.g. "kwh", "m3", "cbm". */
	aliases: string[];
	/** Multiply a value in this unit by this to get the dimension's base unit. Exact decimal string. */
	to_base_factor: string;
	/** True when the factor is an exact SI/definitional identity (no material assumption). */
	is_exact: boolean;
	/** Exactness level assigned to conversions that use this unit's factor. */
	exactness: Exactness;
	/** Optional offset formula for affine units (e.g. temperature). Unused in v0.1. */
	offset_formula_if_needed?: string;
	/** Measurement system tag (e.g. "SI", "US", "imperial", "convention"). */
	system?: string;
	notes?: string;
	source_refs: SourceRef[];
}

/** A parsed magnitude in a specific unit (spec §7.2). */
export interface Quantity {
	/** Decimal-string value to preserve precision across the engine boundary. */
	value: string;
	unit_id: string;
	dimension: Dimension;
	/** The raw text the user typed for this quantity, if any. */
	original_input?: string;
}

/* ------------------------------------------------------------------ *
 * Fuels & emission factors (data model — the engine consumes these)
 * ------------------------------------------------------------------ */

export type HeatingBasis = 'lhv' | 'hhv';

/** A calorific value on a stated basis, per mass or per volume, with provenance. */
export interface HeatingValue {
	/** LHV/NCV or HHV/GCV — always labeled (rulebook §C.1, AGENTS.md). */
	basis: HeatingBasis;
	/** Numeric value as a string (exact-decimal-safe); interpreted in `unit`. */
	value: string;
	/** Unit id the value is expressed in (e.g. "mj_per_kg", "kwh_per_m3"). */
	unit: string;
	/** Optional low/high range for genuinely variable fuels (rulebook §C.7 rule 2). */
	range?: { low: string; high: string };
	source_refs: SourceRef[];
	notes?: string;
}

/** A fuel density (mass per volume), with reference conditions where relevant. */
export interface Density {
	/** Numeric value as a string; interpreted in `unit` (e.g. "kg_per_l"). */
	value: string;
	unit: string;
	range?: { low: string; high: string };
	/** Reference temperature/pressure label, e.g. "15 °C" or "Nm³ @ 0 °C, 101.325 kPa". */
	reference_conditions?: string;
	source_refs: SourceRef[];
	notes?: string;
}

/** GHG pollutant / metric labels (spec §7.4). CO2 and CO2e are never conflated. */
export type Pollutant = 'CO2' | 'CH4' | 'N2O' | 'CO2e' | 'biogenic_CO2';

/** System boundary / scope labels (spec §7.4, rulebook §C.5). */
export type Scope =
	| 'direct_combustion'
	| 'scope_1'
	| 'scope_2'
	| 'scope_3_upstream'
	| 'well_to_tank'
	| 'tank_to_wheel'
	| 'well_to_wheel'
	| 'unknown_or_mixed';

/**
 * An emission factor (spec §7.4). Every factor carries metric + scope + basis
 * (where applicable) + region + year so results can state all of them
 * (rulebook §C.5).
 */
export interface EmissionFactor {
	id: string;
	/** Fuel this factor applies to; omitted/"electricity" for grid factors. */
	fuel_id?: string;
	pollutant: Pollutant;
	/** What the value measures, e.g. "mass_per_volume", "mass_per_energy". */
	metric: string;
	/** Numeric value as a string. */
	value: string;
	/** Unit id the value is expressed in (e.g. "kg_co2_per_l", "g_co2e_per_kwh"). */
	unit: string;
	/** LHV/HHV basis of the underlying energy where the factor is per-energy. */
	basis?: HeatingBasis;
	scope: Scope;
	/** Region the factor is valid for (e.g. "EU", "US", "DE", "global"). */
	region?: string;
	/** Year the factor is valid for. */
	year?: number;
	/** Whether this is biogenic (reported separately, never zeroed — rulebook §C.5). */
	biogenic?: boolean;
	uncertainty?: string;
	source_id: SourceRef;
	source_table_or_page?: string;
	notes?: string;
}

/** A fuel catalog entry (spec §7.3). Heating values / factors carry their own provenance. */
export interface Fuel {
	id: string;
	names: string[];
	aliases: string[];
	/** e.g. "oil", "gas", "coal", "biomass", "hydrogen", "electricity". */
	category: string;
	density?: Density;
	/** Calorific values, each labeled with basis (rulebook §C.1 / §D.2). */
	heating_values?: HeatingValue[];
	/** Ids into the emission-factors catalog that apply to this fuel. */
	emission_factor_ids?: string[];
	/** Phase, for fuels where it matters (gas vs LNG — rulebook §D.12). */
	phase?: 'gas' | 'liquid' | 'solid';
	typical_ranges?: string;
	source_refs: SourceRef[];
	notes?: string;
	/** Fuel-level warnings surfaced on every result for this fuel (e.g. gas billing). */
	warnings?: string[];
}

/** A source entry (spec §7.5). */
export interface Source {
	id: string;
	title: string;
	publisher?: string;
	url?: string;
	retrieved_at?: string;
	publication_year?: number;
	license?: string;
	/** "internal-document" for the rulebook self-reference; else a reliability note. */
	type?: string;
	reliability?: string;
	notes?: string;
}

/* ------------------------------------------------------------------ *
 * Assumptions & warnings attached to results
 * ------------------------------------------------------------------ */

/** A machine-readable + human-readable assumption attached to a result (spec §2, §7.6). */
export interface Assumption {
	/** Stable key, e.g. "density", "heating_value_basis", "gas_reference_condition". */
	kind: string;
	/** Human-readable statement, e.g. "assumed diesel density 0.835 kg/L (source X, 2022)". */
	text: string;
	/** The value the assumption fixes, where numeric (string for precision). */
	value?: string;
	unit?: string;
	source_refs?: SourceRef[];
}

/** Severity of a warning attached to a result. */
export type WarningSeverity = 'info' | 'caution' | 'critical';

/** A warning attached to a result (spec §8.1, rulebook §C.2). */
export interface Warning {
	/** Stable key, e.g. "gas_billing", "phase_distinction", "biogenic_co2". */
	kind: string;
	severity: WarningSeverity;
	text: string;
}

/* ------------------------------------------------------------------ *
 * Conversion results & result groups
 * ------------------------------------------------------------------ */

/** Machine-readable list of what's missing when exactness is `context_required`. */
export type MissingContext = 'time' | 'fuel' | 'density' | 'region' | 'year' | 'basis';

/**
 * A single conversion result (spec §7.6, extended by rulebook §A/§C.7).
 *
 * `value` is null when no number is produced (`context_required` / `unsupported`).
 * `raw` holds the full-precision decimal string; `formatted` is the display
 * string honouring the sig-fig cap and `~` marker (rulebook §C.7).
 */
export interface ConversionResult {
	/** Formatted display string (e.g. "3.6", "~35", "not available"), or null if none. */
	value: string | null;
	/** Full-precision decimal string, or null when no number is produced. */
	raw: string | null;
	/** Target unit id. */
	unit_id: string;
	/** Canonical display label for the unit (symbol or name). */
	unit_label: string;
	/** Which result group this belongs to (spec §8.3). */
	category: ResultGroupKey;
	exactness: Exactness;
	/** Human-readable calculation path, e.g. "1 L diesel × 0.835 kg/L = 0.835 kg". */
	formula?: string;
	/** Optional low/high display range for estimates (rulebook §C.7 rule 2). */
	range?: { low: string; high: string };
	assumptions: Assumption[];
	warnings: Warning[];
	source_refs: SourceRef[];
	/** When `context_required`: the machine-readable list of what to supply. */
	missing?: MissingContext[];
	/** Free-text explanation for context_required / unsupported. */
	explanation?: string;
	/** Illustrative (non-default) example rows, e.g. grid factors (rulebook §C.6). */
	illustrative_examples?: IllustrativeExample[];
}

/** A clearly-labeled illustrative example (never a default) — rulebook §C.6. */
export interface IllustrativeExample {
	label: string;
	value: string;
	unit_label: string;
	region?: string;
	year?: number;
	source_refs: SourceRef[];
}

/**
 * The canonical result-group keys, in canonical order (rulebook §C.8).
 * `assumptions`/`warnings`/`sources`/`formula` are the meta-groups.
 */
export type ResultGroupKey =
	| 'energy'
	| 'power'
	| 'mass'
	| 'volume'
	| 'fuel_equivalents'
	| 'emissions'
	| 'energy_density'
	| 'industrial_units'
	| 'assumptions'
	| 'warnings'
	| 'sources'
	| 'formula';

/** Canonical order of result groups (rulebook §C.8). */
export const RESULT_GROUP_ORDER: readonly ResultGroupKey[] = [
	'energy',
	'power',
	'mass',
	'volume',
	'fuel_equivalents',
	'emissions',
	'energy_density',
	'industrial_units',
	'assumptions',
	'warnings',
	'sources',
	'formula'
] as const;

/** A titled group of results shown together (rulebook §C.8). */
export interface ResultGroup {
	key: ResultGroupKey;
	title: string;
	results: ConversionResult[];
}

/** The full, ordered set of result groups for one input (spec §2, §8.3). */
export interface ConversionResultSet {
	/** Echo of the parsed input for display. */
	input: {
		value: string;
		unit_id: string;
		unit_label: string;
		fuel_id?: string;
		fuel_label?: string;
		original_input?: string;
	};
	groups: ResultGroup[];
	/** Aggregated meta collected across all results. */
	assumptions: Assumption[];
	warnings: Warning[];
	source_refs: SourceRef[];
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

/** A candidate interpretation of an ambiguous token (e.g. "ton", "gallon"). */
export interface Interpretation {
	unit_id: string;
	label: string;
	note?: string;
}

/** Structured parse error (spec §8.2, rulebook §D.9/§D.10). */
export interface ParseError {
	kind:
		| 'empty_input'
		| 'missing_value'
		| 'unknown_unit'
		| 'ambiguous_unit'
		| 'unknown_fuel'
		| 'no_unit';
	message: string;
	/** For unknown_unit: closest-match unit ids to suggest. */
	suggestions?: string[];
	/** For ambiguous_unit: the competing interpretations. */
	interpretations?: Interpretation[];
	/** The token that failed, for UI highlighting. */
	token?: string;
}

/** The result of parsing free text (spec §8.2). */
export interface ParsedQuery {
	value: string;
	unit_id: string;
	dimension: Dimension;
	fuel_id?: string;
	/** 0..1 heuristic confidence in the parse. */
	confidence: number;
	/** Alias/interpretation notes to gently confirm in the UI (e.g. "'Calorie' → kcal"). */
	notes?: string[];
	original_input: string;
}

/** Discriminated union returned by the parser. */
export type ParseResult = { ok: true; query: ParsedQuery } | { ok: false; error: ParseError };

/* ------------------------------------------------------------------ *
 * Engine options & data bundle
 * ------------------------------------------------------------------ */

/** Options influencing a conversion (rulebook §C.1, §C.6). */
export interface EngineOptions {
	/** Heating-value basis; default 'lhv' (rulebook §C.1). */
	basis?: HeatingBasis;
	/** Region for emission factors (e.g. grid electricity). */
	region?: string;
	/** Year for emission factors. */
	year?: number;
	/** A time quantity for power↔energy bridging (rulebook §B.3, §D.1). */
	time?: Quantity;
	/** Max significant figures for `exact`/`standard_definition` display (default 6). */
	maxSigFigs?: number;
}

/** The validated data the engine runs against. */
export interface DataBundle {
	units: Unit[];
	fuels: Fuel[];
	emissionFactors: EmissionFactor[];
	sources: Source[];
}

/** The public converter API returned by `createConverter` (see conversion/engine.ts). */
export interface Converter {
	parse(text: string): ParseResult;
	convert(query: ParsedQuery, options?: EngineOptions): ConversionResultSet;
	convertText(text: string, options?: EngineOptions): ConversionResultSet | { error: ParseError };
}
