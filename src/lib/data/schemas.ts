/**
 * Zod schemas for the five versioned data files (spec §7.1–§7.5, refined by the
 * rulebook). This module is the single owner of the data-file contract; the
 * loader (`load-data.ts`) and validator (`validate-data.ts`) both build on it.
 *
 * Numeric values in the data files may be stored as JSON numbers OR strings
 * (strings are allowed for exact decimal factors so precision survives JSON).
 * We normalise every numeric field to a STRING here so the engine can feed it
 * straight into decimal.js without a lossy float step.
 */

import { z } from 'zod';
import {
	BASE_DIMENSIONS,
	EXACTNESS_LEVELS,
	PSEUDO_DIMENSIONS,
	type Dimension,
	type Exactness
} from '$lib/conversion/types';

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

/** kebab-case / snake-case id (letters, digits, underscores, hyphens). */
const idSchema = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9_-]*$/, 'ids must be lowercase kebab/snake-case');

/**
 * A numeric value that may arrive as a JSON number or a decimal string, coerced
 * to a validated decimal string. Rejects NaN/Infinity and non-numeric text.
 */
const decimalString = z.union([z.number(), z.string()]).transform((v, ctx) => {
	const s = typeof v === 'number' ? String(v) : v.trim();
	if (s === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
		ctx.addIssue({ code: 'custom', message: `not a finite decimal: ${JSON.stringify(v)}` });
		return z.NEVER;
	}
	return s;
});

const allDimensions = [...BASE_DIMENSIONS, ...PSEUDO_DIMENSIONS] as [Dimension, ...Dimension[]];
const dimensionSchema = z.enum(allDimensions);
const exactnessSchema = z.enum(EXACTNESS_LEVELS as [Exactness, ...Exactness[]]);
const heatingBasisSchema = z.enum(['lhv', 'hhv']);
const sourceRefSchema = idSchema;

const rangeSchema = z.object({ low: decimalString, high: decimalString });

/* ------------------------------------------------------------------ *
 * units.json
 * ------------------------------------------------------------------ */

export const unitSchema = z
	.object({
		id: idSchema,
		dimension: dimensionSchema,
		symbols: z.array(z.string().min(1)).min(1),
		names: z.array(z.string().min(1)).min(1),
		aliases: z.array(z.string().min(1)).default([]),
		to_base_factor: decimalString,
		offset_formula_if_needed: z.string().optional(),
		system: z.string().optional(),
		is_exact: z.boolean(),
		exactness: exactnessSchema,
		notes: z.string().optional(),
		source_refs: z.array(sourceRefSchema).default([])
	})
	.strict();

export const unitsFileSchema = z
	.object({
		$comment: z.string().optional(),
		units: z.array(unitSchema)
	})
	.strict();

/* ------------------------------------------------------------------ *
 * sources.json
 * ------------------------------------------------------------------ */

export const sourceSchema = z
	.object({
		id: idSchema,
		title: z.string().min(1),
		publisher: z.string().optional(),
		url: z.string().url().optional(),
		retrieved_at: z.string().optional(),
		publication_year: z.number().int().optional(),
		license: z.string().optional(),
		type: z.string().optional(),
		reliability: z.string().optional(),
		notes: z.string().optional()
	})
	.strict();

export const sourcesFileSchema = z
	.object({
		$comment: z.string().optional(),
		sources: z.array(sourceSchema)
	})
	.strict();

/* ------------------------------------------------------------------ *
 * fuels.json
 * ------------------------------------------------------------------ */

const heatingValueSchema = z
	.object({
		basis: heatingBasisSchema,
		value: decimalString,
		unit: idSchema,
		range: rangeSchema.optional(),
		source_refs: z.array(sourceRefSchema).min(1),
		notes: z.string().optional()
	})
	.strict();

const densitySchema = z
	.object({
		value: decimalString,
		unit: idSchema,
		range: rangeSchema.optional(),
		reference_conditions: z.string().optional(),
		source_refs: z.array(sourceRefSchema).min(1),
		notes: z.string().optional()
	})
	.strict();

