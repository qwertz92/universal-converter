/**
 * "What did you just type?" — the live feedback layer behind the converter
 * input (v0.3 UX).
 *
 * Two jobs, both pure functions so they can be unit-tested without a browser:
 *
 *  1. `describeQuery` turns the current text into a short, honest statement of
 *     what the engine understood — which unit, which material, which target,
 *     which duration — or what is still missing. A first-time visitor should
 *     never have to guess whether the unit is required, whether it was
 *     recognised, or which of several readings won.
 *  2. `suggestCompletions` offers the units/materials that match the token
 *     being typed, so the catalog is discoverable from the keyboard instead of
 *     from the documentation.
 *
 * Neither function invents anything: both read the same registries the engine
 * uses, and the description reports the parse result rather than a guess.
 */

import type { Fuel, ParseError, ParseResult, Unit } from '$lib/conversion/types';
import { DIMENSION_LABEL } from '$lib/ui/engine';
import { searchFuels, searchUnits } from '$lib/ui/search';

/** Words that introduce a conversion target (mirrors the parser's grammar). */
const TARGET_WORDS = new Set(['to', 'in', 'into', 'as', '->', '→', '⇒', '=', '=>']);
/** Leading numeric literal, mirroring the parser (kept simple: detection only). */
const LEADING_NUMBER = /^[+-]?(?:\d[\d\s.,]*|[.,]\d+)/;

export type InterpretationStatus = 'empty' | 'ok' | 'incomplete' | 'unsupported';

export interface QueryInterpretation {
	status: InterpretationStatus;
	/** One short line: what was understood, or what is missing. */
	message: string;
	/** Optional calmer second line (only for the states that need teaching). */
	hint?: string;
	/** Which parse error produced a non-`ok` status, so the UI can offer the
	 *  right repair (e.g. one-click unit chips when only the unit is missing). */
	errorKind?: ParseError['kind'];
	/** Structured echo, for chip-style rendering. */
	value?: string;
	unit?: { id: string; symbol: string; name: string; dimension: string };
	fuel?: { id: string; name: string };
	target?: { id: string; symbol: string; name: string };
	duration?: string;
}

/**
 * Describe the current query text. `parse` is the engine's own parser, so this
 * can never drift from what the conversion actually does.
 */
export function describeQuery(
	text: string,
	parse: (text: string) => ParseResult,
	units: Unit[]
): QueryInterpretation {
	const trimmed = text.trim();
	if (trimmed === '') {
		return {
			status: 'empty',
			message: 'Type a value and a unit.',
			hint: 'For example 1 kWh · 10 L diesel · 5 kW for 3 h · 1 kWh to MJ'
		};
	}

	const result = parse(trimmed);
	if (!result.ok) {
		const error = result.error;
		const unsupported = error.kind === 'unknown_unit' || error.kind === 'unsupported_value';
		return {
			status: unsupported ? 'unsupported' : 'incomplete',
			message: error.message,
			hint: error.hint,
			errorKind: error.kind
		};
	}

	const query = result.query;
	const unit = units.find((u) => u.id === query.unit_id);
	const target = query.target_unit_id
		? units.find((u) => u.id === query.target_unit_id)
		: undefined;
	const timeUnit = query.time ? units.find((u) => u.id === query.time?.unit_id) : undefined;

	const parts: string[] = [];
	if (unit) parts.push(`${query.value} ${unit.symbols[0]} (${unit.names[0]})`);
	if (query.fuel_id) parts.push(`of ${query.fuel_id.replace(/-/g, ' ')}`);
	if (query.time && timeUnit) parts.push(`over ${query.time.value} ${timeUnit.symbols[0]}`);
	if (target) parts.push(`→ ${target.symbols[0]} (${target.names[0]})`);

	return {
		status: 'ok',
		message: parts.join(' '),
		value: query.value,
		unit: unit
			? {
					id: unit.id,
					symbol: unit.symbols[0],
					name: unit.names[0],
					dimension: DIMENSION_LABEL[unit.dimension] ?? unit.dimension
				}
			: undefined,
		fuel: query.fuel_id ? { id: query.fuel_id, name: query.fuel_id.replace(/-/g, ' ') } : undefined,
		target: target
			? { id: target.id, symbol: target.symbols[0], name: target.names[0] }
			: undefined,
		duration: query.time && timeUnit ? `${query.time.value} ${timeUnit.symbols[0]}` : undefined
	};
}

