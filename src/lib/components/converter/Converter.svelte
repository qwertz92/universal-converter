<script lang="ts">
	/**
	 * The core converter (spec §8.1, rulebook §C), in two modes over one engine:
	 *
	 *  - guided (the default): pick what you are converting and fill in a few
	 *    fields; the answer follows as you type. The form composes a query in
	 *    the text grammar, so nothing about the engine or its guards differs.
	 *  - text: the free-text field with completion, quick examples and the
	 *    options bar, for anyone who would rather type "10 L diesel to kg".
	 *
	 * URL state (`?q=`, `?basis=`) keeps conversions shareable in either mode;
	 * a shared query opens in the guided form when one can express all of it.
	 */
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { browser } from '$app/env';
	import type {
		ConversionResult,
		ConversionResultSet,
		EngineOptions,
		ParseError,
		HeatingBasis,
		Fuel
	} from '#lib/conversion/types.js';
	import { engine, allUnits, allFuels, gridIntensityOptions } from '#lib/ui/engine.js';
	import { debounce, searchFuels } from '#lib/ui/search.js';
	import { buildQueryString, readUrlState, type ConverterUrlState } from '#lib/ui/query-state.js';
	import { exportFilename, resultSetToCsv, resultSetToJson } from '#lib/ui/export.js';
	import {
		clearRecent,
		clearSaved,
		pushRecent,
		readRecent,
		readSaved,
		save as saveQuery,
		unsave as unsaveQuery,
		type SavedEntry
	} from '#lib/ui/history.js';
	import { applyPin, decodePin, encodePin, type Pin } from '#lib/ui/pin.js';
	import HistoryPanel from './HistoryPanel.svelte';
	import CopyButton from '#lib/components/results/CopyButton.svelte';
	import OptionsBar from './OptionsBar.svelte';
	import GridPicker from './GridPicker.svelte';
	import QueryField from './QueryField.svelte';
	import DurationPrompt from './DurationPrompt.svelte';
	import QuickExamples from './QuickExamples.svelte';
	import GuidedForm from './GuidedForm.svelte';
	import { nextRadioIndex } from '#lib/ui/radio-keys.js';
	import { composeQuery, defaultState, stateFromQuery, type GuidedState } from '#lib/ui/guided.js';
	import ResultSet from '#lib/components/results/ResultSet.svelte';
	import ParseErrorNote from '#lib/components/results/ParseErrorNote.svelte';
	import Combobox, { type ComboOption } from '#lib/components/search/Combobox.svelte';

	let { syncUrl = true }: { syncUrl?: boolean } = $props();

	const units = allUnits();
	const fuels = allFuels();

	// ---- state ----------------------------------------------------------------
	// One-time seed from the URL. Only read searchParams in the browser: during
	// prerender the page has no request URL and accessing it throws (SSG).
	const initial: ConverterUrlState = untrack(() =>
		syncUrl && browser ? readUrlState(page.url, gridIntensityOptions()) : { q: '', basis: 'lhv' }
	);
	// ---- mode -----------------------------------------------------------------
	// A first visit opens the guided form with a worked example (10 L diesel),
	// so the page shows what it does before anyone types. A shared ?q= opens in
	// the form that can say all of it — or in the text mode when none can (an
	// efficiency, a duration with a target), rather than dropping part of it.
	const DEFAULT_TASK = 'fuel';
	const initialForm: GuidedState | undefined = untrack(() => {
		if (!initial.q.trim()) return defaultState(DEFAULT_TASK);
		const parsed = engine().parse(initial.q);
		return parsed.ok ? stateFromQuery(parsed.query) : undefined;
	});
	let mode = $state<'guided' | 'text'>(initialForm ? 'guided' : 'text');
	let showOptions = $state(false);
	const uid = $props.id();
	const optionsId = `uc-options-${uid}`;
	let form = $state<GuidedState>(initialForm ?? defaultState(DEFAULT_TASK));
	const composed = $derived(composeQuery(form, units, fuels));

	let queryText = $state(
		initial.q || (composeQuery(defaultState(DEFAULT_TASK), units, fuels) ?? '')
	);
	let basis = $state<HeatingBasis>(initial.basis);
	// Grid region/year for electricity (rulebook §C.6), encoded "region|year"; '' = unset.
	let grid = $state(
		initial.region !== undefined && initial.year !== undefined
			? `${initial.region}|${initial.year}`
			: ''
	);
	const initialPin = untrack(() =>
		syncUrl && browser ? decodePin(page.url.searchParams.get('pin'), units) : {}
	);

	/** Decode the `grid` selection into engine options ({} when unset/invalid). */
	function gridParts(g: string): Pick<EngineOptions, 'region' | 'year'> {
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

	/**
	 * The single result row that owns each context control.
	 *
	 * More than one row can be missing the SAME thing: `5 kW to MJ` asks for a
	 * duration on both the requested-target row and the kWh row, and
	 * `1 kWh electricity to kg CO2e` asks for a region/year twice. Both rows are
	 * correct and both must stay — §C.8 requires an explicitly requested target
	 * to be answered or told precisely why not — but rendering the INPUT twice
	 * gave the reader two controls for one question, each with its own state and
	 * (before the id prop) colliding element ids.
	 *
	 * So: every row keeps its explanation, the first one to ask gets the control.
	 */
	const controlOwner = $derived.by<{ region?: ConversionResult; time?: ConversionResult }>(() => {
		const rows = resultSet?.groups.flatMap((g) => g.results) ?? [];
		return {
			region: rows.find(
				(r) =>
					r.category === 'emissions' &&
					r.exactness === 'context_required' &&
					r.missing?.includes('region')
			),
			time: rows.find((r) => r.exactness === 'context_required' && r.missing?.includes('time'))
		};
	});

	/**
	 * Set or clear the pin.
	 *
	 * Clearing drops the TARGET pin too. A `?pin=>MJ` link sets only `pin.to`,
	 * which the interface never surfaced and this function never wrote — so that
	 * link silently appended "to MJ" to every query for the rest of the session
	 * with no way to stop it. One control, one thing it does: no pin left behind.
	 */
	function setPin(unitId: string | undefined): void {
		pin = unitId ? { ...pin, from: unitId } : {};
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

	// The worked example a first visit opens with is computed during render, on
	// the server and in the browser alike, so the prerendered page already shows
	// its result and hydration finds the same markup — no empty box that fills
	// in a moment later. A shared ?q= cannot be known at prerender time; it is
	// converted by the boot effect below, as before.
	if (!initial.q.trim()) untrack(() => runConversion(queryText));

	// ---- guided mode ----------------------------------------------------------
	/** Re-run after a form edit. Debounced, and it reads the form only when it
	 *  fires, so it never sees a half-applied input event. */
	const applyGuided = debounce(() => {
		// A switch back to text within the debounce must not be overwritten.
		if (mode !== 'guided') return;
		if (!composed) return; // keep the last answer (dimmed) while a field is incomplete
		queryText = composed;
		pickedFuelId = undefined;
		runConversion(queryText);
		pushUrl();
		// A task tab's worked example is not something the reader asked for;
		// only a query they changed goes into "recent".
		if (composed !== composeQuery(defaultState(form.task), units, fuels)) rememberSoon();
	}, 150);
	const rememberSoon = debounce(() => remember(queryText), 1500);

	// A typed query no form can hold ("100 kWh at 85% efficiency", a half-typed
	// one) is kept here when switching to the guided mode, which then opens on
	// its worked example. Until the form is edited, switching back restores the
	// typed query — the switch alone never loses what was written.
	let heldText = $state<string | undefined>();

	/** A form edit by the reader: what was held is no longer what they want. */
	function onFormChange(): void {
		heldText = undefined;
		applyGuided();
	}

	const MODES = [
		{ id: 'guided', label: 'Guided' },
		{ id: 'text', label: 'Type a query' }
	] as const;

	/** Arrow keys switch the mode, as in any radio group; focus stays on it. */
	function onModeKeydown(event: KeyboardEvent, index: number): void {
		const next = nextRadioIndex(event.key, index, MODES.length);
		if (next === undefined) return;
		event.preventDefault();
		setMode(MODES[next].id, false);
		void tick().then(() => document.getElementById(`uc-mode-${MODES[next].id}-${uid}`)?.focus());
	}

	function setMode(next: 'guided' | 'text', focusField = true): void {
		if (next === mode) return;
		if (next === 'text') {
			if (heldText !== undefined) {
				queryText = heldText;
				heldText = undefined;
				runConversion(queryText);
				pushUrl();
			} else if (composed && composed !== queryText) {
				// An edit still inside applyGuided's debounce: that run now returns
				// early (mode is text), so convert here or the result lags the field.
				queryText = composed;
				runConversion(queryText);
				pushUrl();
			}
			mode = 'text';
			if (focusField) void tick().then(() => document.getElementById('uc-query')?.focus());
			return;
		}
		const parsed = engine().parse(effectiveQuery(queryText).text);
		const state = parsed.ok ? stateFromQuery(parsed.query) : undefined;
		heldText = state || !queryText.trim() ? undefined : queryText;
		form = state ?? defaultState(DEFAULT_TASK);
		mode = 'guided';
		applyGuided();
	}

	/** Open a saved or recent query in whichever mode can show it. */
	function openQuery(query: string): void {
		const parsed = engine().parse(query);
		const state = parsed.ok ? stateFromQuery(parsed.query) : undefined;
		if (mode === 'guided' && state) form = state;
		else if (mode === 'guided') mode = 'text';
	}

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
		// The grid only changes electricity results; written into every link it
		// lingered in fuel and unit URLs after the Electricity task was left.
		const parsedNow = engine().parse(effectiveQuery(queryText).text);
		const usesGrid = parsedNow.ok && parsedNow.query.fuel_id === 'electricity';
		const urlState: ConverterUrlState = { q: queryText, basis };
		if (usesGrid) {
			const g = gridParts(grid);
			urlState.region = g.region;
			urlState.year = g.year;
		}
		const params = [
			buildQueryString(urlState).replace(/^\?/, ''),
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
				? resolve(`convert?${params}`)
				: resolve(`?${params}`)
			: onConvert
				? resolve('convert')
				: resolve('/');
		goto(target, {
			replace: true,
			reset: false
		});
	}

	// Recently run conversions (browser-local only). Recorded on an explicit
	// submit, never on every debounced keystroke — otherwise the list would fill
	// up with half-typed fragments.
	let recent = $state<string[]>([]);
	let saved = $state<SavedEntry[]>([]);
	/**
	 * Reaching localStorage is itself guarded, not just using it. With all
	 * cookies blocked, Chrome throws on the property ACCESS — before any
	 * getItem — so `window.localStorage` alone would take the page down for
	 * anyone with strict privacy settings. The history module already tolerates
	 * a store whose methods throw; this covers the step before that.
	 */
	const store = $derived.by<Storage | undefined>(() => {
		if (!browser) return undefined;
		try {
			return window.localStorage;
		} catch {
			return undefined;
		}
	});

	/**
	 * Record the query the ENGINE ran, not the text that was typed.
	 *
	 * Under a pin, "5" is a complete query — but only while that pin is set.
	 * Storing the bare "5" meant the history chip stopped working the moment the
	 * pin changed or came off: clicking it answered "Got the value 5, but no
	 * unit." A history entry has to stand on its own.
	 */
	function remember(text: string): void {
		const effective = effectiveQuery(text);
		const parsed = engine().parse(effective.text);
		if (parsed.ok) recent = pushRecent(store, effective.text);
	}

	function runSaved(query: string): void {
		heldText = undefined; // the reader chose another query
		openQuery(query);
		queryText = query;
		pickedFuelId = undefined;
		runConversion(query);
		pushUrl();
		remember(query);
		revealResults();
	}

	function submit(): void {
		runConversion(queryText);
		pushUrl();
		remember(queryText);
		revealResults();
	}

	/**
	 * Bring the answer on screen after an explicit action (Enter, an example,
	 * a history entry). On a phone the results start below the fold, so tapping
	 * an example changed nothing visible but the text in the field. Never on a
	 * debounced keystroke, and not at all when the results are already in view.
	 */
	let resultsEl = $state<HTMLDivElement | null>(null);
	async function revealResults(): Promise<void> {
		if (!browser) return;
		await tick();
		if (!resultsEl) return;
		const top = resultsEl.getBoundingClientRect().top;
		if (top < window.innerHeight - 160) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		resultsEl.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
	}

	function onInput(): void {
		// Changing the query invalidates a prior fuel pick.
		pickedFuelId = undefined;
		debouncedRun(queryText);
	}

	function useExample(input: string): void {
		heldText = undefined;
		queryText = input;
		pickedFuelId = undefined;
		runConversion(input);
		pushUrl();
		remember(input);
		revealResults();
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
		heldText = undefined;
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
			// The guided form must say what is being answered: "1 kg" plus a
			// picked fuel becomes the fuel form, so the next edit keeps the fuel.
			if (mode === 'guided') {
				const next = engine().parse(queryText);
				const state = next.ok ? stateFromQuery(next.query) : undefined;
				if (state) form = state;
			}
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
			// The home page hides the converter while a shared ?q= link loads
			// (src/routes/+page.svelte), because the prerendered HTML shows the
			// worked example instead. Reveal it once the shared result is drawn.
			if (document.documentElement.dataset.ucShared !== undefined) {
				void tick().then(() => delete document.documentElement.dataset.ucShared);
			}
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
		// Revoking synchronously after click() races the download in Firefox,
		// which can still be reading the blob — the download then fails silently.
		// One frame is enough for every browser to have taken the handle.
		setTimeout(() => URL.revokeObjectURL(url), 0);
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
		`${resolve('api/convert')}${buildQueryString({ q: queryText, basis, ...gridParts(grid) })}`
	);
</script>

<div class="space-y-4">
	<!-- Mode switch on the left, settings on the right. The settings apply to
	     both modes and open only on request, so neither mode carries a bar the
	     other lacks — which kept the two the same height. -->
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div
			role="radiogroup"
			aria-label="How do you want to enter it?"
			class="inline-flex rounded-lg border p-0.5"
			style="border-color:var(--border);background:var(--surface-2)"
		>
			{#each MODES as m, i (m.id)}
				<button
					type="button"
					role="radio"
					id="uc-mode-{m.id}-{uid}"
					aria-checked={mode === m.id}
					tabindex={mode === m.id ? 0 : -1}
					onkeydown={(e) => onModeKeydown(e, i)}
					class="min-h-9 rounded-md px-3 text-sm font-medium transition-colors"
					style={mode === m.id
						? 'background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgb(0 0 0 / 0.08)'
						: 'color:var(--text-muted)'}
					onclick={() => setMode(m.id)}
				>
					{m.label}
				</button>
			{/each}
		</div>
		<button
			type="button"
			class="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:underline"
			style="color:var(--text-muted)"
			aria-expanded={showOptions}
			aria-controls={optionsId}
			onclick={() => (showOptions = !showOptions)}
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M4 7h10M18 7h2M4 17h4M12 17h8"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
				<circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.8" />
				<circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="1.8" />
			</svg>
			Settings
			<span class="font-normal" style="color:var(--text-faint)">
				· {basis === 'lhv' ? 'net heating value' : 'gross heating value'}{gridParts(grid).region
					? ` · grid ${gridParts(grid).region} ${gridParts(grid).year}`
					: ''}
			</span>
		</button>
	</div>
	{#if showOptions}
		<div id={optionsId}><OptionsBar bind:basis bind:grid /></div>
	{/if}

	<!-- The input area is as tall as what it shows. It used to reserve the
	     tallest task's height so a task or mode switch never moved the results,
	     but that left up to ~100px of empty space under the shorter forms on a
	     phone. A switch is the reader's own click, and a shift right after one's
	     own input is expected (web.dev/articles/cls excludes shifts within 500 ms
	     of input); empty space is paid on every visit. flow-root keeps the task
	     strip's negative margin inside this box. -->
	<div class="flow-root">
		{#if mode === 'guided'}
			<GuidedForm
				bind:form
				bind:grid
				{units}
				{fuels}
				onchange={onFormChange}
				{composed}
				held={heldText}
				onedittext={() => setMode('text')}
			/>
		{:else}
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
					pinnedTo={pin.to}
					onpin={setPin}
				/>
				<QuickExamples onpick={useExample} />
			</div>
		{/if}
	</div>

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
		{#if result === controlOwner.region && !(mode === 'guided' && form.task === 'electricity')}
			<!-- Only where a region/year is actually being ASKED for. Rendering it
			     for every region_year_specific row put two identical, inert
			     "Grid region & year" selects (with the same DOM id) under a diesel
			     conversion, where picking one changed nothing but still wrote
			     ?region=&year= into the shared URL. -->
			<div class="mt-2"><GridPicker bind:value={grid} id="uc-grid-inline" /></div>
		{:else if result === controlOwner.time}
			<div class="mt-2"><DurationPrompt {units} onapply={appendClause} id="uc-duration" /></div>
		{/if}
	{/snippet}

	<!--
		A one-line spoken summary. The results themselves are NOT a live region:
		announcing them re-read ~165 words on every debounced keystroke, which
		made the tool unusable with a screen reader. The detail is still fully
		reachable — it is ordinary content below this status line.
	-->
	<p class="sr-only" role="status" aria-live="polite">{resultSummary}</p>

	<!--
		Results / errors.

		The min-height reserves the empty-state panel's own height. That panel is
		gated on `settled`, which is only ever true after hydration — so without a
		reserved box the server sent nothing here and the panel popped in on
		hydration, pushing the history section and the footer down by about 7rem
		on the plain entry path. Reserving the space costs nothing when a result
		is present, because a result is always taller than the box.
	-->
	<!-- Dimmed, not cleared, while a guided field is incomplete: emptying the
	     area on every half-typed amount would collapse and re-grow the page. -->
	<div
		bind:this={resultsEl}
		class="min-h-[7.5rem] scroll-mt-20 transition-opacity"
		style={mode === 'guided' && !composed ? 'opacity:0.45' : undefined}
		aria-busy={mode === 'guided' && !composed}
	>
		{#if parseError}
			<ParseErrorNote error={parseError} onpick={onErrorPick} />
		{:else if resultSet}
			<ResultSet {resultSet} contextControl={gridControl} echo={mode === 'text'} />

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
				<!-- apiHref is resolve('api/convert') + a query string; the typed router
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
		{:else if settled}
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
</div>
