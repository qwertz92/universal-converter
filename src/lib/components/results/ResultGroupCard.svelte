<script lang="ts">
	/** A titled card grouping conversion result rows (rulebook §C.8). */
	import type { ResultGroup, ConversionResult } from '$lib/conversion/types';
	import { GROUP_META } from '$lib/ui/groups';
	import ResultRow from './ResultRow.svelte';

	let {
		group,
		contextControl
	}: {
		group: ResultGroup;
		contextControl?: import('svelte').Snippet<[ConversionResult]>;
	} = $props();

	const meta = $derived(GROUP_META[group.key] ?? { title: group.title });
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
</script>

<section
	class="uc-animate-in rounded-[var(--radius-card)] border p-4 sm:p-5"
	style="border-color:var(--border);background:var(--surface)"
	aria-label={meta.title}
>
	<header class="mb-3 flex items-baseline justify-between gap-3">
		<h3 class="text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
			{meta.title}{headerSuffix}
		</h3>
		{#if meta.blurb}
			<p class="hidden text-xs sm:block" style="color:var(--text-faint)">{meta.blurb}</p>
		{/if}
	</header>

	<div class="space-y-2">
		{#each group.results as result, i (result.unit_id + result.category + i)}
			<ResultRow {result} {contextControl} />
		{/each}
	</div>
</section>
