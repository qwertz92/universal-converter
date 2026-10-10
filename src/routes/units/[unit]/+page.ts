import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { allUnits, unitById, resolveSources } from '$lib/ui/engine';
import { commonConversions } from '$lib/ui/common-conversions';
import { learnForUnit } from '$lib/content/learn';
import { buildExactSymbolMap, buildUnitSlugRedirects, resolveUnitSlug } from '$lib/ui/unit-slugs';
import type { EntryGenerator } from './$types';

export const prerender = true;

const unitIds = new Set(allUnits().map((u) => u.id));

/** Alternative slug (short symbol "kwh", hyphenated "kilowatt-hour") -> canonical
 *  unit id ("kilowatt_hour"). */
const unitSlugRedirects = buildUnitSlugRedirects(allUnits());
const exactSymbols = buildExactSymbolMap(allUnits());

/** Prerender one page per unit id, plus each alternative slug (these redirect to
 *  the canonical /units/<id> page — see `load` below). */
export const entries: EntryGenerator = () => [
	...allUnits().map((u) => ({ unit: u.id })),
	...[...unitSlugRedirects.keys()].map((alias) => ({ unit: alias }))
];

export function load({ params }: { params: { unit: string } }) {
	// Also reached at runtime (dev server, in-app navigation), where it tolerates
	// case and hyphen/underscore mix-ups that no prerendered file exists for.
	const canonicalId = resolveUnitSlug(params.unit, unitIds, unitSlugRedirects, exactSymbols);
	if (canonicalId && canonicalId !== params.unit) {
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
