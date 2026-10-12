<script lang="ts">
	/**
	 * "At a glance" tiles above the full results: one headline figure per kind
	 * of result (`#lib/ui/key-figures.js`). Each tile is an existing result row —
	 * same value, same exactness badge, same basis — never a recomputation.
	 */
	import type { KeyFigure } from '#lib/ui/key-figures.js';
	import ExactnessBadge from '#lib/components/badges/ExactnessBadge.svelte';
	import { displayUnitLabel } from '#lib/formatting/units.js';

	let { figures }: { figures: KeyFigure[] } = $props();
</script>

<section aria-label="At a glance">
	<h3 class="mb-2 text-xs font-semibold tracking-wide uppercase" style="color:var(--text-faint)">
		At a glance
	</h3>
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each figures as f (f.label)}
			<li
				class="flex flex-col gap-1 rounded-[var(--radius-card)] border px-4 py-3"
				style="border-color:var(--border);background:var(--surface)"
			>
				<span class="text-xs font-medium" style="color:var(--text-muted)">{f.label}</span>
				<!-- Number and unit are two lines in every tile. Side by side they wrapped
				     only in the tiles whose unit is long ("kg CO₂e" dropped under its
				     number while "kg CO₂" stayed beside it), so neighbours disagreed. -->
				<span class="flex flex-col">
					<span class="uc-num text-2xl font-semibold tracking-tight" style="color:var(--text)"
						>{f.row.value}</span
					>
					<span class="text-sm" style="color:var(--text-muted)"
						>{displayUnitLabel(f.row.unit_label)}</span
					>
				</span>
				<span><ExactnessBadge exactness={f.row.exactness} size="xs" /></span>
			</li>
		{/each}
	</ul>
</section>
