import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';
import { basisSections } from '$lib/ui/basis-sections';

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
