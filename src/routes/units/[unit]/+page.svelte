<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import Breadcrumbs from '$lib/components/layout/Breadcrumbs.svelte';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';
	import { DIMENSION_LABEL } from '$lib/ui/engine';
	import { EXACTNESS_META } from '$lib/ui/exactness';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { unit, conversions, sources, learn } = $derived(data);

	const dimLabel = $derived(DIMENSION_LABEL[unit.dimension] ?? unit.dimension);
</script>

<Seo
	title={`${unit.names[0]} (${unit.symbols[0]})`}
	description={`Definition, exactness and common conversions for the ${unit.names[0]} (${unit.symbols[0]}) — a ${dimLabel.toLowerCase()} unit in the Universal Converter.`}
/>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<Breadcrumbs
		items={[{ href: resolve('/units'), path: '/units', label: 'Units' }, { label: dimLabel }]}
	/>

	<header class="mb-8">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{unit.names[0]}</h1>
			<span
				class="uc-num rounded-md border px-2 py-1 text-sm font-medium"
				style="border-color:var(--border);color:var(--text-muted)"
			>
				{unit.symbols[0]}
			</span>
			<ExactnessBadge exactness={unit.exactness} />
		</div>
		{#if unit.notes}
			<p class="mt-3 max-w-2xl text-[0.95rem] leading-relaxed" style="color:var(--text-muted)">
				{unit.notes}
			</p>
		{/if}
	</header>

	<div class="grid gap-4 sm:grid-cols-2">
		<!-- Definition -->
		<section
			class="rounded-[var(--radius-card)] border p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Definition
			</h2>
			<dl class="space-y-2.5 text-sm">
				<div class="flex justify-between gap-3">
					<dt style="color:var(--text-faint)">Dimension</dt>
					<dd class="font-medium">{dimLabel}</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt style="color:var(--text-faint)">Symbols</dt>
					<dd class="uc-num font-medium">{unit.symbols.join(', ')}</dd>
				</div>
				{#if unit.system}
					<div class="flex justify-between gap-3">
						<dt style="color:var(--text-faint)">System</dt>
						<dd class="font-medium">{unit.system}</dd>
					</div>
				{/if}
				<div class="flex justify-between gap-3">
					<dt style="color:var(--text-faint)">Base factor</dt>
					<dd class="uc-num font-medium">×{unit.to_base_factor}</dd>
				</div>
				<div class="flex items-start justify-between gap-3">
					<dt style="color:var(--text-faint)">Exactness</dt>
					<dd class="max-w-[16rem] text-right font-medium">
						{EXACTNESS_META[unit.exactness].label}
					</dd>
				</div>
			</dl>
			<p class="mt-3 text-xs leading-snug" style="color:var(--text-faint)">
				{EXACTNESS_META[unit.exactness].description}
			</p>
		</section>

		<!-- Aliases + sources -->
		<section
			class="rounded-[var(--radius-card)] border p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Also known as
			</h2>
			{#if unit.aliases.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each [...unit.names.slice(1), ...unit.aliases] as alias (alias)}
						<span
							class="rounded-md border px-2 py-0.5 text-xs"
							style="border-color:var(--border);color:var(--text-muted)">{alias}</span
						>
					{/each}
				</div>
			{:else}
				<p class="text-sm" style="color:var(--text-faint)">No additional aliases.</p>
			{/if}

			<h2
				class="mt-5 mb-2 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Sources
			</h2>
			{#if sources.length > 0}
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
			{:else}
				<p class="text-sm" style="color:var(--text-faint)">
					Exact by definition — no external source needed.
				</p>
			{/if}
		</section>
	</div>

	<!-- Common conversions -->
	{#if conversions.length > 0}
		<section
			class="mt-4 rounded-[var(--radius-card)] border p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<div class="mb-3 flex items-baseline justify-between gap-3">
				<h2 class="text-sm font-semibold tracking-wide uppercase" style="color:var(--text-muted)">
					Common conversions
				</h2>
				<span class="uc-num text-xs" style="color:var(--text-faint)"
					>for 1&nbsp;{unit.symbols[0]}</span
				>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<tbody>
						{#each conversions as c (c.targetId)}
							<tr class="border-t" style="border-color:var(--border)">
								<td class="py-2 pr-3">
									<a
										href={resolve(`/units/${c.targetId}`)}
										class="hover:text-[var(--accent)]"
										style="color:var(--text-muted)">{c.label}</a
									>
								</td>
								<td class="uc-num py-2 pr-3 text-right font-medium">{c.value}</td>
								<td class="py-2 pl-1 text-xs" style="color:var(--text-faint)">{c.symbol}</td>
								<td class="py-2 pl-3 text-right">
									<ExactnessBadge exactness={c.exactness} size="xs" showGlyph={false} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-4">
				<a
					href={resolve(`/convert?q=${encodeURIComponent(`1 ${unit.symbols[0]}`)}`)}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold"
					style="background:var(--accent);color:var(--accent-contrast)"
				>
					Open in converter →
				</a>
			</div>
		</section>
	{/if}

	<!-- Related learn -->
	{#if learn.length > 0}
		<section class="mt-4">
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Learn more
			</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each learn as topic (topic.slug)}
					<a
						href={resolve(`/learn/${topic.slug}`)}
						class="rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)]"
						style="border-color:var(--border);background:var(--surface)"
					>
						<span class="block text-sm font-medium" style="color:var(--text)">{topic.title}</span>
						<span class="block text-xs" style="color:var(--text-faint)">{topic.summary}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
