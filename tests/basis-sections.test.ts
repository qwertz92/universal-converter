import { describe, expect, it } from 'vitest';
import { getConverter } from '#lib/index.js';
import { basisSections, sharedExactness } from '#lib/ui/basis-sections.js';

function group(input: string, key: string) {
	const out = getConverter().convertText(input);
	if ('error' in out) throw new Error(out.error.message);
	const g = out.groups.find((x) => x.key === key);
	if (!g) throw new Error(`no ${key} group for ${input}`);
	return g.results;
}

describe('basisSections', () => {
	it('puts LHV and HHV figures for a fuel under separate headings, LHV first', () => {
		const sections = basisSections(group('10 L diesel', 'energy'));
		expect(sections.map((s) => s.basis)).toEqual(['lhv', 'hhv']);
		// Same four units on each side — the split must not lose or move a row.
		expect(sections.map((s) => s.rows.map((r) => r.unit_label))).toEqual([
			['MJ', 'kWh', 'GJ', 'BTU'],
			['MJ', 'kWh', 'GJ', 'BTU']
		]);
	});

	it('leaves a group without any basis as one untitled run', () => {
		const sections = basisSections(group('1 kWh', 'energy'));
		expect(sections).toHaveLength(1);
		expect(sections[0].basis).toBeUndefined();
	});
});

describe('sharedExactness: one label for the rows that share it', () => {
	const rows = (text: string) => {
		const out = getConverter().convertText(text);
		if ('error' in out) throw new Error(out.error.message);
		return out.groups;
	};
	it('a fuel energy section is all source-based', () => {
		const energy = rows('10 L diesel').find((g) => g.key === 'energy')!;
		const lhv = basisSections(energy.results).find((s) => s.basis === 'lhv')!;
		expect(sharedExactness(lhv.rows)).toBe('source_based');
	});
	it('a plain energy conversion is mostly exact; the odd row keeps its own label', () => {
		const energy = rows('1000 kWh').find((g) => g.key === 'energy')!;
		expect(sharedExactness(energy.results)).toBe('exact');
		expect(energy.results.some((r) => r.exactness !== 'exact')).toBe(true);
	});
	it('a single row, or no majority, has nothing to share', () => {
		const energy = rows('1000 kWh').find((g) => g.key === 'energy')!;
		expect(sharedExactness(energy.results.slice(0, 1))).toBeUndefined();
		const mixed = [
			{ ...energy.results[0], exactness: 'exact' as const },
			{ ...energy.results[1], exactness: 'estimated' as const }
		];
		expect(sharedExactness(mixed)).toBeUndefined();
	});
});
