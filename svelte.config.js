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
		adapter: adapter()
	},

	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in Svelte 6.
		runes: true
	}
};

export default config;
