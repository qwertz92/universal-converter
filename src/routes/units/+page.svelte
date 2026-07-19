<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';
	import { allUnits, DIMENSION_LABEL, DIMENSION_ORDER } from '$lib/ui/engine';
	import { searchUnits } from '$lib/ui/search';
	import type { Unit } from '$lib/conversion/types';

	const units = allUnits();
	let query = $state('');

	const filtered = $derived(searchUnits(units, query, 999));

	const grouped = $derived.by(() => {
		const byDim: Record<string, Unit[]> = {};
		for (const u of filtered) {
			(byDim[u.dimension] ??= []).push(u);
		}
		return DIMENSION_ORDER.filter((d) => byDim[d]).map((d) => ({
			dimension: d,
			label: DIMENSION_LABEL[d] ?? d,
			units: byDim[d]
		}));
	});
</script>

<Seo
	title="Units"
	description="A searchable index of the units the Universal Converter supports — energy, power, mass, volume, time and more — each with its exactness and definition."
/>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		eyebrow="Reference"
		title="Unit index"
		lede="Every unit the converter knows, grouped by dimension. Open a unit for its definition, exactness, aliases and common conversions."
	/>

	{#if units.length === 0}
		<div
			class="rounded-[var(--radius-card)] border border-dashed p-8 text-center"
			style="border-color:var(--border)"
		>
			<p class="text-sm font-medium" style="color:var(--text-muted)">
				The unit catalog is not loaded in this build.
			</p>
			<p class="mt-1 text-sm" style="color:var(--text-faint)">
				Units are populated from <code>data/units.json</code>. Without it, no conversions can be
				computed.
			</p>
		</div>
	{:else}
		<div class="mb-8">
			<label for="unit-search" class="sr-only">Search units</label>
			<input
				id="unit-search"
				type="search"
				bind:value={query}
				placeholder="Search units — e.g. kWh, therm, gallon, tonne…"
				class="w-full max-w-md rounded-lg border px-3 py-2.5 text-sm outline-none"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			/>
		</div>

		{#if grouped.length === 0}
			<p class="text-sm" style="color:var(--text-faint)">No units match “{query}”.</p>
		{:else}
			<div class="space-y-8">
				{#each grouped as g (g.dimension)}
					<section>
						<h2
							class="mb-3 text-sm font-semibold tracking-wide uppercase"
							style="color:var(--text-muted)"
						>
							{g.label}
							<span class="font-normal" style="color:var(--text-faint)">· {g.units.length}</span>
						</h2>
						<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each g.units as u (u.id)}
								<a
									href={resolve(`/units/${u.id}`)}
									class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)]"
									style="border-color:var(--border);background:var(--surface)"
								>
									<span class="min-w-0">
										<span class="block truncate text-sm font-medium" style="color:var(--text)"
											>{u.names[0]}</span
										>
										<span class="uc-num block text-xs" style="color:var(--text-faint)"
											>{u.symbols[0]}</span
										>
									</span>
									<ExactnessBadge exactness={u.exactness} size="xs" showGlyph={false} />
								</a>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>
