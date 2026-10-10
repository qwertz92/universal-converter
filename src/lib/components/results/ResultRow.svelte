<script lang="ts">
	/**
	 * One conversion result row. Surfaces the value + unit + exactness badge, a
	 * copy-value button, and an expandable detail panel (formula, assumptions,
	 * warnings, sources, copy-citation). Handles the value-less states
	 * (`context_required`, `unsupported`, "not available") as inline prompts /
	 * notes rather than errors (rulebook §A.2, §C.6).
	 */
	import type { ConversionResult } from '$lib/conversion/types';
	import { formatRange, formatValue } from '$lib/formatting/numbers';
	import { resolveSources } from '$lib/ui/engine';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';
	import CopyButton from './CopyButton.svelte';
	import SourceRefs from './SourceRefs.svelte';

	let {
		result,
		/** Optional slot: a control to render for a context_required row (e.g. basis toggle). */
		contextControl
	}: {
		result: ConversionResult;
		contextControl?: import('svelte').Snippet<[ConversionResult]>;
	} = $props();

	// Per-instance id: every result set renders a stack of these rows, so a
	// literal id would have every "Show details" button on the page pointing at
	// the first row's panel. Two lines because `$props.id()` may only
	// initialise a declaration.
	const uid = $props.id();
	const detailId = `uc-detail-${uid}`;

	let expanded = $state(false);

	const hasValue = $derived(result.value !== null);
	// Value-less rows already show their explanation inline — the disclosure is
	// only worth rendering when it adds something beyond that.
	const hasDetail = $derived(
		Boolean(
			result.formula ||
			result.assumptions.length ||
			result.warnings.length ||
			result.source_refs.length ||
			(hasValue && result.explanation)
		)
	);

	/**
	 * Plain value for copy: no `~` marker, no thousands separators — and no more
	 * precision than the result's own exactness allows.
	 *
	 * Copying `raw` verbatim handed out 29 significant digits for `1 kg lignite`
	 * (`3.3055555555555555555555555555 kWh`) — a figure whose source records a
	 * 5.5–21.6 MJ/kg range. Full precision is deliberately available on the API,
	 * where it ships next to an `exactness_note` explaining what it does and does
	 * not mean; a clipboard has no room for that caveat, and a pasted number
	 * loses every label this tool spent its effort attaching.
	 *
	 * It goes through `formatValue`, the same function the display uses, so the
	 * clipboard and the screen can never disagree. Applying `sigFigsFor` directly
	 * did disagree: it capped `exact` rows at 6 figures while the display showed
	 * them whole, so `1 therm to J` read 105,505,585.262 and copied 105506000.
	 */
	const copyValue = $derived.by(() => {
		if (result.raw === null || result.raw === undefined) return (result.value ?? '').toString();
		return formatValue(result.raw, result.exactness, { thousands: false }).replace(/^~/, '');
	});

	// Range formatted through the exactness-bounded formatter (sig-fig cap + ~),
	// in THIS row's target unit — the engine converts it per unit (§C.7 rule 2).
	const rangeDisplay = $derived(
		result.range ? formatRange(result.range.low, result.range.high, result.exactness) : ''
	);

	// "Copy citation": value + unit (+ range) + first source publisher/title.
	const citation = $derived.by(() => {
		if (!hasValue) return '';
		const srcs = resolveSources(result.source_refs);
		const src = srcs[0];
		const srcStr = src ? ` — source: ${src.publisher ?? src.title}` : '';
		const rangeStr = rangeDisplay ? `, range ${rangeDisplay} ${result.unit_label}` : '';
		return `${result.value} ${result.unit_label} (${result.exactness}${rangeStr})${srcStr}`;
	});
</script>

<!--
	A row is a line in its group's list, not a card of its own: eight bordered
	boxes for one fuel's energy figures filled a whole screen. The requested
	target row carries an accent tint so the answer stands out in its group.
-->
<div
	class="-mx-2 rounded-lg px-2 py-2"
	style={result.is_target
		? 'background:color-mix(in srgb, var(--accent) 9%, transparent)'
		: undefined}
