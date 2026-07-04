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
	// A group is "context only" when none of its rows produced a number.
	const isContextOnly = $derived(group.results.every((r) => r.value === null));
</script>

<section
	class="uc-animate-in rounded-[var(--radius-card)] border p-4 sm:p-5"
	style="border-color:var(--border);background:var(--surface)"
	aria-label={meta.title}
>
	<header class="mb-3 flex items-baseline justify-between gap-3">
		<h3 class="text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
			{meta.title}{isContextOnly ? ' — context required' : ''}
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
