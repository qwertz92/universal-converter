<script lang="ts">
	/**
	 * Quick-start example chips (spec §8.1). Loaded from data/examples.json via the
	 * engine loader; degrades gracefully to a small built-in set when the data file
	 * is empty (a spec requirement — the UI must handle sparse data).
	 *
	 * Only the `featured` examples show by default. All 28 at once wrapped to four
	 * lines on a desktop and nine on a phone, which pushed every result below the
	 * fold; the rest stay one click away behind "More examples".
	 */
	import { loadExamples } from '$lib';

	let { onpick }: { onpick: (input: string) => void } = $props();

	/** Used when the data file marks nothing as featured. */
	const DEFAULT_VISIBLE = 8;

	// Built-in fallback covers the spec §8.2 "must work" inputs.
	const FALLBACK = [
		'1 kWh',
		'1000 kcal',
		'1 MMBTU',
		'1 therm',
		'1 barrel',
		'1 toe',
		'1 L diesel',
		'1 m³ natural gas',
		'1 kg hydrogen'
	];

	const examples = $derived.by(() => {
		try {
			const loaded = loadExamples();
			if (loaded.length > 0)
				return loaded.map((e) => ({
					input: e.input,
					label: e.label ?? e.input,
					featured: e.featured === true
				}));
		} catch {
			/* fall through to built-ins */
		}
		return FALLBACK.map((s) => ({ input: s, label: s, featured: false }));
	});

	const anyFeatured = $derived(examples.some((e) => e.featured));
	const primary = $derived(
		anyFeatured ? examples.filter((e) => e.featured) : examples.slice(0, DEFAULT_VISIBLE)
	);
	const rest = $derived(
		anyFeatured ? examples.filter((e) => !e.featured) : examples.slice(DEFAULT_VISIBLE)
	);

	let showAll = $state(false);
	const uid = $props.id();
	const moreId = `uc-more-examples-${uid}`;

	const chipClass =
		'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]';
</script>

<!-- One root element: the parent spaces its children with space-y, which a
     second sibling root would have doubled. -->
<div>
	<!-- On a phone the featured chips scroll sideways in one line instead of
	     wrapping to six, which kept every result below the fold. -->
	<div
		class="-mx-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
		style="scrollbar-width:none"
	>
		<span class="shrink-0 text-xs font-medium" style="color:var(--text-faint)">Try:</span>
		{#each primary as ex (ex.input)}
			<button
				type="button"
				class={chipClass}
				style="border-color:var(--border);color:var(--text-muted)"
				onclick={() => onpick(ex.input)}
			>
				{ex.label}
			</button>
		{/each}
		{#if rest.length > 0}
			<!-- Last item on its line, so its label change cannot move another chip. -->
			<button
				type="button"
				class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-medium whitespace-nowrap hover:underline"
				style="color:var(--accent)"
				aria-expanded={showAll}
				aria-controls={moreId}
				onclick={() => (showAll = !showAll)}
			>
				{showAll ? 'Fewer examples' : `More examples (${rest.length})`}
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					class="transition-transform"
					style={showAll ? 'transform:rotate(180deg)' : ''}
				>
					<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</button>
		{/if}
	</div>
	{#if rest.length > 0}
		<div id={moreId} class="mt-2 flex flex-wrap items-center gap-2" hidden={!showAll}>
			{#each rest as ex (ex.input)}
				<button
					type="button"
					class={chipClass}
					style="border-color:var(--border);color:var(--text-muted)"
					onclick={() => onpick(ex.input)}
				>
					{ex.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
