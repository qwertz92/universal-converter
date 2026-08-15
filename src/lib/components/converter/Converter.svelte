<script lang="ts">
	/**
	 * The core converter (spec §8.1, rulebook §C). Free-text input parsed on submit
	 * AND debounced as-you-type, a structured fallback row, quick examples, the
	 * global options bar, grouped result cards, and helpful error/context states.
	 * URL state (`?q=`, `?basis=`) keeps conversions shareable.
	 *
	 * `compact` renders the embedded variant used on the home page (no structured
	 * row / options by default, but still fully functional).
	 */
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import type {
		ConversionResult,
		ConversionResultSet,
		ParseError,
		HeatingBasis,
		Fuel
	} from '$lib/conversion/types';
	import { engine, allUnits, allFuels } from '$lib/ui/engine';
	import { debounce, searchFuels } from '$lib/ui/search';
	import { buildQueryString, readUrlState } from '$lib/ui/query-state';
	import { exportFilename, resultSetToCsv, resultSetToJson } from '$lib/ui/export';
	import { clearRecent, pushRecent, readRecent } from '$lib/ui/recent';
	import CopyButton from '$lib/components/results/CopyButton.svelte';
	import OptionsBar from './OptionsBar.svelte';
	import GridPicker from './GridPicker.svelte';
	import QueryField from './QueryField.svelte';
	import DurationPrompt from './DurationPrompt.svelte';
	import QuickExamples from './QuickExamples.svelte';
	import StructuredInput from './StructuredInput.svelte';
	import ResultSet from '$lib/components/results/ResultSet.svelte';
	import ParseErrorNote from '$lib/components/results/ParseErrorNote.svelte';
	import Combobox, { type ComboOption } from '$lib/components/search/Combobox.svelte';

	let { compact = false, syncUrl = true }: { compact?: boolean; syncUrl?: boolean } = $props();

	const units = allUnits();
	const fuels = allFuels();

	// ---- state ----------------------------------------------------------------
	// One-time seed from the URL. Only read searchParams in the browser: during
	// prerender the page has no request URL and accessing it throws (SSG).
	const initial = untrack(() =>
		syncUrl && browser ? readUrlState(page.url) : { q: '', basis: 'lhv' as HeatingBasis }
	);
	let queryText = $state(initial.q);
	let basis = $state<HeatingBasis>(initial.basis);
	// Grid region/year for electricity (rulebook §C.6), encoded "region|year"; '' = unset.
	let grid = $state(
		initial.region !== undefined && initial.year !== undefined
			? `${initial.region}|${initial.year}`
			: ''
	);
	let showStructured = $state(false);

	/** Decode the `grid` selection into engine options ({} when unset/invalid). */
	function gridParts(g: string): { region?: string; year?: number } {
		if (!g) return {};
		const sep = g.lastIndexOf('|');
		if (sep <= 0) return {};
		const region = g.slice(0, sep);
		const year = Number.parseInt(g.slice(sep + 1), 10);
		if (!region || !Number.isInteger(year)) return {};
		return { region, year };
	}

	let resultSet = $state<ConversionResultSet | null>(null);
	let parseError = $state<ParseError | null>(null);

	// For a context_required "pick a fuel" prompt: remember what the user picked.
	let pickedFuelId = $state<string | undefined>(undefined);
	let fuelPickQuery = $state('');

	// ---- conversion -----------------------------------------------------------
	function runConversion(text: string): void {
		const trimmed = text.trim();
		if (trimmed === '') {
			resultSet = null;
			parseError = null;
			return;
		}
		const conv = engine();
		// If the user picked a fuel to satisfy a context prompt, append it — but only
		// when the base query doesn't already carry a fuel (avoid double material).
		let effective = trimmed;
		if (pickedFuelId) {
			const parsed = conv.parse(trimmed);
			if (parsed.ok && !parsed.query.fuel_id) {
				const f = fuels.find((x) => x.id === pickedFuelId);
				if (f) effective = `${trimmed} ${f.names[0]}`;
			}
		}
		const out = conv.convertText(effective, { basis, ...gridParts(grid) });
		if ('error' in out) {
			parseError = out.error;
			resultSet = null;
		} else {
			resultSet = out;
			parseError = null;
		}
	}

	const debouncedRun = debounce((t: string) => runConversion(t), 260);

	/** The engine's own parser, for the input field's live interpretation. */
	function parseQuery(text: string) {
		return engine().parse(text);
	}

	/**
	 * Append a clause the user chose from a context prompt (a duration, so far)
	 * to the query text. Writing it into the query — rather than into hidden
	 * component state — keeps it visible, editable and shareable.
	 */
	function appendClause(clause: string): void {
		queryText = `${queryText.trim()} ${clause}`.trim();
		runConversion(queryText);
		pushUrl();
	}

	function pushUrl(): void {
		if (!syncUrl || !browser) return;
		// `params` is the query string WITHOUT a leading '?', or '' when empty.
		const params = buildQueryString({ q: queryText, basis, ...gridParts(grid) }).replace(/^\?/, '');
		// resolve() keeps the URL base-path safe and, as the direct goto() argument,
		// satisfies svelte/no-navigation-without-resolve (it returns a ResolvedPathname).
		// A literal route prefix ('/' or '/convert') lets the typed router validate the
		// ?q=/?basis= search suffix. Derive "am I on /convert" from the actual
		// pathname (not route.id) so a future third mount point degrades to the
		// nearest sensible base instead of silently syncing to '/'.
		// When there are no params, skip the '?' branch entirely so an empty
		// submit doesn't leave a bare trailing '?' in the URL.
		const onConvert = page.url.pathname.endsWith('/convert');
		const target = params
			? onConvert
				? resolve(`/convert?${params}`)
				: resolve(`/?${params}`)
			: onConvert
				? resolve('/convert')
				: resolve('/');
		goto(target, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	// Recently run conversions (browser-local only). Recorded on an explicit
	// submit, never on every debounced keystroke — otherwise the list would fill
	// up with half-typed fragments.
	let recent = $state<string[]>([]);
	const store = $derived(browser ? window.localStorage : undefined);

	function remember(text: string): void {
		const parsed = engine().parse(text);
		if (parsed.ok) recent = pushRecent(store, text);
	}

	function submit(): void {
		runConversion(queryText);
		pushUrl();
		remember(queryText);
	}

	function onInput(): void {
		// Changing the query invalidates a prior fuel pick.
		pickedFuelId = undefined;
		debouncedRun(queryText);
	}

	function useExample(input: string): void {
		queryText = input;
		pickedFuelId = undefined;
		runConversion(input);
		pushUrl();
		remember(input);
	}

	function onErrorPick(text: string): void {
		// For ambiguity/unknown suggestions: append or replace the failing token.
		queryText = queryText.replace(/\S+\s*$/, '') + text;
		submit();
	}

	// Fuel picker options for the context_required prompt.
	const fuelPickOptions = $derived.by<ComboOption[]>(() =>
		searchFuels(fuels, fuelPickQuery, 200).map((f: Fuel) => ({
			id: f.id,
			label: f.names[0],
			group: f.category
		}))
	);

	function onPickFuel(id: string | undefined): void {
		pickedFuelId = id;
		if (!id) return;
		// Materialise the pick into the query text so the URL (and any shared
		// link) carries the fuel — a pick that only lives in component state
		// would silently vanish from the shareable state.
		const f = fuels.find((x) => x.id === id);
		const conv = engine();
		const parsed = conv.parse(queryText.trim());
		if (f && parsed.ok && !parsed.query.fuel_id) {
			queryText = `${queryText.trim()} ${f.names[0]}`;
			pickedFuelId = undefined; // the text now carries the fuel
		}
		runConversion(queryText);
		pushUrl();
	}

	// ---- effects --------------------------------------------------------------
	// One effect covers both the mount-time seed (URL-shared query) and later
	// basis / grid changes. The first run converts WITHOUT pushUrl — issuing an
	// unsolicited replaceState navigation on a deep-linked page load (and
	// double-running the conversion via a second mount effect) was audit finding
	// UI#2. Reading basis/grid into consts registers the reactive dependencies.
	let booted = false;
	$effect(() => {
		const _basis = basis; // track basis changes
		const _grid = grid; // track grid region/year changes
		void _basis;
		void _grid;
		if (!browser) return;
		untrack(() => {
			if (!booted) recent = readRecent(store);
			if (queryText.trim()) {
				runConversion(queryText);
				if (booted) pushUrl();
			}
			booted = true;
		});
	});

	// Does the current result set contain a "pick a fuel" context prompt?
	const needsFuel = $derived.by(() => {
		if (!resultSet) return false;
		return resultSet.groups.some((g) =>
			g.results.some((r) => r.exactness === 'context_required' && r.missing?.includes('fuel'))
		);
	});

	// ---- export (roadmap 0.2 import/export slice) -----------------------------
	function downloadFile(content: string, filename: string, mime: string): void {
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadJson(): void {
		if (!resultSet) return;
		downloadFile(resultSetToJson(resultSet), exportFilename(resultSet, 'json'), 'application/json');
	}

	function downloadCsv(): void {
		if (!resultSet) return;
		downloadFile(resultSetToCsv(resultSet), exportFilename(resultSet, 'csv'), 'text/csv');
	}

	/** Link to the same conversion on the public JSON API (draft). The base goes
	 *  through resolve(); the search suffix is appended manually because the
	 *  typed router models search-string suffixes for pages but not endpoints. */
	const apiHref = $derived(
		`${resolve('/api/convert')}${buildQueryString({ q: queryText, basis, ...gridParts(grid) })}`
	);
</script>

<div class="space-y-4">
	<!-- Free-text input: completes units, and says what it understood. -->
	<QueryField
		bind:value={queryText}
		{units}
		{fuels}
		parse={parseQuery}
		onsubmit={submit}
		oninput={onInput}
	/>

	<QuickExamples onpick={useExample} />

	{#if !compact}
		<!-- Structured fallback + options -->
		<div class="space-y-3">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 text-sm font-medium hover:text-[var(--accent)]"
				style="color:var(--text-muted)"
				onclick={() => (showStructured = !showStructured)}
				aria-expanded={showStructured}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					class="transition-transform"
					style={showStructured ? 'transform:rotate(90deg)' : ''}
				>
					<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
				Build it with dropdowns
			</button>
			{#if showStructured}
				<div
					class="rounded-xl border p-4"
					style="border-color:var(--border);background:var(--surface-2)"
				>
					<StructuredInput {units} {fuels} onsubmit={useExample} />
				</div>
			{/if}
		</div>

		<OptionsBar bind:basis bind:grid />
	{/if}

	<!-- Fuel context prompt (rulebook §C.8: "pick a material") -->
	{#if needsFuel}
		<div
			class="rounded-[var(--radius-card)] border p-4"
			style="border-color:var(--border);background:var(--surface)"
		>
			<p class="mb-2 text-sm font-medium" style="color:var(--text)">
				This conversion needs a material — pick a fuel to get mass, energy and emissions:
			</p>
			{#if fuels.length === 0}
				<p class="text-sm" style="color:var(--text-faint)">
					The fuel catalog is not loaded in this build, so material-based results are not available
					yet.
				</p>
			{:else}
				<div class="max-w-sm">
					<Combobox
						id="ctx-fuel"
						label="Fuel / material"
						placeholder="Search fuels…"
						options={fuelPickOptions}
						bind:value={pickedFuelId}
						bind:query={fuelPickQuery}
						onselect={onPickFuel}
					/>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Controls rendered inside the rows that ask for context, so the answer to
	     "what's missing?" sits exactly where the question is asked. Present in
	     compact mode too, where the OptionsBar picker is not shown. -->
	{#snippet gridControl(result: ConversionResult)}
		{#if result.category === 'emissions' && ((result.exactness === 'context_required' && result.missing?.includes('region')) || result.exactness === 'region_year_specific')}
			<GridPicker bind:value={grid} id="uc-grid-inline" />
		{:else if result.exactness === 'context_required' && result.missing?.includes('time')}
			<DurationPrompt {units} onapply={appendClause} />
		{/if}
	{/snippet}

	<!-- Results / errors -->
	<div aria-live="polite" aria-atomic="false">
		{#if parseError}
			<ParseErrorNote error={parseError} onpick={onErrorPick} />
		{:else if resultSet}
			<ResultSet {resultSet} contextControl={gridControl} />

			<!-- Export toolbar: take the whole grouped, sourced result set with you. -->
			<div class="mt-3 flex flex-wrap items-center gap-2 text-xs" style="color:var(--text-faint)">
				<span class="font-semibold tracking-wide uppercase">Export</span>
				<CopyButton text={resultSetToJson(resultSet)} label="Copy JSON" compact />
				<button
					type="button"
					class="rounded-md border px-2 py-1 font-medium hover:bg-[var(--surface-2)]"
					style="border-color:var(--border);color:var(--text-muted)"
					onclick={downloadJson}
				>
					Download JSON
				</button>
				<button
					type="button"
					class="rounded-md border px-2 py-1 font-medium hover:bg-[var(--surface-2)]"
					style="border-color:var(--border);color:var(--text-muted)"
					onclick={downloadCsv}
				>
					Download CSV
				</button>
				<!-- apiHref is resolve('/api/convert') + a query string; the typed router
				     models search suffixes for pages but not for endpoints, so the rule
				     is disabled for this one element rather than for the file. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={apiHref}
					target="_blank"
					rel="noopener"
					class="rounded-md border px-2 py-1 font-medium hover:bg-[var(--surface-2)]"
					style="border-color:var(--border);color:var(--text-muted)"
					title="The same conversion on the public JSON API (draft)"
				>
					API ↗
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{:else if !compact}
			<div
				class="rounded-[var(--radius-card)] border border-dashed p-8 text-center"
				style="border-color:var(--border)"
			>
				<p class="text-sm" style="color:var(--text-faint)">
					Enter a value and a unit above — try one of the examples to see grouped, sourced results.
				</p>
				{#if recent.length > 0}
					<!-- Browser-local history: nothing leaves the device. -->
					<div class="mt-4 flex flex-wrap items-center justify-center gap-1.5">
						<span class="text-xs font-medium" style="color:var(--text-muted)">Recent:</span>
						{#each recent as q (q)}
							<button
								type="button"
								class="uc-num rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
								style="border-color:var(--border);color:var(--text)"
								onclick={() => useExample(q)}
							>
								{q}
							</button>
						{/each}
						<button
							type="button"
							class="rounded-full px-2 py-1 text-xs font-medium hover:underline"
							style="color:var(--text-faint)"
							onclick={() => (recent = clearRecent(store))}
						>
							Clear
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
