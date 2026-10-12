<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/layout/Seo.svelte';
	import PageHero from '#lib/components/layout/PageHero.svelte';
	import FuelComparison from '#lib/components/fuels/FuelComparison.svelte';
	import { allFuels } from '#lib/ui/engine.js';
	import { searchFuels } from '#lib/ui/search.js';
	import { closestMatches } from '#lib/ui/near-miss.js';
	import type { Fuel } from '#lib/conversion/types.js';

	const fuels = allFuels();
	let query = $state('');

	// `?q=` pre-fills the search box (the 404 page links here with a mistyped
	// slug). Read after mount: a prerendered page has no query string to read.
	// Until then the prerendered full list would be on screen, so the <svelte:head>
	// script below collapses it as soon as it sees a
	// `q`; this reveals it once the filtered list is rendered.
	onMount(() => {
		query = new URLSearchParams(location.search).get('q') ?? '';
		void tick().then(() => {
			delete document.documentElement.dataset.ucQuery;
		});
	});

	const filtered = $derived(searchFuels(fuels, query, 999));

	// A slip the substring search cannot absorb ("natural gass") finds nothing; offer
	// the nearest names instead. Suggestions only: the list is never silently widened.
	const suggestions = $derived(
		filtered.length === 0 ? closestMatches(query, fuels, (f) => [f.id, ...f.names]) : []
	);

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

<svelte:head>
	<!-- Runs while the browser parses the head, before the prerendered list is painted:
	     a hard load with `?q=` marks <html>, and the rule below collapses the fuel
	     list until the page has applied that query (see onMount). Without a query it
	     does nothing. -->
	<script>
		(function () {
			try {
				var q = new URLSearchParams(location.search).get('q');
				if (q && q.trim()) document.documentElement.dataset.ucQuery = '';
			} catch (e) {
				/* no query string to read: the list stays as prerendered */
			}
		})();
	</script>
</svelte:head>

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
				<a href={resolve('convert')} class="hover:text-[var(--accent)]" style="color:var(--accent)"
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

		<div class="mb-8">
			<FuelComparison />
		</div>

		<div class="uc-index-results">
			{#if grouped.length === 0}
				<!-- The suggestions render together with this message, so nothing
				     arrives late and no space is held for them. -->
				<div>
					<p class="text-sm" style="color:var(--text-faint)">No fuels match “{query}”.</p>
					{#if suggestions.length > 0}
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<span class="text-sm" style="color:var(--text-muted)">Did you mean</span>
							{#each suggestions as s (s.id)}
								<a
									href={resolve(`fuels/${s.id}`)}
									class="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold transition-colors hover:border-[var(--accent)]"
									style="border-color:var(--border);background:var(--surface);color:var(--accent)"
									>{s.names[0]}</a
								>
							{/each}
						</div>
					{/if}
				</div>
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
										href={resolve(`fuels/${f.id}`)}
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
		</div>
	{/if}
</div>

<style>
	/* Collapsed rather than hidden in place: the layout keeps the footer at the
	   bottom of a short page, so the filtered list fills the gap above it without
	   moving anything. The animation is a failsafe that lifts the cap after 4s
	   should the script that reveals the list never run. */
	:global(html[data-uc-query]) .uc-index-results {
		max-height: 0;
		overflow: hidden;
		animation: uc-reveal 0s 4s forwards;
	}
	@keyframes uc-reveal {
		to {
			max-height: 100000px;
		}
	}
</style>
