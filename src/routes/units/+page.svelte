<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/layout/Seo.svelte';
	import PageHero from '#lib/components/layout/PageHero.svelte';
	import ExactnessBadge from '#lib/components/badges/ExactnessBadge.svelte';
	import { allUnits, DIMENSION_LABEL, DIMENSION_ORDER } from '#lib/ui/engine.js';
	import { displayUnitLabel } from '#lib/formatting/units.js';
	import { searchUnits } from '#lib/ui/search.js';
	import { closestMatches } from '#lib/ui/near-miss.js';
	import type { Unit } from '#lib/conversion/types.js';

	const units = allUnits();
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

	const filtered = $derived(searchUnits(units, query, 999));

	// A slip the substring search cannot absorb ("natural gass") finds nothing; offer
	// the nearest names instead. Suggestions only: the list is never silently widened.
	const suggestions = $derived(
		filtered.length === 0 ? closestMatches(query, units, (u) => [u.id, ...u.names]) : []
	);

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

<svelte:head>
	<!-- Runs while the browser parses the head, before the prerendered list is painted:
	     a hard load with `?q=` marks <html>, and the rule below collapses the unit
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

		<div class="uc-index-results">
			{#if grouped.length === 0}
				<!-- The suggestions render together with this message, so nothing
				     arrives late and no space is held for them. -->
				<div>
					<p class="text-sm" style="color:var(--text-faint)">No units match “{query}”.</p>
					{#if suggestions.length > 0}
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<span class="text-sm" style="color:var(--text-muted)">Did you mean</span>
							{#each suggestions as s (s.id)}
								<a
									href={resolve(`units/${s.id}`)}
									class="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold transition-colors hover:border-[var(--accent)]"
									style="border-color:var(--border);background:var(--surface);color:var(--accent)"
									>{displayUnitLabel(s.names[0])}</a
								>
							{/each}
						</div>
					{/if}
				</div>
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
										href={resolve(`units/${u.id}`)}
										class="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)] sm:flex-nowrap sm:justify-between sm:gap-3"
										style="border-color:var(--border);background:var(--surface)"
									>
										<!-- contents on a phone: name, symbol and badge become siblings so the badge
										     can share the symbol's line; from sm up this is the left block again. -->
										<span class="contents sm:block sm:min-w-0">
											<span
												class="block w-full text-sm leading-snug font-medium break-words sm:w-auto sm:truncate"
												style="color:var(--text)">{displayUnitLabel(u.names[0])}</span
											>
											<span class="uc-num block text-xs" style="color:var(--text-faint)"
												>{displayUnitLabel(u.symbols[0])}</span
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
