// Public API surface for the Universal Converter engine.
// Place files you want to import through the `$lib` alias in this folder.

/** Project name, used for display and as a smoke-test import target. */
export const PROJECT_NAME = 'Universal Converter';

/* ------------------------------------------------------------------ *
 * Types (single source of truth: conversion/types.ts)
 * ------------------------------------------------------------------ */
export type {
	Dimension,
	BaseDimension,
	PseudoDimension,
	Exactness,
	Unit,
	Quantity,
	Fuel,
	HeatingValue,
	HeatingBasis,
	Density,
	EmissionFactor,
	Pollutant,
	Scope,
	Source,
	Assumption,
	Warning,
	WarningSeverity,
	ConversionResult,
	ResultGroup,
	ResultGroupKey,
	ConversionResultSet,
	IllustrativeExample,
	MissingContext,
	ParsedQuery,
	ParseResult,
	ParseError,
	Interpretation,
	EngineOptions,
	DataBundle,
	Converter,
	SourceRef
} from './conversion/types';

export {
	BASE_DIMENSIONS,
	PSEUDO_DIMENSIONS,
	EXACTNESS_LEVELS,
	EXACTNESS_ORDER,
	RESULT_GROUP_ORDER
} from './conversion/types';

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */
export { createConverter } from './conversion/engine';
export { parseQuery, normalizeNumber } from './conversion/parser';
export { combineExactness } from './conversion/precision';
export { UnitRegistry } from './units/registry';
export { FuelRegistry } from './fuels/registry';
export {
	convertWithinDimension,
	toBaseValue,
	fromBaseValue,
	toDecimal
} from './units/exact-conversions';

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */
export {
	formatValue,
	formatRange,
	roundToSigFigs,
	sigFigsFor,
	usesApproxMarker,
	withThousandsSeparators
} from './formatting/numbers';

/* ------------------------------------------------------------------ *
 * Data loading & validation
 * ------------------------------------------------------------------ */
export { loadDataBundle, loadExamples } from './data/load-data';
export { validateAll } from './data/validate-data';
export type { ValidationReport, ValidationIssue } from './data/validate-data';

/* ------------------------------------------------------------------ *
 * Convenience: a converter bound to the shipped data bundle.
 * ------------------------------------------------------------------ */
import { createConverter } from './conversion/engine';
import { loadDataBundle } from './data/load-data';
import type { Converter } from './conversion/types';

let _defaultConverter: Converter | undefined;

/** A converter backed by the repository's validated data files (lazy singleton). */
export function getConverter(): Converter {
	if (!_defaultConverter) {
		_defaultConverter = createConverter(loadDataBundle());
	}
	return _defaultConverter;
}
