import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { allUnits, unitById, resolveSources } from '$lib/ui/engine';
import { commonConversions } from '$lib/ui/common-conversions';
import { learnForUnit } from '$lib/content/learn';
import { buildUnitSlugAliases } from '$lib/ui/unit-slugs';
import type { EntryGenerator } from './$types';

export const prerender = true;

/** Short-symbol slug (e.g. "kwh") -> canonical unit id (e.g. "kilowatt_hour"). */
const unitSlugAliases = buildUnitSlugAliases(allUnits());

/** Prerender one page per unit id, plus each short-symbol alias slug (these
 *  redirect to the canonical /units/<id> page — see `load` below). */
export const entries: EntryGenerator = () => [
	...allUnits().map((u) => ({ unit: u.id })),
	...[...unitSlugAliases.keys()].map((alias) => ({ unit: alias }))
];

export function load({ params }: { params: { unit: string } }) {
	const canonicalId = unitSlugAliases.get(params.unit);
	if (canonicalId) {
		redirect(308, resolve(`/units/${canonicalId}`));
	}

	const unit = unitById(params.unit);
	if (!unit) throw error(404, `Unknown unit: ${params.unit}`);
	return {
		unit,
		conversions: commonConversions(unit, allUnits()),
		sources: resolveSources(unit.source_refs),
		learn: learnForUnit(unit.id)
	};
}
