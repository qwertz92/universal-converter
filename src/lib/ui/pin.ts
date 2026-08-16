/**
 * Pinned units — "iterate mode".
 *
 * Typing the unit on every line is fine for one lookup and tedious for twenty.
 * A pin lets you fix the unit you are working in (and optionally the one you
 * want out), after which a bare number is a complete query: `5`, `12`, `0.4`.
 *
 * This is NOT the tool guessing. The rule it must not break is "never assume a
 * unit the user did not give" — a pin is the user giving it, once, explicitly,
 * and it stays visible in the interface, removable in one click, and carried in
 * the URL so a shared link reproduces exactly what the sender saw. All this
 * module does is compose the full query the engine would have received anyway.
 */

import type { ParseResult, Unit } from '$lib/conversion/types';

export interface Pin {
	/** Unit a bare number is measured in. */
	from?: string;
	/** Unit to convert into, when the query does not name one. */
	to?: string;
}

/** Serialised form for the URL: "kWh" or "kWh>MJ". */
export function encodePin(pin: Pin, units: Unit[]): string {
	const symbol = (id?: string) => units.find((u) => u.id === id)?.symbols[0];
	const from = symbol(pin.from);
	const to = symbol(pin.to);
	if (from && to) return `${from}>${to}`;
	if (from) return from;
	if (to) return `>${to}`;
	return '';
}

/**
 * Parse a pin from the URL. Unknown or ambiguous symbols are dropped rather
 * than guessed — a link with a typo must not silently convert the wrong thing.
 */
export function decodePin(raw: string | null, units: Unit[]): Pin {
	if (!raw) return {};
	const [fromRaw, toRaw] = raw.split('>');
	const match = (token: string | undefined) => {
		const t = token?.trim().toLowerCase();
		if (!t) return undefined;
		const hits = units.filter(
			(u) =>
				u.id.toLowerCase() === t ||
				u.symbols.some((s) => s.toLowerCase() === t) ||
				u.names.some((n) => n.toLowerCase() === t)
		);
		return hits.length === 1 ? hits[0].id : undefined;
	};
	const pin: Pin = { from: match(fromRaw), to: match(toRaw) };
	return pin.from || pin.to ? pin : {};
}

export interface PinnedQuery {
	/** The query the engine should actually run. */
	text: string;
	/** True when the pinned FROM unit supplied the missing unit. */
	usedFrom: boolean;
	/** True when the pinned TO unit supplied the missing target. */
	usedTo: boolean;
}

/**
 * Compose the effective query from what was typed plus the pin.
 *
 * The pin only ever FILLS A GAP: an explicit unit or target in the text always
 * wins, so pinning cannot override what someone actually wrote.
 */
export function applyPin(
	text: string,
	pin: Pin,
	parse: (text: string) => ParseResult,
	units: Unit[]
): PinnedQuery {
	const trimmed = text.trim();
	const result: PinnedQuery = { text: trimmed, usedFrom: false, usedTo: false };
	if (trimmed === '' || (!pin.from && !pin.to)) return result;

	const symbol = (id: string) => units.find((u) => u.id === id)?.symbols[0];
	let working = trimmed;

	// FROM: only when the text does not already parse to a unit of its own.
	if (pin.from) {
		const parsed = parse(working);
		const needsUnit =
			!parsed.ok && (parsed.error.kind === 'no_unit' || parsed.error.kind === 'missing_value');
		if (needsUnit) {
			const sym = symbol(pin.from);
			// A bare value only: anything else (a stray word, a bad number) is left
			// alone so its own error still reaches the user.
			if (sym && /^[+-]?[\d.,\s]+$/.test(working)) {
				working = `${working} ${sym}`;
				result.usedFrom = true;
			}
		}
	}

	// TO: only when the (possibly completed) query has no target of its own.
	if (pin.to) {
		const parsed = parse(working);
		if (parsed.ok && !parsed.query.target_unit_id && parsed.query.unit_id !== pin.to) {
			const sym = symbol(pin.to);
			if (sym) {
				working = `${working} to ${sym}`;
				result.usedTo = true;
			}
		}
	}

	result.text = working;
	return result;
}
