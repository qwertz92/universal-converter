<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';
	import { allUnits, DIMENSION_LABEL, DIMENSION_ORDER } from '$lib/ui/engine';
	import { searchUnits } from '$lib/ui/search';
	import type { Unit } from '$lib/conversion/types';

	const units = allUnits();
	let query = $state('');

	// `?q=` pre-fills the search box (the 404 page links here with a mistyped
	// slug). Read after mount: a prerendered page has no query string to read.
	onMount(() => {
		query = new URLSearchParams(location.search).get('q') ?? '';
	});

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
			<!-- Jump links: 73 units over 11 dimensions is a long scroll on a phone. On a
			     phone the chips form one sideways-scrolling strip (eleven wrapped chips
			     were five rows, 230px, before the first unit); from sm up they wrap. Each
			     chip is 40px tall to be tappable. -->
			<nav
				aria-label="Jump to a dimension"
				class="-mx-4 -mt-2 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
			>
				{#each grouped as g (g.dimension)}
					<a
						href="#dim-{g.dimension}"
						class="inline-flex min-h-10 shrink-0 items-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors hover:border-[var(--accent)]"
						style="border-color:var(--border);background:var(--surface);color:var(--text-muted)"
						>{g.label}</a
					>
				{/each}
			</nav>

			<div class="space-y-8">
				{#each grouped as g (g.dimension)}
					<section id="dim-{g.dimension}" class="scroll-mt-20">
						<h2
							class="mb-3 text-sm font-semibold tracking-wide uppercase"
							style="color:var(--text-muted)"
						>
							{g.label}
							<span class="font-normal" style="color:var(--text-faint)">· {g.units.length}</span>
						</h2>
						<div class="grid grid-cols-2 gap-2 lg:grid-cols-3">
							{#each g.units as u (u.id)}
								<a
									href={resolve(`/units/${u.id}`)}
									class="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)] sm:flex-nowrap sm:justify-between sm:gap-3"
									style="border-color:var(--border);background:var(--surface)"
								>
									<!-- contents on a phone: name, symbol and badge become siblings so the badge
									     can share the symbol's line; from sm up this is the left block again. -->
									<span class="contents sm:block sm:min-w-0">
										<span
											class="block w-full text-sm leading-snug font-medium break-words sm:w-auto sm:truncate"
											style="color:var(--text)">{u.names[0]}</span
										>
										<span class="uc-num block text-xs" style="color:var(--text-faint)"
											>{u.symbols[0]}</span
										>
									</span>
									<!-- Non-interactive: this badge sits inside the card's own
									     link, and an anchor inside an anchor is invalid HTML. -->
									<ExactnessBadge
										exactness={u.exactness}
										size="xs"
										showGlyph={false}
										interactive={false}
									/>
								</a>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>
