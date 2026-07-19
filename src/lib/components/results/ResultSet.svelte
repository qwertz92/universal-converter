<script lang="ts">
	/**
	 * Renders a full ConversionResultSet: the input echo, each result group as a
	 * card (canonical order — the engine already orders them), and set-level
	 * assumptions / warnings / sources meta-panels (spec §8.3, rulebook §C.8).
	 *
	 * `contextControl` lets the parent inject the right control for a
	 * context_required row (a fuel picker, a basis toggle, a region/year prompt).
	 */
	import { resolve } from '$app/paths';
	import type { ConversionResultSet, ConversionResult } from '$lib/conversion/types';
	import ResultGroupCard from './ResultGroupCard.svelte';
	import WarningsNote from './WarningsNote.svelte';
	import SourceRefs from './SourceRefs.svelte';

	let {
		resultSet,
		contextControl
	}: {
		resultSet: ConversionResultSet;
		contextControl?: import('svelte').Snippet<[ConversionResult]>;
	} = $props();

	// Meta groups are surfaced as their own dedicated panels below the cards.
	const META_KEYS = new Set(['assumptions', 'warnings', 'sources', 'formula']);
	const valueGroups = $derived(resultSet.groups.filter((g) => !META_KEYS.has(g.key)));

	const input = $derived(resultSet.input);
</script>

<div class="space-y-4">
	<!-- Input echo -->
	<div
		class="rounded-[var(--radius-card)] border px-4 py-3"
		style="border-color:var(--border);background:var(--surface-2)"
	>
		<div class="text-xs font-medium tracking-wide uppercase" style="color:var(--text-faint)">
			Converting
		</div>
		<div class="mt-0.5 text-lg font-semibold" style="color:var(--text)">
			<span class="uc-num">{input.value}</span>
			<span style="color:var(--text-muted)">{input.unit_label}</span>
			{#if input.fuel_label}<span style="color:var(--accent)"> · {input.fuel_label}</span>{/if}
		</div>
	</div>

	<!-- Value groups (already in canonical order) -->
	<h2 class="sr-only">Conversion results</h2>
	<div class="grid gap-4 md:grid-cols-2">
		{#each valueGroups as group (group.key)}
			<ResultGroupCard {group} {contextControl} />
		{/each}
	</div>

	<!-- Set-level warnings (calm, expandable) -->
	{#if resultSet.warnings.length > 0}
		<WarningsNote warnings={resultSet.warnings} />
	{/if}

	<!-- Set-level assumptions -->
	{#if resultSet.assumptions.length > 0}
		<section
			class="rounded-[var(--radius-card)] border p-4 sm:p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h3 class="mb-2 text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
				Assumptions
			</h3>
			<ul class="space-y-1.5 text-sm">
				{#each resultSet.assumptions as a, i (a.kind + i)}
					<li class="leading-snug" style="color:var(--text-muted)">
						<span class="font-medium" style="color:var(--text)">{a.kind.replace(/_/g, ' ')}:</span>
						{a.text}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Set-level sources -->
	{#if resultSet.source_refs.length > 0}
		<section
			class="rounded-[var(--radius-card)] border p-4 sm:p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h3 class="mb-2 text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
				Sources
			</h3>
			<SourceRefs refs={resultSet.source_refs} />
			<p class="mt-2 text-xs" style="color:var(--text-faint)">
				Follow each source back to its primary document — that traceability is the point.
				<a
					href={resolve('/methodology')}
					class="hover:text-[var(--accent)]"
					style="color:var(--text-muted)">How conversions work →</a
				>
			</p>
		</section>
	{/if}
</div>
