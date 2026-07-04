import { error } from '@sveltejs/kit';
import { allUnits, unitById, resolveSources } from '$lib/ui/engine';
import { commonConversions } from '$lib/ui/common-conversions';
import { learnForUnit } from '$lib/content/learn';
import type { EntryGenerator } from './$types';

export const prerender = true;

/** Prerender one page per unit id. */
export const entries: EntryGenerator = () => allUnits().map((u) => ({ unit: u.id }));

export function load({ params }: { params: { unit: string } }) {
	const unit = unitById(params.unit);
	if (!unit) throw error(404, `Unknown unit: ${params.unit}`);
	return {
		unit,
		conversions: commonConversions(unit, allUnits()),
		sources: resolveSources(unit.source_refs),
		learn: learnForUnit(unit.id)
	};
}
