/**
 * Result-group assembly (rulebook §C.8). Collects individual `ConversionResult`s
 * into titled groups and emits them in the canonical order. The meta-groups
 * (assumptions/warnings/sources/formula) are aggregated from all results.
 */

import {
	RESULT_GROUP_ORDER,
	type Assumption,
	type ConversionResult,
	type ConversionResultSet,
	type ResultGroup,
	type ResultGroupKey,
	type SourceRef,
	type Warning
} from './types';

const GROUP_TITLES: Record<ResultGroupKey, string> = {
	energy: 'Energy',
	power: 'Power',
	mass: 'Mass',
	volume: 'Volume',
	time: 'Time',
	fuel_equivalents: 'Fuel Equivalents',
	emissions: 'Emissions',
	energy_density: 'Energy Density',
	industrial_units: 'Industrial Units',
	assumptions: 'Assumptions',
	warnings: 'Warnings',
	sources: 'Sources',
	formula: 'Formula / Calculation Path'
};

/** Accumulates results and builds the ordered ConversionResultSet. */
export class ResultSetBuilder {
	private readonly buckets = new Map<ResultGroupKey, ConversionResult[]>();
	private readonly assumptions: Assumption[] = [];
	private readonly warnings: Warning[] = [];
	private readonly sourceRefs = new Set<SourceRef>();

	constructor(
		private readonly input: ConversionResultSet['input'],
		private readonly formulaLines: string[] = []
	) {}

	/** Add a result to its category bucket and aggregate its meta. */
	add(result: ConversionResult): this {
		const bucket = this.buckets.get(result.category) ?? [];
		bucket.push(result);
		this.buckets.set(result.category, bucket);
		this.collectMeta(result.assumptions, result.warnings, result.source_refs);
		if (result.formula) this.formulaLines.push(result.formula);
		return this;
	}

	addAssumption(a: Assumption): this {
		this.pushAssumption(a);
		return this;
	}

	addWarning(w: Warning): this {
		this.pushWarning(w);
		return this;
	}

	private collectMeta(assumptions: Assumption[], warnings: Warning[], refs: SourceRef[]): void {
		for (const a of assumptions) this.pushAssumption(a);
		for (const w of warnings) this.pushWarning(w);
		for (const r of refs) this.sourceRefs.add(r);
	}

	private pushAssumption(a: Assumption): void {
		if (!this.assumptions.some((x) => x.kind === a.kind && x.text === a.text)) {
			this.assumptions.push(a);
		}
	}

	private pushWarning(w: Warning): void {
		if (!this.warnings.some((x) => x.kind === w.kind && x.text === w.text)) {
			this.warnings.push(w);
		}
	}

	/** Materialise the ordered result set, including meta-groups where non-empty. */
	build(): ConversionResultSet {
		const groups: ResultGroup[] = [];
		for (const key of RESULT_GROUP_ORDER) {
			if (key === 'assumptions' || key === 'warnings' || key === 'sources' || key === 'formula') {
				continue; // meta-groups handled below
			}
			const results = this.buckets.get(key);
			if (results && results.length > 0) {
				groups.push({ key, title: GROUP_TITLES[key], results });
			}
		}

		// Meta-groups, in canonical order, only when they carry content.
		if (this.assumptions.length > 0) {
			groups.push({
				key: 'assumptions',
				title: GROUP_TITLES.assumptions,
				results: this.assumptions.map((a) => assumptionAsResult(a))
			});
		}
		if (this.warnings.length > 0) {
			groups.push({
				key: 'warnings',
				title: GROUP_TITLES.warnings,
				results: this.warnings.map((w) => warningAsResult(w))
			});
		}
		if (this.sourceRefs.size > 0) {
			groups.push({
				key: 'sources',
				title: GROUP_TITLES.sources,
				results: [...this.sourceRefs].map((ref) => sourceAsResult(ref))
			});
		}
		if (this.formulaLines.length > 0) {
			groups.push({
				key: 'formula',
				title: GROUP_TITLES.formula,
				results: this.formulaLines.map((line) => formulaAsResult(line))
			});
		}

		return {
			input: this.input,
			groups,
			assumptions: this.assumptions,
			warnings: this.warnings,
			source_refs: [...this.sourceRefs]
		};
	}
}

/* Meta entries are surfaced as lightweight ConversionResults so the Frontend can
 * render every group uniformly (rulebook §C.8: meta-groups are still groups). */

function assumptionAsResult(a: Assumption): ConversionResult {
	return {
		value: null,
		raw: null,
		unit_id: '',
		unit_label: '',
		category: 'assumptions',
		exactness: 'user_assumption',
		explanation: a.text,
		assumptions: [a],
		warnings: [],
		source_refs: a.source_refs ?? []
	};
}

function warningAsResult(w: Warning): ConversionResult {
	return {
		value: null,
		raw: null,
		unit_id: '',
		unit_label: '',
		category: 'warnings',
		exactness: 'unsupported',
		explanation: w.text,
		assumptions: [],
		warnings: [w],
		source_refs: []
	};
}

function sourceAsResult(ref: SourceRef): ConversionResult {
	return {
		value: null,
		raw: null,
		unit_id: '',
		unit_label: ref,
		category: 'sources',
		exactness: 'source_based',
		explanation: `Source: ${ref}`,
		assumptions: [],
		warnings: [],
		source_refs: [ref]
	};
}

function formulaAsResult(line: string): ConversionResult {
	return {
		value: null,
		raw: null,
		unit_id: '',
		unit_label: '',
		category: 'formula',
		exactness: 'exact',
		explanation: line,
		assumptions: [],
		warnings: [],
		source_refs: []
	};
}
