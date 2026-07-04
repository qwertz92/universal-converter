/**
 * Typed data loader. Statically imports the five JSON data files, parses them
 * through the Zod schemas, and assembles a validated `DataBundle` the engine
 * consumes. Static imports work in both Vite and Vitest (spec §5 architecture).
 *
 * `resolveJsonModule` is enabled (tsconfig.json), so the JSON imports are typed.
 * We still run them through Zod so bad edits fail loudly rather than at runtime
 * deep inside the engine.
 */

import type { DataBundle, EmissionFactor, Fuel, Source, Unit } from '$lib/conversion/types';
import unitsJson from '../../../data/units.json';
import fuelsJson from '../../../data/fuels.json';
import emissionFactorsJson from '../../../data/emission-factors.json';
import sourcesJson from '../../../data/sources.json';
import examplesJson from '../../../data/examples.json';
import {
	emissionFactorsFileSchema,
	examplesFileSchema,
	fuelsFileSchema,
	sourcesFileSchema,
	unitsFileSchema,
	type ExampleEntry
} from './schemas';

/**
 * Parse + validate all data files and return the engine's `DataBundle`.
 * Throws a descriptive error if any file fails its schema (fail loud).
 */
export function loadDataBundle(): DataBundle {
	const units = unitsFileSchema.parse(unitsJson).units as Unit[];
	const fuels = fuelsFileSchema.parse(fuelsJson).fuels as Fuel[];
	const emissionFactors = emissionFactorsFileSchema.parse(emissionFactorsJson)
		.emission_factors as EmissionFactor[];
	const sources = sourcesFileSchema.parse(sourcesJson).sources as Source[];

	return { units, fuels, emissionFactors, sources };
}

/** Parse + validate the quick-examples file. */
export function loadExamples(): ExampleEntry[] {
	return examplesFileSchema.parse(examplesJson).examples;
}

/** The raw (unvalidated) JSON, exposed for the validator's structured reporting. */
export const rawData = {
	units: unitsJson,
	fuels: fuelsJson,
	emissionFactors: emissionFactorsJson,
	sources: sourcesJson,
	examples: examplesJson
};
