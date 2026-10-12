/**
 * Mixed-case unit URLs (/units/MW, /units/kWh) have no prerendered file — on a
 * case-insensitive filesystem /units/MW and /units/mw would be one file — so
 * Cloudflare answered them with the 404 shell, which then redirected in the
 * browser. A crawler saw HTTP 404. They are now rules in the root `_redirects`
 * file, which Cloudflare Pages matches case-sensitively (probed live
 * 2026-10-12: /units/CaseProbe redirected, /units/caseprobe did not).
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle } from '#lib/index.js';
import {
	buildExactCaseRedirects,
	buildExactSymbolMap,
	buildUnitSlugRedirects,
	redirectsFileText,
	resolveUnitSlug
} from '#lib/ui/unit-slugs.js';

const { units } = loadDataBundle();
const ids = new Set(units.map((u) => u.id));
const prerendered = buildUnitSlugRedirects(units);
const exact = buildExactSymbolMap(units);
const redirects = buildExactCaseRedirects(units);

describe('exact-case unit redirects', () => {
	it('sends MW to the megawatt and mW to the milliwatt', () => {
		expect(redirects.get('MW')).toBe('megawatt');
		expect(redirects.get('mW')).toBe('milliwatt');
		expect(redirects.get('kWh')).toBe('kilowatt_hour');
	});

	it('agrees with the runtime resolver for every rule', () => {
		for (const [slug, id] of redirects) {
			expect(resolveUnitSlug(slug, ids, prerendered, exact), slug).toBe(id);
		}
	});

	it('never shadows a prerendered page or redirect', () => {
		for (const slug of redirects.keys()) {
			expect(ids.has(slug) || prerendered.has(slug), slug).toBe(false);
		}
	});

	it('stays within what a _redirects line can hold', () => {
		for (const slug of redirects.keys()) expect(slug, slug).toMatch(/^[A-Za-z0-9_+-]+$/);
	});

	it('the committed _redirects file matches the catalog (vitest -u rewrites it)', async () => {
		await expect(redirectsFileText(redirects)).toMatchFileSnapshot('../_redirects');
	});
});
