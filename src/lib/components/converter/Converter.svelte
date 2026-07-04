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
	import type { ConversionResultSet, ParseError, HeatingBasis, Fuel } from '$lib/conversion/types';
	import { engine, allUnits, allFuels } from '$lib/ui/engine';
	import { debounce, searchFuels } from '$lib/ui/search';
	import { buildQueryString, readUrlState } from '$lib/ui/query-state';
	import OptionsBar from './OptionsBar.svelte';
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
	let showStructured = $state(false);

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
		const out = conv.convertText(effective, { basis });
		if ('error' in out) {
			parseError = out.error;
			resultSet = null;
		} else {
			resultSet = out;
			parseError = null;
		}
	}

	const debouncedRun = debounce((t: string) => runConversion(t), 260);

	function pushUrl(): void {
		if (!syncUrl || !browser) return;
		// `params` is the query string WITHOUT a leading '?', or '' when empty.
		const params = buildQueryString({ q: queryText, basis }).replace(/^\?/, '');
		// resolve() keeps the URL base-path safe and, as the direct goto() argument,
		// satisfies svelte/no-navigation-without-resolve (it returns a ResolvedPathname).
		// A literal route prefix ('/' or '/convert') lets the typed router validate the
		// ?q=/?basis= search suffix; the converter only mounts on those two routes.
		const onConvert = page.route.id === '/convert';
		goto(onConvert ? resolve(`/convert?${params}`) : resolve(`/?${params}`), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function submit(): void {
		runConversion(queryText);
		pushUrl();
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
		if (id) runConversion(queryText);
	}

	// ---- effects --------------------------------------------------------------
	// Recompute when basis changes (keep results live). Reading `basis` into a
	// const registers the reactive dependency without a bare-expression statement.
	$effect(() => {
		const _basis = basis; // track basis changes
		void _basis;
		untrack(() => {
			if (queryText.trim()) {
				runConversion(queryText);
				pushUrl();
			}
		});
	});

	// Run once on mount if the URL seeded a query (shareable links).
	$effect(() => {
		if (browser && untrack(() => initial.q)) {
			runConversion(untrack(() => initial.q));
		}
	});

	// Does the current result set contain a "pick a fuel" context prompt?
	const needsFuel = $derived.by(() => {
		if (!resultSet) return false;
		return resultSet.groups.some((g) =>
			g.results.some((r) => r.exactness === 'context_required' && r.missing?.includes('fuel'))
		);
	});
</script>

<div class="space-y-4">
	<!-- Free-text input -->
	<form
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<div class="relative">
			<label for="uc-query" class="sr-only">Enter a value and unit to convert</label>
			<input
				id="uc-query"
				type="text"
				bind:value={queryText}
				oninput={onInput}
				placeholder="e.g. 1 liter diesel, 1000 kcal, 1 m³ natural gas"
				autocomplete="off"
				spellcheck="false"
				class="uc-num w-full rounded-xl border py-4 pr-28 pl-4 text-base outline-none sm:text-lg"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			/>
			<button
				type="submit"
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold"
				style="background:var(--accent);color:var(--accent-contrast)"
			>
				Convert
			</button>
		</div>
	</form>

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

		<OptionsBar bind:basis />
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

	<!-- Results / errors -->
	<div aria-live="polite" aria-atomic="false">
		{#if parseError}
			<ParseErrorNote error={parseError} onpick={onErrorPick} />
		{:else if resultSet}
			<ResultSet {resultSet} />
		{:else if !compact}
			<div
				class="rounded-[var(--radius-card)] border border-dashed p-8 text-center"
				style="border-color:var(--border)"
			>
				<p class="text-sm" style="color:var(--text-faint)">
					Enter a value and a unit above — try one of the examples to see grouped, sourced results.
				</p>
			</div>
		{/if}
	</div>
</div>
