/**
 * Route param matchers (SvelteKit `src/params.ts`).
 *
 * SvelteKit loads this file with Node's own `import()` during the build, not
 * through Vite, so it cannot import `#lib/...js` modules (they are TypeScript
 * behind that alias). The words are therefore listed here, and
 * tests/fuel-split-pages.test.ts keeps them equal to the parser's list.
 */
import { defineParams } from '@sveltejs/kit/params';

/**
 * Words that name several fuels, as URL slugs: /fuels/heating-oil gets a page
 * offering the grades instead of a 404. Same as `SPLIT_MATERIALS` in
 * src/lib/conversion/parser.ts.
 */
export const SPLIT_FUEL_SLUGS: ReadonlySet<string> = new Set([
	'heizöl',
	'heizoel',
	'heating-oil',
	'light-fuel-oil',
	'paraffin',
	'coal'
]);

export const params = defineParams({
	splitfuel: (param) =>
		SPLIT_FUEL_SLUGS.has(
			param
				.trim()
				.toLowerCase()
				.replace(/[-_\s]+/g, '-')
		)
			? param
			: undefined
});
