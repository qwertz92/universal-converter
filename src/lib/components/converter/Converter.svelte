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
	import { engine, allUnits, allFuels, gridIntensityOptions } from '$lib/ui/engine';
	import { debounce, searchFuels } from '$lib/ui/search';
	import { buildQueryString, readUrlState } from '$lib/ui/query-state';
	import { exportFilename, resultSetToCsv, resultSetToJson } from '$lib/ui/export';
	import {
		clearRecent,
		clearSaved,
		pushRecent,
		readRecent,
		readSaved,
		save as saveQuery,
		unsave as unsaveQuery,
		type SavedEntry
	} from '$lib/ui/history';
	import { applyPin, decodePin, encodePin, type Pin } from '$lib/ui/pin';
	import HistoryPanel from './HistoryPanel.svelte';
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
		syncUrl && browser
			? readUrlState(page.url, gridIntensityOptions())
			: { q: '', basis: 'lhv' as HeatingBasis }
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
	const initialPin = untrack(() =>
		syncUrl && browser ? decodePin(page.url.searchParams.get('pin'), units) : {}
	);

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

	// Pinned units: "iterate mode". A pin lets a bare number be a whole query,
	// which is the difference between one lookup and twenty. It is the user
	// supplying the unit once — visibly, reversibly and carried in the URL —
	// not the tool assuming one.
	let pin = $state<Pin>(initialPin);

	/** The query the engine actually runs, with any pinned unit filled in. */
	function effectiveQuery(text: string) {
		return applyPin(text, pin, (t) => engine().parse(t), units);
	}

	const pinned = $derived(effectiveQuery(queryText));

	function setPin(unitId: string | undefined): void {
		pin = unitId ? { ...pin, from: unitId } : { ...pin, from: undefined };
		if (queryText.trim()) {
			runConversion(queryText);
			pushUrl();
		}
	}

	// ---- conversion -----------------------------------------------------------
	function runConversion(text: string): void {
		// Any conversion supersedes a keystroke still waiting in the debounce —
		// otherwise the queued older text would overwrite this result.
		debouncedRun.cancel();
		const trimmed = text.trim();
		if (trimmed === '') {
			resultSet = null;
			parseError = null;
			return;
		}
		const conv = engine();
		// Fill in a pinned unit/target first, so "5" becomes the query it stands
		// for before anything else looks at it.
		let effective = effectiveQuery(trimmed).text;
		// If the user picked a fuel to satisfy a context prompt, append it — but only
		// when the base query doesn't already carry a fuel (avoid double material).
		if (pickedFuelId) {
			const parsed = conv.parse(effective);
			if (parsed.ok && !parsed.query.fuel_id) {
				const f = fuels.find((x) => x.id === pickedFuelId);
				if (f) effective = `${effective} ${f.names[0]}`;
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
		// The pin rides along so a shared link reproduces exactly what the sender
		// saw — "?q=5" alone would be meaningless without it.
		const pinParam = encodePin(pin, units);
		const params = [
			buildQueryString({ q: queryText, basis, ...gridParts(grid) }).replace(/^\?/, ''),
			pinParam ? `pin=${encodeURIComponent(pinParam)}` : ''
		]
			.filter(Boolean)
			.join('&');
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
	let saved = $state<SavedEntry[]>([]);
	const store = $derived(browser ? window.localStorage : undefined);

	function remember(text: string): void {
		const parsed = engine().parse(effectiveQuery(text).text);
		if (parsed.ok) recent = pushRecent(store, text);
	}

	function runSaved(query: string): void {
		queryText = query;
		pickedFuelId = undefined;
		runConversion(query);
		pushUrl();
		remember(query);
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

	/**
	 * Apply a repair chosen from a parse error.
	 *
	 * `replaces` is the token the choice is for. Swapping the LAST word instead
	 * deleted whatever followed it: "10 gallons diesel" + "US gallon" became
	 * "10 gallons US gallon" — the material gone, the ambiguity intact, the same
	 * prompt back again with no way out. With no token (the example chips) the
	 * whole query is replaced, which is what those chips mean.
	 */
	function onErrorPick(text: string, replaces?: string): void {
		if (!replaces) {
			queryText = text;
		} else {
			const escaped = replaces.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const pattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i');
			queryText = pattern.test(queryText)
				? queryText.replace(pattern, `$1${text}`)
				: `${queryText.replace(/\S+\s*$/, '')}${text}`;
		}
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
	// Reactive twin of `booted`: a shared "?q=" link is prerendered WITHOUT the
	// query, so the served HTML would show the empty-state panel and then swap
	// it for a full result set on hydration — a large shift on the primary entry
	// path for every shared link. The panel waits until the first conversion has
	// had its chance.
	let settled = $state(false);
	let booted = false;
	$effect(() => {
		const _basis = basis; // track basis changes
		const _grid = grid; // track grid region/year changes
		const _pin = `${pin.from ?? ''}>${pin.to ?? ''}`; // track pin changes
		void _basis;
		void _grid;
		void _pin;
		if (!browser) return;
		untrack(() => {
			if (!booted) {
				recent = readRecent(store);
				saved = readSaved(store);
			}
			if (queryText.trim()) {
				runConversion(queryText);
				if (booted) pushUrl();
			}
			booted = true;
			settled = true;
		});
	});

	/** One short sentence for the screen-reader status line. */
	const resultSummary = $derived.by(() => {
		if (parseError) return parseError.message;
		if (!resultSet) return '';
		const rows = resultSet.groups.flatMap((g) => g.results);
		const answered = rows.filter((r) => r.value !== null).length;
		const answer = rows.find((r) => r.is_target && r.value !== null);
		const head = answer
			? `${resultSet.input.value} ${resultSet.input.unit_label} = ${answer.value} ${answer.unit_label}. `
			: '';
		const warned = resultSet.warnings.length;
		return `${head}${answered} values in ${resultSet.groups.length} groups${warned ? `, ${warned} warnings` : ''}.`;
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
		effective={pinned.text}
		pinApplied={pinned.usedFrom || pinned.usedTo}
		pinnedFrom={pin.from}
		onpin={setPin}
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
		{#if result.category === 'emissions' && result.exactness === 'context_required' && result.missing?.includes('region')}
			<!-- Only where a region/year is actually being ASKED for. Rendering it
			     for every region_year_specific row put two identical, inert
			     "Grid region & year" selects (with the same DOM id) under a diesel
			     conversion, where picking one changed nothing but still wrote
			     ?region=&year= into the shared URL. -->
			<div class="mt-2"><GridPicker bind:value={grid} id="uc-grid-inline" /></div>
		{:else if result.exactness === 'context_required' && result.missing?.includes('time')}
			<div class="mt-2"><DurationPrompt {units} onapply={appendClause} /></div>
		{/if}
	{/snippet}

	<!--
		A one-line spoken summary. The results themselves are NOT a live region:
		announcing them re-read ~165 words on every debounced keystroke, which
		made the tool unusable with a screen reader. The detail is still fully
		reachable — it is ordinary content below this status line.
	-->
	<p class="sr-only" role="status" aria-live="polite">{resultSummary}</p>

	<!-- Results / errors -->
	<div>
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
		{:else if !compact && settled}
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

	<!-- History lives below the results, not inside the empty state: the moment
	     you have a result is exactly when you want to jump back to the last one. -->
	{#if !compact}
		<HistoryPanel
			{recent}
			{saved}
			current={queryText}
			onrun={runSaved}
			onsave={(q) => (saved = saveQuery(store, q))}
			onunsave={(q) => (saved = unsaveQuery(store, q))}
			onclearRecent={() => (recent = clearRecent(store))}
			onclearSaved={() => (saved = clearSaved(store))}
		/>
	{/if}
</div>
