/**
 * Clicking a disambiguation chip must RESOLVE the ambiguity.
 *
 * The repair used to replace the last word of the query, which for anything
 * other than a bare "1 ton" deleted the material or target the user had typed
 * and left the ambiguous token in place — so the same prompt came back, every
 * press made it worse, and there was no way out except retyping.
 *
 * This mirrors the component's repair logic against the real parser.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import type { ParseError } from '$lib/conversion/types';

const converter = getConverter();

/** The exact repair `Converter.onErrorPick` performs. */
function repair(query: string, replacement: string, replaces?: string): string {
	if (!replaces) return replacement;
	const escaped = replaces.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i');
	return pattern.test(query)
		? query.replace(pattern, `$1${replacement}`)
		: `${query.replace(/\S+\s*$/, '')}${replacement}`;
}

function parseError(query: string): ParseError {
	const out = converter.convertText(query);
	if (!('error' in out)) throw new Error(`"${query}" unexpectedly parsed`);
	return out.error;
}

describe('every disambiguation chip resolves its own query', () => {
	it.each(['1 ton', '2 tons coal', '10 gallons diesel', '1 ton to kg', '5 gallon gasoline'])(
		'"%s" is fixed by every choice it offers',
		(query) => {
			const error = parseError(query);
			expect(error.kind).toBe('ambiguous_unit');
			expect(error.interpretations?.length).toBeGreaterThan(1);

			for (const interp of error.interpretations ?? []) {
				const repaired = repair(query, interp.label, error.token);
				const out = converter.convertText(repaired);
				// The chip must resolve the ambiguity it is FOR. It cannot promise
				// the query has no other question left in it — "2 tons coal" has
				// two: which ton, and which coal grade. Answering the first must
				// not be judged a failure because the second is still open.
				const stillAmbiguousUnit = 'error' in out && out.error.kind === 'ambiguous_unit';
				expect(stillAmbiguousUnit, `"${query}" + "${interp.label}" → "${repaired}"`).toBe(false);
			}
		}
	);

	it('keeps the material the user typed', () => {
		const error = parseError('10 gallons diesel');
		const repaired = repair('10 gallons diesel', 'US gallon', error.token);
		expect(repaired).toContain('diesel');
		const out = converter.convertText(repaired);
		if ('error' in out) throw new Error('repair failed');
		expect(out.input.fuel_id).toBe('diesel');
	});

	it('keeps the target the user typed', () => {
		const error = parseError('1 ton to kg');
		const repaired = repair('1 ton to kg', 'tonne', error.token);
		const out = converter.convertText(repaired);
		if ('error' in out) throw new Error('repair failed');
		expect(out.target?.unit_id).toBe('kilogram');
	});

	it('an unknown-unit suggestion replaces only the failing token', () => {
		const error = parseError('1 kilowat hour diesel');
		if (error.kind !== 'unknown_unit') return; // catalog may resolve it directly
		const suggestion = (error.suggestions ?? [])[0];
		if (!suggestion) return;
		const repaired = repair('1 kilowat hour diesel', suggestion.replace(/_/g, ' '), error.token);
		expect(repaired).toContain('diesel');
	});

	it('an example chip (no token) replaces the whole query', () => {
		expect(repair('nonsense here', '1 kWh')).toBe('1 kWh');
	});
});
