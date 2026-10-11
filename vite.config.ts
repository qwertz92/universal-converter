import adapter from '@sveltejs/adapter-cloudflare';
import { mdsvex } from 'mdsvex';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			preprocess: [vitePreprocess(), mdsvex({ extensions: ['.svx', '.md'] })],
			extensions: ['.svelte', '.svx', '.md'],
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in Svelte 6.
				runes: true
			},

			// adapter-cloudflare targets Cloudflare Pages/Workers.
			// See https://svelte.dev/docs/kit/adapter-cloudflare for options.
			//
			// The whole app is prerendered (SSG) — see src/routes/+layout.ts. Route
			// everything to the static assets and let the Pages function handle only
			// the SPA fallback (404s), which keeps us under Cloudflare's _routes.json
			// exclude-rule limit instead of listing every prerendered path.
			adapter: adapter({
				// `/units/*`, `/fuels/*` and `/learn/*` are excluded from the Pages Function
				// below, so a URL there that matches no prerendered file is answered by the
				// static `404.html` (HTTP 404) and never reaches the server. The default
				// `plaintext` 404.html is just "Not Found"; `spa` makes it the app shell,
				// which boots in the browser, routes the URL client-side and shows
				// +error.svelte (or follows the runtime redirect in units/[unit]/+page.ts).
				fallback: 'spa',

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
						'/about',
						// Both are prerendered files; without these they invoked the
						// Pages Function on every request instead of being served
						// straight off the asset layer.
						'/sitemap.xml',
						'/404.html'
					]
				}
			})
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
