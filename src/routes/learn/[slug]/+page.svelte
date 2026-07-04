<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import LiveExample from '$lib/components/results/LiveExample.svelte';
	import { LEARN_TOPICS } from '$lib/content/learn';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { topic, body, sources } = $derived(data);

	// Prev/next navigation through the topic list.
	const idx = $derived(LEARN_TOPICS.findIndex((t) => t.slug === topic.slug));
	const prev = $derived(idx > 0 ? LEARN_TOPICS[idx - 1] : null);
	const next = $derived(idx < LEARN_TOPICS.length - 1 ? LEARN_TOPICS[idx + 1] : null);
</script>

<Seo title={topic.title} description={topic.summary} />

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
	<nav class="mb-6 text-sm" style="color:var(--text-faint)">
		<a href={resolve('/learn')} class="hover:text-[var(--accent)]">Learn</a>
		<span class="mx-1.5">/</span>
		<span>{topic.title}</span>
	</nav>

	<header class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{topic.title}</h1>
		<p class="mt-2 text-[0.95rem] leading-relaxed" style="color:var(--text-muted)">
			{topic.summary}
		</p>
	</header>

	<article class="uc-prose">
		<!-- Trusted in-repo HTML (no user input); see src/lib/content/learn-bodies.ts. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- body is hand-written, in-repo, non-user content -->
		{@html body}
	</article>

	{#if topic.example}
		<LiveExample query={topic.example} />
	{/if}

	{#if sources.length > 0}
		<section class="mt-8 border-t pt-5" style="border-color:var(--border)">
			<h2
				class="mb-2 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Sources
			</h2>
			<ul class="space-y-1.5 text-sm">
				{#each sources as s (s.id)}
					<li>
						<a
							href={resolve(`/sources#${s.id}`)}
							class="hover:text-[var(--accent)]"
							style="color:var(--text-muted)"
						>
							{s.publisher ?? s.title}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Prev / next -->
	<nav
		class="mt-10 flex items-stretch justify-between gap-3 border-t pt-6"
		style="border-color:var(--border)"
	>
		{#if prev}
			<a
				href={resolve(`/learn/${prev.slug}`)}
				class="group flex-1 rounded-lg border p-3 transition-colors hover:border-[var(--accent)]"
				style="border-color:var(--border)"
			>
				<span class="block text-xs" style="color:var(--text-faint)">← Previous</span>
				<span class="mt-0.5 block text-sm font-medium" style="color:var(--text)">{prev.title}</span>
			</a>
		{:else}
			<span class="flex-1"></span>
		{/if}
		{#if next}
			<a
				href={resolve(`/learn/${next.slug}`)}
				class="group flex-1 rounded-lg border p-3 text-right transition-colors hover:border-[var(--accent)]"
				style="border-color:var(--border)"
			>
				<span class="block text-xs" style="color:var(--text-faint)">Next →</span>
				<span class="mt-0.5 block text-sm font-medium" style="color:var(--text)">{next.title}</span>
			</a>
		{:else}
			<span class="flex-1"></span>
		{/if}
	</nav>
</div>
