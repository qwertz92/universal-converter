<script lang="ts">
	/** A titled card grouping conversion result rows (rulebook §C.8). */
	import { resolve } from '$app/paths';
	import type { ResultGroup, ConversionResult, HeatingBasis } from '$lib/conversion/types';
	import { groupMeta } from '$lib/ui/groups';
	import { basisSections } from '$lib/ui/basis-sections';
	import ResultRow from './ResultRow.svelte';
	import { rowHasDetail } from '$lib/ui/result-row';

	let {
		group,
		contextControl
	}: {
		group: ResultGroup;
		contextControl?: import('svelte').Snippet<[ConversionResult]>;
	} = $props();

	const meta = $derived(groupMeta(group.key));
	// A group needs a header hint when it produced no number for at least one
	// row. "context required" takes priority (some row is a well-defined
	// prompt for more input); a group that is value-less for another reason
	// entirely (e.g. every row is `unsupported`) reads as "not available"
	// instead — those are not the same state and must not share a label.
	const hasContextRequired = $derived(
		group.results.some((r) => r.exactness === 'context_required')
	);
	const isAllValueless = $derived(group.results.every((r) => r.value === null));
	const headerSuffix = $derived(
		hasContextRequired ? ' — context required' : isAllValueless ? ' — not available' : ''
	);

	// Rows computed from a calorific value are split under a basis heading, so
	// 356.6 MJ (LHV) and 379.1 MJ (HHV) can never be read as one list of
	// equivalent figures (rulebook §C.1).
	const sections = $derived(basisSections(group.results));
	const reserveDetail = $derived(group.results.some(rowHasDetail));
	// One "What is this?" per card is enough; repeating it per heading is noise.
	const firstBasisSection = $derived(sections.findIndex((x) => x.basis !== undefined));

	const BASIS_HEADING = {
		lhv: {
			label: 'Net calorific value · LHV/NCV',
			hint: 'Excludes the heat recovered by condensing the water vapour in the exhaust.'
		},
		hhv: {
			label: 'Gross calorific value · HHV/GCV',
			hint: 'Includes the heat recovered by condensing the water vapour in the exhaust.'
		}
	} satisfies Record<HeatingBasis, { label: string; hint: string }>;
</script>

<section
	class="uc-animate-in rounded-[var(--radius-card)] border p-4 sm:p-5"
	style="border-color:var(--border);background:var(--surface)"
	aria-label={meta.title}
>
	<!-- Stacks below `sm` so the gloss keeps its own line instead of fighting the
	     title for width — it is shown at every size because "CO₂ and CO₂e are
	     separate" is exactly what a first-time reader on a phone needs most. -->
	<header
		class="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
	>
		<h3 class="text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
			{meta.title}{headerSuffix}
		</h3>
		{#if meta.blurb}
			<p class="text-xs sm:text-right" style="color:var(--text-faint)">{meta.blurb}</p>
		{/if}
	</header>

	{#each sections as section, s (s)}
		{#if section.basis}
			<div
				class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3"
				class:mt-3={s > 0}
				class:border-t={s > 0}
				class:pt-3={s > 0}
				style="border-color:var(--border)"
			>
				<h4
					class="text-xs font-semibold"
					style="color:var(--text-muted)"
					title={BASIS_HEADING[section.basis].hint}
				>
					{BASIS_HEADING[section.basis].label}
				</h4>
				{#if s === firstBasisSection}
					<a
						href={resolve('/learn/hhv-vs-lhv')}
						class="text-xs hover:underline"
						style="color:var(--accent)">LHV vs. HHV — what is the difference?</a
					>
				{/if}
			</div>
		{/if}
		<div class="divide-y" style="border-color:var(--border)">
			{#each section.rows as result, i (result.unit_id + result.category + i)}
				<div style="border-color:var(--border)" class="py-0.5">
					<ResultRow {result} {contextControl} {reserveDetail} />
				</div>
			{/each}
		</div>
	{/each}
</section>
