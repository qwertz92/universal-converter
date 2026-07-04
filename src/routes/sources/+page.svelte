<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import { allSources } from '$lib/ui/engine';

	const sources = $derived([...allSources()].sort((a, b) => a.title.localeCompare(b.title)));
</script>

<Seo
	title="Sources"
	description="The data sources behind every non-exact conversion — publisher, year, license, reliability and retrieval date, so any figure can be traced to its origin."
/>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		eyebrow="Provenance"
		title="Sources"
		lede="Every non-exact factor in this tool references one of these sources. We prioritise official standards, government and agency data, then international organisations and serious technical references — and we never invent numbers."
	/>

	{#if sources.length === 0}
		<p class="text-sm" style="color:var(--text-faint)">No sources loaded.</p>
	{:else}
		<div class="space-y-3">
			{#each sources as s (s.id)}
				<article
					id={s.id}
					class="scroll-mt-20 rounded-[var(--radius-card)] border p-5"
					style="border-color:var(--border);background:var(--surface)"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<h2 class="text-base font-semibold tracking-tight">{s.title}</h2>
						{#if s.type}
							<span
								class="rounded-full border px-2 py-0.5 text-[0.68rem] font-medium"
								style="border-color:var(--border);color:var(--text-faint)"
							>
								{s.type.replace(/-/g, ' ')}
							</span>
						{/if}
					</div>

					<dl class="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
						{#if s.publisher}
							<div class="flex gap-2">
								<dt style="color:var(--text-faint)">Publisher</dt>
								<dd class="font-medium">{s.publisher}</dd>
							</div>
						{/if}
						{#if s.publication_year}
							<div class="flex gap-2">
								<dt style="color:var(--text-faint)">Year</dt>
								<dd class="uc-num font-medium">{s.publication_year}</dd>
							</div>
						{/if}
						{#if s.license}
							<div class="flex gap-2">
								<dt style="color:var(--text-faint)">License</dt>
								<dd class="font-medium">{s.license}</dd>
							</div>
						{/if}
						{#if s.retrieved_at}
							<div class="flex gap-2">
								<dt style="color:var(--text-faint)">Retrieved</dt>
								<dd class="uc-num font-medium">{s.retrieved_at}</dd>
							</div>
						{/if}
					</dl>

					{#if s.reliability}
						<p class="mt-3 text-sm leading-snug" style="color:var(--text-muted)">
							<span class="font-medium" style="color:var(--text)">Reliability:</span>
							{s.reliability}
						</p>
					{/if}
					{#if s.notes}
						<p class="mt-1.5 text-sm leading-snug" style="color:var(--text-faint)">{s.notes}</p>
					{/if}

					<div class="mt-3 flex items-center gap-4 text-sm">
						{#if s.url}
							<a
								href={s.url}
								target="_blank"
								rel="external noopener noreferrer"
								class="inline-flex items-center gap-1 font-medium hover:underline"
								style="color:var(--accent)"
							>
								Visit source
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path
										d="M7 17L17 7M17 7H8M17 7v9"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</a>
						{/if}
						<code class="text-xs" style="color:var(--text-faint)">#{s.id}</code>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<p class="mt-8 text-sm" style="color:var(--text-faint)">
		How these feed into results is described on the
		<a
			href={resolve('/methodology')}
			class="hover:text-[var(--accent)]"
			style="color:var(--text-muted)">methodology page</a
		>.
	</p>
</div>
