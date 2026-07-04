/**
 * Exactness → UI metadata (rulebook §A). One source of truth for the badge
 * label, short/long descriptions, and the CSS custom-property triplet each level
 * uses, so badges and the legend look identical everywhere (spec §10).
 */

import type { Exactness } from '$lib/conversion/types';

export interface ExactnessMeta {
	/** Short badge text. */
	label: string;
	/** One-line description for tooltips / legend. */
	description: string;
	/** CSS var names for background / foreground / border. */
	vars: { bg: string; fg: string; bd: string };
	/** A tiny glyph rendered in the badge (kept as text for crispness). */
	glyph: string;
}

export const EXACTNESS_META: Record<Exactness, ExactnessMeta> = {
	exact: {
		label: 'exact',
		description: 'Follows from an SI or definitional identity — no material assumption.',
		vars: { bg: '--badge-exact-bg', fg: '--badge-exact-fg', bd: '--badge-exact-bd' },
		glyph: '='
	},
	standard_definition: {
		label: 'standard definition',
		description: 'Fixed by a published standard or convention (toe, therm, IT cal/BTU).',
		vars: { bg: '--badge-standard-bg', fg: '--badge-standard-fg', bd: '--badge-standard-bd' },
		glyph: '§'
	},
	source_based: {
		label: 'source-based',
		description: 'A measured/tabulated value from a cited source; varies in reality.',
		vars: { bg: '--badge-source-bg', fg: '--badge-source-fg', bd: '--badge-source-bd' },
		glyph: '◆'
	},
	estimated: {
		label: 'estimate',
		description: 'A representative value with genuine spread — shown with a ~ marker.',
		vars: { bg: '--badge-estimate-bg', fg: '--badge-estimate-fg', bd: '--badge-estimate-bd' },
		glyph: '~'
	},
	region_year_specific: {
		label: 'region + year',
		description: 'Correct only for a stated region and year (e.g. grid electricity).',
		vars: { bg: '--badge-region-bg', fg: '--badge-region-fg', bd: '--badge-region-bd' },
		glyph: '⌖'
	},
	user_assumption: {
		label: 'your assumption',
		description: 'Depends on a value you supplied or accepted (density, basis, condition).',
		vars: { bg: '--badge-user-bg', fg: '--badge-user-fg', bd: '--badge-user-bd' },
		glyph: '✎'
	},
	context_required: {
		label: 'context required',
		description: 'Answerable once you supply one more thing — a prompt, not an error.',
		vars: { bg: '--badge-context-bg', fg: '--badge-context-fg', bd: '--badge-context-bd' },
		glyph: '?'
	},
	unsupported: {
		label: 'not available',
		description: 'Not meaningful, not in scope, or impossible even in principle.',
		vars: {
			bg: '--badge-unsupported-bg',
			fg: '--badge-unsupported-fg',
			bd: '--badge-unsupported-bd'
		},
		glyph: '×'
	}
};

/** The legend order used on the methodology page and popovers. */
export const EXACTNESS_LEGEND_ORDER: Exactness[] = [
	'exact',
	'standard_definition',
	'source_based',
	'estimated',
	'region_year_specific',
	'user_assumption',
	'context_required',
	'unsupported'
];

/** Inline style string for a badge of the given exactness. */
export function badgeStyle(exactness: Exactness): string {
	const m = EXACTNESS_META[exactness];
	return `background-color:var(${m.vars.bg});color:var(${m.vars.fg});border-color:var(${m.vars.bd});`;
}