>
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
		<div class="min-w-0 flex-1">
			{#if hasValue}
				<div class="flex flex-wrap items-baseline gap-x-2">
					<span class="uc-num text-lg font-semibold tracking-tight" style="color:var(--text)">
						{result.value}
					</span>
					<span class="text-sm font-medium" style="color:var(--text-muted)"
						>{result.unit_label}</span
					>
					{#if rangeDisplay}
						<span class="uc-num text-xs" style="color:var(--text-muted)"
							>range {rangeDisplay} {result.unit_label}</span
						>
					{/if}
				</div>
			{:else}
				<div class="flex items-center gap-2 text-sm font-medium" style="color:var(--text-muted)">
					{#if result.exactness === 'context_required'}
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
							<path
								d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.5h.01"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
						</svg>
						<span>Context required</span>
					{:else}
						<span>Not available</span>
					{/if}
				</div>
			{/if}
		</div>

		<div class="ml-auto flex shrink-0 items-center gap-1.5">
			<ExactnessBadge exactness={result.exactness} />
			{#if hasValue}
				<CopyButton text={copyValue} label="Copy value" iconOnly />
			{/if}
			{#if hasDetail}
				<!-- The visible word never changes ("Details"), only the chevron and
				     the accessible state do — so toggling cannot resize the cluster
				     and re-wrap the value opposite it. Below `sm` the word is dropped
				     (the accessible name stays): on a phone it pushed the unit onto a
				     second line on most rows. -->
				<button
					type="button"
					class="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] sm:h-8"
					style="border-color:var(--border);color:var(--text-muted)"
					onclick={() => (expanded = !expanded)}
					aria-expanded={expanded}
					aria-controls={detailId}
					aria-label={expanded ? 'Hide details' : 'Show details'}
				>
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
						class="transition-transform"
						style={expanded ? 'transform:rotate(90deg)' : ''}
					>
						<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="hidden sm:inline">Details</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Inline explanation for value-less prompts. -->
	{#if !hasValue && result.explanation}
		<p class="mt-1.5 text-sm leading-snug" style="color:var(--text-muted)">{result.explanation}</p>
	{/if}

	<!-- Context control (basis toggle, region/year picker, fuel picker) if provided. -->
	<!-- The snippet renders nothing for most rows; wrapping it unconditionally
	     left an 8px margin on every one of them. The snippet supplies its own
	     spacing when it has something to show. -->
	{#if contextControl}{@render contextControl(result)}{/if}

	<!-- Illustrative examples (clearly labeled, never a default — rulebook §C.6). -->
	{#if result.illustrative_examples && result.illustrative_examples.length > 0}
		<div
			class="mt-3 rounded-lg border border-dashed px-3 py-2"
			style="border-color:var(--border-strong)"
		>
			<div
				class="mb-1.5 text-[0.68rem] font-semibold tracking-wide uppercase"
				style="color:var(--text-faint)"
			>
				Illustrative examples — not a default
			</div>
			<ul class="space-y-1">
				{#each result.illustrative_examples as ex, i (ex.label + i)}
					<li class="flex items-baseline justify-between gap-3 text-sm">
						<span class="flex items-baseline gap-1.5" style="color:var(--text-muted)">
							{ex.label}
							{#if ex.pollutant}
								<!-- CO2 vs CO2e are different metrics — label each row so two
								     examples are never read as directly comparable (§D.6). -->
								<span
									class="rounded-full border px-1.5 text-[0.62rem] font-semibold whitespace-nowrap"
									style="border-color:var(--border-strong);color:var(--text)"
									title="Metric — CO2 and CO2e are not comparable">{ex.pollutant}</span
								>
							{/if}
						</span>
						<span class="uc-num" style="color:var(--text)">{ex.value} {ex.unit_label}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Expandable detail (formula / assumptions / warnings / sources).
	     Also shown for value-less rows: their warnings/sources would otherwise
	     only appear unattributed in the set-level panels. -->
	{#if hasDetail}
		<div>
			{#if expanded}
				<div
					id={detailId}
					class="mt-2 space-y-3 rounded-lg px-3 py-2.5 text-sm"
					style="background:var(--surface-2)"
				>
					{#if hasValue && result.explanation}
						<p class="leading-snug" style="color:var(--text-muted)">{result.explanation}</p>
					{/if}

					{#if result.formula}
						<div>
							<div
								class="mb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
								style="color:var(--text-faint)"
							>
								Calculation path
							</div>
							<code
								class="block overflow-x-auto rounded-md px-2 py-1.5 font-mono text-[0.8rem]"
								style="background:var(--surface);border:1px solid var(--border);color:var(--text)"
								>{result.formula}</code
							>
						</div>
					{/if}

					{#if result.assumptions.length > 0}
						<div>
							<div
								class="mb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
								style="color:var(--text-faint)"
							>
								Assumptions
							</div>
							<ul class="space-y-1">
								{#each result.assumptions as a, i (a.kind + i)}
									<li class="leading-snug" style="color:var(--text-muted)">
										<span class="font-medium" style="color:var(--text)"
											>{a.kind.replace(/_/g, ' ')}:</span
										>
										{a.text}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if result.warnings.length > 0}
						<div>
							<div
								class="mb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
								style="color:var(--text-faint)"
							>
								Warnings
							</div>
							<ul class="space-y-1">
								{#each result.warnings as w, i (w.kind + i)}
									<li class="leading-snug" style="color:var(--warn-fg)">{w.text}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if result.source_refs.length > 0}
						<div>
							<div
								class="mb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
								style="color:var(--text-faint)"
							>
								Sources
							</div>
							<SourceRefs refs={result.source_refs} compact />
						</div>
					{/if}

					{#if citation}
						<div class="pt-1">
							<CopyButton
								text={citation}
								label="Copy citation"
								copiedLabel="Citation copied"
								compact
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
