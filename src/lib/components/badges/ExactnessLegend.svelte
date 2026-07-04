<script lang="ts">
	/** The full exactness legend (rulebook §A) — the badge + its description. */
	import { EXACTNESS_LEGEND_ORDER, EXACTNESS_META } from '$lib/ui/exactness';
	import ExactnessBadge from './ExactnessBadge.svelte';
</script>

<ul class="space-y-2.5">
	{#each EXACTNESS_LEGEND_ORDER as level (level)}
		<li class="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
			<span class="shrink-0 sm:w-44"><ExactnessBadge exactness={level} /></span>
			<span class="text-sm leading-snug" style="color:var(--text-muted)"
				>{EXACTNESS_META[level].description}</span
			>
		</li>
	{/each}
</ul>