/**
 * The units a newcomer is most likely to want first, offered as one-click chips
 * when a value was typed without a unit. Ids only — each is looked up in the
 * real catalog, so a chip can never reference a unit we do not ship.
 */
const STARTER_UNIT_IDS = [
	'kilowatt_hour',
	'megajoule',
	'kilocalorie',
	'btu',
	'kilogram',
	'liter',
	'cubic_meter',
	'kilowatt'
];

/** Resolve the starter chips against the shipped catalog, dropping any gaps. */
export function starterUnits(units: Unit[]): Unit[] {
	const byId = new Map(units.map((u) => [u.id, u]));
	return STARTER_UNIT_IDS.map((id) => byId.get(id)).filter((u): u is Unit => Boolean(u));
}

export interface Completion {
	kind: 'unit' | 'fuel';
	id: string;
	/** Canonical name, e.g. "kilowatt hour". */
	label: string;
	/** Symbol or category, shown muted. */
	hint: string;
	/** Group heading, e.g. "Energy" or "oil". */
	group: string;
	/** The full query text this completion would produce. */
	apply: string;
}

export interface CompletionState {
	/** The partial token the suggestions complete (empty → no dropdown). */
	token: string;
	items: Completion[];
	/** True when the token sits after a target keyword ("… to kW|"). */
	targetSlot: boolean;
}

/**
 * Suggest units (and materials) for the token currently being typed.
 *
 * Only the trailing token is completed, which keeps the behaviour predictable:
 * what you see highlighted is exactly what replaces the word under the cursor.
 * Materials are offered only where they can change the answer — after a
 * mass/volume/energy unit — so the list stays short and relevant.
 */
export function suggestCompletions(
	text: string,
	units: Unit[],
	fuels: Fuel[],
	limit = 8
): CompletionState {
	const empty: CompletionState = { token: '', items: [], targetSlot: false };
	// Nothing to complete while the value is still missing: the interpretation
	// line is the right teacher at that point, not a dropdown.
	if (!LEADING_NUMBER.test(text.trimStart())) return empty;
	if (/\s$/.test(text) || text.trim() === '') return empty;

	const words = text.trim().split(/\s+/);
	const token = words[words.length - 1];
	// A token glued to the number ("5kw") still completes; the value is kept.
	const numeric = token.match(LEADING_NUMBER)?.[0] ?? '';
	const partial = token.slice(numeric.length);
	if (partial.length === 0) return empty;

	const previous = (words[words.length - 2] ?? '').toLowerCase();
	const targetSlot = TARGET_WORDS.has(previous);

	const prefix = words.slice(0, words.length - 1);
	const rebuild = (insert: string) =>
		[...prefix, numeric ? `${numeric} ${insert}` : insert].join(' ');

	const items: Completion[] = [];
	for (const u of searchUnits(units, partial, limit)) {
		items.push({
			kind: 'unit',
			id: u.id,
			label: u.names[0],
			hint: u.symbols[0],
			group: DIMENSION_LABEL[u.dimension] ?? u.dimension,
			apply: rebuild(u.symbols[0])
		});
	}

	// Materials only make sense once an amount has a unit, and never in the
	// target slot ("… to diesel" is not a conversion).
	if (!targetSlot && prefix.length > 0) {
		for (const f of searchFuels(fuels, partial, 4)) {
			items.push({
				kind: 'fuel',
				id: f.id,
				label: f.names[0],
				hint: f.category,
				group: 'Material',
				apply: rebuild(f.names[0])
			});
		}
	}

	return { token: partial, items: items.slice(0, limit + 4), targetSlot };
}
