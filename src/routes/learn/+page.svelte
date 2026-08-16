<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import { LEARN_TOPICS } from '$lib/content/learn';

	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return LEARN_TOPICS;
		return LEARN_TOPICS.filter(
			(t) =>
				t.title.toLowerCase().includes(q) ||
				t.summary.toLowerCase().includes(q) ||
				t.slug.toLowerCase().includes(q)
		);
	});
</script>

<Seo
	title="Learn"
	description="Short, sourced explanations of the concepts behind energy and fuel conversions: kW vs kWh, HHV vs LHV, barrel vs boe, CO₂ vs CO₂e, and more."
/>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		eyebrow="Learn"
		title="Concepts, explained"
		lede="The ideas behind the numbers — each written to be correct, compact and sourced. Read these to understand why some conversions are exact and others are only ever estimates."
	/>

	<div class="mb-8">
		<label for="learn-search" class="sr-only">Search articles</label>
		<input
			id="learn-search"
			type="search"
			bind:value={query}
			placeholder="Search articles — e.g. kWh, HHV, boe, region…"
			class="w-full max-w-md rounded-lg border px-3 py-2.5 text-sm outline-none"
			style="background:var(--surface);border-color:var(--border);color:var(--text)"
		/>
	</div>

	{#if filtered.length === 0}
		<p class="text-sm" style="color:var(--text-faint)">No articles match "{query}".</p>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each filtered as topic (topic.slug)}
				<a
					href={resolve(`/learn/${topic.slug}`)}
					class="group flex flex-col rounded-[var(--radius-card)] border p-5 transition-colors hover:border-[var(--accent)]"
					style="border-color:var(--border);background:var(--surface)"
				>
					<h2 class="text-base font-semibold tracking-tight">{topic.title}</h2>
					<p class="mt-1.5 flex-1 text-sm leading-relaxed" style="color:var(--text-muted)">
						{topic.summary}
					</p>
					<span class="mt-3 text-sm font-medium" style="color:var(--accent)">Read →</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
