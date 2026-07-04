<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import { allFuels } from '$lib/ui/engine';
	import { searchFuels } from '$lib/ui/search';
	import type { Fuel } from '$lib/conversion/types';

	const fuels = allFuels();
	let query = $state('');

	const filtered = $derived(searchFuels(fuels, query, 999));

	const grouped = $derived.by(() => {
		const byCat: Record<string, Fuel[]> = {};
		const order: string[] = [];
		for (const f of filtered) {
			if (!byCat[f.category]) {
				byCat[f.category] = [];
				order.push(f.category);
			}
			byCat[f.category].push(f);
		}
		return order.map((category) => ({ category, items: byCat[category] }));
	});
</script>

<Seo
	title="Fuels"
	description="A catalog of fuels — density, heating values (LHV/HHV labeled), energy per litre/kg/m³, and CO₂/CO₂e factors — each with sources, assumptions and warnings."
/>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		eyebrow="Reference"
		title="Fuel catalog"
		lede="Density, heating values, energy densities and emission factors for common fuels — every figure sourced, with its heating-value basis labeled and its uncertainty on display."
	/>

	{#if fuels.length === 0}
		<div
			class="rounded-[var(--radius-card)] border border-dashed p-8 text-center"
			style="border-color:var(--border)"
		>
			<p class="text-sm font-medium" style="color:var(--text-muted)">
				The fuel catalog is not loaded in this build yet.
			</p>
			<p class="mt-1 text-sm" style="color:var(--text-faint)">
				Fuel properties are populated from <code>data/fuels.json</code>. Until then, exact unit
				conversions still work in the
				<a href={resolve('/convert')} class="hover:text-[var(--accent)]" style="color:var(--accent)"
					>converter</a
				>.
			</p>
		</div>
	{:else}
		<div class="mb-8">
			<label for="fuel-search" class="sr-only">Search fuels</label>
			<input
				id="fuel-search"
				type="search"
				bind:value={query}
				placeholder="Search fuels — e.g. diesel, natural gas, hydrogen…"
				class="w-full max-w-md rounded-lg border px-3 py-2.5 text-sm outline-none"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			/>
		</div>

		{#if grouped.length === 0}
			<p class="text-sm" style="color:var(--text-faint)">No fuels match “{query}”.</p>
		{:else}
			<div class="space-y-8">
				{#each grouped as g (g.category)}
					<section>
						<h2
							class="mb-3 text-sm font-semibold tracking-wide uppercase"
							style="color:var(--text-muted)"
						>
							{g.category}
							<span class="font-normal" style="color:var(--text-faint)">· {g.items.length}</span>
						</h2>
						<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each g.items as f (f.id)}
								<a
									href={resolve(`/fuels/${f.id}`)}
									class="rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)]"
									style="border-color:var(--border);background:var(--surface)"
								>
									<span class="block text-sm font-medium" style="color:var(--text)"
										>{f.names[0]}</span
									>
									{#if f.phase}
										<span class="block text-xs" style="color:var(--text-faint)">{f.phase}</span>
									{/if}
								</a>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>
