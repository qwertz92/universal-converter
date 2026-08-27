import { defineConfig } from 'oxlint';

/**
 * oxlint is installed here for exactly one job: hosting the vendored `anti-slop`
 * plugin (`tools/oxlint/anti-slop/`, see the README next to it). ESLint keeps its
 * own job — `eslint.config.js` still owns general correctness and style, and this
 * file does not duplicate or replace any of it.
 *
 * Everything below is written out explicitly rather than inherited from oxlint's
 * defaults, because a linter's default rule set is the vendor's opinion at that
 * version and it moves between versions.
 */
export default defineConfig({
	ignorePatterns: [
		// Agent worktrees are a second checkout of this repo; linting them lints
		// the whole codebase twice.
		'.claude/**',
		// Generated: SvelteKit output, wrangler state, build artefacts.
		'.svelte-kit/**',
		'.wrangler/**',
		'build/**',
		'worker-configuration.d.ts',
		// Vendored third-party source. Kept verbatim so re-syncing upstream stays
		// a diff; linting it would push us to edit it.
		'tools/oxlint/anti-slop/**'
	],

	/**
	 * oxlint's own categories are off. They are not "too noisy to bother with" —
	 * they are a separate adoption decision with its own baseline, and taking it
	 * inside this change would mean two half-configured general-purpose linters.
	 * Measured on this repo at oxlint 1.80.0: correctness 1, perf 2, suspicious
	 * 42, pedantic 352, restriction 887, style 4403. The style and restriction
	 * bulk is overlap with Prettier and with the ESLint config that is already
	 * green. The one correctness finding is named in tools/oxlint/README.md.
	 */
	categories: {
		correctness: 'off',
		perf: 'off',
		suspicious: 'off',
		pedantic: 'off',
		restriction: 'off',
		style: 'off',
		nursery: 'off'
	},

	jsPlugins: [{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' }],

	rules: {
		'anti-slop/no-chained-type-assertions': 'error',
		'anti-slop/no-conditional-empty-object-spread': 'error',
		'anti-slop/no-known-value-widening': 'error',
		'anti-slop/no-module-mocking': 'error',
		'anti-slop/no-object-parameters': 'error',
		'anti-slop/no-reflect-apply': 'error',
		'anti-slop/no-reflect-get': 'error',

		/**
		 * OFF — deliberately, not to make the gate green.
		 *
		 * The rule wants a parsed domain value instead of a `typeof` check, and its
		 * prescribed remedy is a schema layer at every I/O boundary. Of the 13 sites
		 * it flagged here:
		 *
		 * - 7 ask whether a browser global exists at all (`typeof window`,
		 *   `document`, `navigator`, `localStorage` === 'undefined') in
		 *   src/lib/ui/{theme.svelte.ts,clipboard.ts}. This is a SvelteKit app that
		 *   renders on a Worker; those guards are what "am I in a browser" is
		 *   spelled as. No schema can parse the absence of a global — and
		 *   theme.svelte.ts documents that even `typeof localStorage` is not enough,
		 *   because with cookies blocked the property access itself throws.
		 * - 1 is inside a Zod `.transform()` in src/lib/data/schemas.ts, telling the
		 *   two members of `z.union([z.number(), z.string()])` apart. That is the
		 *   parse boundary the rule asks for, flagged for implementing itself.
		 * - 5 are real: src/lib/ui/history.ts hand-rolls a reader for JSON out of
		 *   localStorage. That one deserves a schema, and this repo already has Zod
		 *   for its data files — but adding a parse boundary for UI storage is an
		 *   architecture decision with its own tests and error handling, not a
		 *   side-effect of turning a linter on. Tracked, not silenced.
		 *
		 * Revisit when history.ts gets its schema; the rule also has an
		 * `allowInTypeGuards` option that would clear one of those five on its own.
		 */
		'anti-slop/no-runtime-typeof': 'off',

		'anti-slop/no-shape-in-symbol-names': 'error',
		'anti-slop/no-unknown-parameters': 'error',
		'anti-slop/no-unknown-returns': 'error',
		'anti-slop/no-unknown-type-aliases': 'error',
		'anti-slop/no-unsafe-dictionary-type': 'error',
		'anti-slop/no-widen-then-assert': 'error',
		'anti-slop/require-safety-comment-for-type-assertion': 'error'
	}
});
