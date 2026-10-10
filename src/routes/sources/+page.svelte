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
		<!-- Eleven sources are a long scroll on a phone. This index jumps to a card;
		     the card ids below are unchanged because other pages link to
		     /sources#<id>. -->
		<nav
			aria-label="On this page"
			class="mb-8 rounded-[var(--radius-card)] border p-4"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h2
				class="mb-1 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				On this page
			</h2>
			<ul class="sm:columns-2 sm:gap-6">
				{#each sources as s (s.id)}
					<li class="break-inside-avoid">
						<a
							href="#{s.id}"
							class="flex min-h-10 items-center text-sm leading-snug hover:text-[var(--accent)] sm:min-h-9"
							style="color:var(--text-muted)">{s.title}</a
						>
					</li>
				{/each}
			</ul>
		</nav>

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

					<dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
						{#if s.publisher}
							<div class="col-span-2 flex gap-2 sm:col-span-1">
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
						{#if s.retrieved_at}
							<div class="flex gap-2">
								<dt style="color:var(--text-faint)">Retrieved</dt>
								<dd class="uc-num font-medium">{s.retrieved_at}</dd>
							</div>
						{/if}
						{#if s.license}
							<!-- Licence text can run to a full sentence (IPCC): full width, not a half column. -->
							<div class="col-span-2 flex gap-2">
								<dt style="color:var(--text-faint)">License</dt>
								<dd class="font-medium">{s.license}</dd>
							</div>
						{/if}
					</dl>

					<!-- Source notes quote raw URLs and long publication titles. Without an
					     explicit break they are single unbreakable tokens that pushed this
					     page 450px wider than a phone screen. -->
					{#if s.reliability}
						<p class="mt-3 text-sm leading-snug break-words" style="color:var(--text-muted)">
							<span class="font-medium" style="color:var(--text)">Reliability:</span>
							{s.reliability}
						</p>
					{/if}
					{#if s.notes}
						<!-- Collapsed: the notes quote URLs and publication details that triple the
						     card's height on a phone. Nothing is dropped, it is one tap away. -->
						<details class="group mt-2">
							<summary
								class="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden"
								style="color:var(--text-muted)"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
									class="shrink-0 transition-transform group-open:rotate-90"
								>
									<path
										d="M9 6l6 6-6 6"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								Notes
							</summary>
							<p class="text-sm leading-snug break-words" style="color:var(--text-faint)">
								{s.notes}
							</p>
						</details>
					{/if}

					<div class="mt-1 flex items-center gap-4 text-sm">
						{#if s.url}
							<a
								href={s.url}
								target="_blank"
								rel="external noopener noreferrer"
								class="inline-flex min-h-10 items-center gap-1 font-medium hover:underline"
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
						<a
							href="#{s.id}"
							class="inline-flex min-h-10 items-center text-xs hover:text-[var(--accent)]"
							style="color:var(--text-faint)"
							aria-label="Link to {s.title}">Permalink</a
						>
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
