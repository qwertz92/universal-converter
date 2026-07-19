<script lang="ts">
	/**
	 * One conversion result row. Surfaces the value + unit + exactness badge, a
	 * copy-value button, and an expandable detail panel (formula, assumptions,
	 * warnings, sources, copy-citation). Handles the value-less states
	 * (`context_required`, `unsupported`, "not available") as inline prompts /
	 * notes rather than errors (rulebook §A.2, §C.6).
	 */
	import type { ConversionResult } from '$lib/conversion/types';
	import { formatRange } from '$lib/formatting/numbers';
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

	// Plain value for copy (strip the ~ estimate marker and thousands separators).
	const copyValue = $derived((result.raw ?? result.value ?? '').toString());

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

<div
	class="rounded-lg border px-3 py-2.5"
	style="border-color:var(--border);background:var(--surface)"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if hasValue}
				<div class="flex flex-wrap items-baseline gap-x-2">
					<span class="uc-num text-xl font-semibold tracking-tight" style="color:var(--text)">
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
						<span>Needs more context</span>
					{:else}
						<span>Not available</span>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			<ExactnessBadge exactness={result.exactness} />
			{#if hasValue}
				<CopyButton text={copyValue} label="Copy" compact />
			{/if}
		</div>
	</div>

	<!-- Inline explanation for value-less prompts. -->
	{#if !hasValue && result.explanation}
		<p class="mt-1.5 text-sm leading-snug" style="color:var(--text-muted)">{result.explanation}</p>
	{/if}

	<!-- Context control (basis toggle, region/year picker, fuel picker) if provided. -->
	{#if contextControl}
		<div class="mt-2">{@render contextControl(result)}</div>
	{/if}

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
		<div class="mt-2">
			<button
				type="button"
				class="inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--accent)]"
				style="color:var(--text-faint)"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
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
				{expanded ? 'Hide details' : 'Show details'}
			</button>

			{#if expanded}
				<div
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
