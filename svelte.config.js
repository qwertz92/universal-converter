import adapter from '@sveltejs/adapter-cloudflare';
import { mdsvex } from 'mdsvex';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex({ extensions: ['.svx', '.md'] })],

	extensions: ['.svelte', '.svx', '.md'],

	kit: {
		// adapter-cloudflare targets Cloudflare Pages/Workers.
		// See https://svelte.dev/docs/kit/adapter-cloudflare for options.
		//
		// The whole app is prerendered (SSG) — see src/routes/+layout.ts. Route
		// everything to the static assets and let the Pages function handle only
		// the SPA fallback (404s), which keeps us under Cloudflare's _routes.json
		// exclude-rule limit instead of listing every prerendered path.
		adapter: adapter({
			routes: {
				include: ['/*'],
				// Exclude build assets and every static section via directory
				// wildcards rather than one rule per prerendered page — this keeps
				// us well under Cloudflare's 100-rule _routes.json limit (we ship
				// 100+ prerendered pages: 73 units, 21 fuels, 14 learn topics).
				exclude: [
					'<build>',
					'<files>',
					'/units/*',
					'/fuels/*',
					'/learn/*',
					'/',
					'/convert',
					'/units',
					'/fuels',
					'/learn',
					'/methodology',
					'/sources',
					'/about'
				]
			}
		})
	},

	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in Svelte 6.
		runes: true
	}
};

export default config;
