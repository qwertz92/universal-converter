/**
 * GET /sitemap.xml — lists every prerendered page as an absolute URL (SEO
 * batch). Units/fuels/learn topics are enumerated from the same data the
 * page-level `EntryGenerator`s use (`$lib/ui/engine`, `$lib/content/learn`) —
 * never a hardcoded id list — so this can't silently drift from what's
 * actually built. No <lastmod>: we don't track per-page dates, so we don't
 * invent them.
 *
 * Deliberately excluded:
 *  - /api/convert — the app's one non-prerendered (dynamic) route.
 *  - unit short-slug aliases (e.g. /units/kwh, see src/lib/ui/unit-slugs.ts)
 *    — these 308-redirect to their canonical /units/<id> page, and a
 *    redirecting URL doesn't belong in a sitemap.
 */
import { allFuels, allUnits } from '$lib/ui/engine';
import { LEARN_TOPICS } from '$lib/content/learn';
import type { RequestHandler } from './$types';

export const prerender = true;

const ORIGIN = 'https://universal-converter.org';

/** Top-level static routes (mirrors the section list in svelte.config.js). */
const STATIC_PATHS = [
	'/',
	'/convert',
	'/units',
	'/fuels',
	'/learn',
	'/methodology',
	'/sources',
	'/about'
];

/** Every prerendered app path, root-relative and trailing-slash-free. */
function allPaths(): string[] {
	return [
		...STATIC_PATHS,
		...allUnits().map((u) => `/units/${u.id}`),
		...allFuels().map((f) => `/fuels/${f.id}`),
		...LEARN_TOPICS.map((t) => `/learn/${t.slug}`)
	];
}

/** Minimal, non-fancy XML escaping — good enough for our kebab/snake ids and paths. */
function escapeXml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toAbsoluteUrl(path: string): string {
	// Root is the one path that legitimately ends in "/"; every other path is
	// trailing-slash-free (kit.trailingSlash = 'never', see +layout.ts).
	return path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`;
}

function buildSitemap(): string {
	const urls = allPaths()
		.map((path) => `\t<url>\n\t\t<loc>${escapeXml(toAbsoluteUrl(path))}</loc>\n\t</url>`)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const GET: RequestHandler = () => {
	return new Response(buildSitemap(), {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' }
	});
};