export const fuelSchema = z
	.object({
		id: idSchema,
		names: z.array(z.string().min(1)).min(1),
		aliases: z.array(z.string().min(1)).default([]),
		category: z.string().min(1),
		density: densitySchema.optional(),
		heating_values: z.array(heatingValueSchema).default([]),
		emission_factor_ids: z.array(idSchema).default([]),
		phase: z.enum(['gas', 'liquid', 'solid']).optional(),
		/**
		 * Close relatives a reader could easily have meant instead — see ADR 0005.
		 * Variants like gas oil (red diesel) are separate fuels with genuinely
		 * different numbers, so each names its neighbours rather than hoping
		 * nobody picks the wrong one.
		 */
		related_fuels: z.array(idSchema).default([]),
		typical_ranges: z.string().optional(),
		source_refs: z.array(sourceRefSchema).default([]),
		notes: z.string().optional(),
		warnings: z.array(z.string().min(1)).default([])
	})
	.strict();

export const fuelsFileSchema = z
	.object({
		$comment: z.string().optional(),
		fuels: z.array(fuelSchema)
	})
	.strict();

/* ------------------------------------------------------------------ *
 * emission-factors.json
 * ------------------------------------------------------------------ */

const pollutantSchema = z.enum(['CO2', 'CH4', 'N2O', 'CO2e', 'biogenic_CO2']);

/**
 * What physical amount a factor multiplies. A free-form string let three
 * electricity factors say `intensity_per_energy` while every other per-energy
 * factor said `mass_per_energy`, and nothing noticed — the engine keys off
 * `unit` alone. The enum pins the vocabulary; `validate-data.ts` additionally
 * checks that the declared metric agrees with the factor's unit, so a
 * `kg_co2_per_l` factor can never claim to be per-energy.
 */
const emissionMetricSchema = z.enum(['mass_per_energy', 'mass_per_mass', 'mass_per_volume']);
const scopeSchema = z.enum([
	'direct_combustion',
	'scope_1',
	'scope_2',
	'scope_3_upstream',
	'well_to_tank',
	'tank_to_wheel',
	'well_to_wheel',
	'outside_of_scopes',
	'unknown_or_mixed'
]);

export const emissionFactorSchema = z
	.object({
		id: idSchema,
		fuel_id: idSchema.optional(),
		pollutant: pollutantSchema,
		metric: emissionMetricSchema,
		value: decimalString,
		unit: idSchema,
		basis: heatingBasisSchema.optional(),
		scope: scopeSchema,
		region: z.string().optional(),
		year: z.number().int().optional(),
		biogenic: z.boolean().optional(),
		uncertainty: z.string().optional(),
		source_id: sourceRefSchema,
		source_table_or_page: z.string().optional(),
		notes: z.string().optional()
	})
	.strict();

export const emissionFactorsFileSchema = z
	.object({
		$comment: z.string().optional(),
		emission_factors: z.array(emissionFactorSchema)
	})
	.strict();

/* ------------------------------------------------------------------ *
 * examples.json
 * ------------------------------------------------------------------ */

export const exampleSchema = z
	.object({
		id: idSchema,
		input: z.string().min(1),
		label: z.string().optional(),
		category: z.string().optional(),
		notes: z.string().optional()
	})
	.strict();

export const examplesFileSchema = z
	.object({
		$comment: z.string().optional(),
		examples: z.array(exampleSchema)
	})
	.strict();

/* ------------------------------------------------------------------ *
 * Inferred types (kept in sync with the schemas above)
 * ------------------------------------------------------------------ */

export type UnitsFile = z.infer<typeof unitsFileSchema>;
export type SourcesFile = z.infer<typeof sourcesFileSchema>;
export type FuelsFile = z.infer<typeof fuelsFileSchema>;
export type EmissionFactorsFile = z.infer<typeof emissionFactorsFileSchema>;
export type ExamplesFile = z.infer<typeof examplesFileSchema>;
export type ExampleEntry = z.infer<typeof exampleSchema>;
