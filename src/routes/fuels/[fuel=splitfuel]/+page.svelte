<script lang="ts">
	/**
	 * A word that names several fuels (/fuels/heating-oil, /fuels/coal). The
	 * converter answers "1 L heating oil" by offering the grades rather than
	 * picking one; this page does the same for a link or a search result.
	 */
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/layout/Seo.svelte';
	import Breadcrumbs from '#lib/components/layout/Breadcrumbs.svelte';
	import type { Density } from '#lib/conversion/types.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const title = $derived(data.phrase.charAt(0).toUpperCase() + data.phrase.slice(1));

	/** Other names, one per spelling: "off-road diesel" and "off road diesel" are one name. */
	function otherNames(names: string[], aliases: string[]): string[] {
		const all = [...names.slice(1), ...aliases];
		const key = (n: string) => n.toLowerCase().replace(/[-\s]+/g, '');
		return all.filter((n, i) => all.findIndex((m) => key(m) === key(n)) === i);
	}

	function densityDisplay(d: Density | undefined): string | null {
		if (!d) return null;
		const unit = { kg_per_l: 'kg/L', kg_per_m3: 'kg/m³', g_per_cm3: 'g/cm³' }[d.unit] ?? d.unit;
		return `${d.value} ${unit}`;
	}
</script>

<Seo
	title={`${title} — which one?`}
	description={`"${data.phrase}" ${data.reason} Pick the grade you mean for its density, heating values and emission factors.`}
/>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
	<Breadcrumbs items={[{ href: resolve('fuels'), path: '/fuels', label: 'Fuels' }]} />

	<header class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{title} — which one?</h1>
		<p class="mt-3 max-w-2xl text-[0.95rem] leading-relaxed" style="color:var(--text-muted)">
			“{data.phrase}” {data.reason} Each grade below has its own sourced figures; picking one for you
			could be wrong without saying so.
		</p>
	</header>

	<ul class="space-y-3">
		{#each data.candidates as f (f.id)}
			<li>
				<a
					href={resolve(`fuels/${f.id}`)}
					class="block rounded-[var(--radius-card)] border p-4 transition-colors hover:border-[var(--accent)]"
					style="border-color:var(--border);background:var(--surface)"
				>
					<span class="flex flex-wrap items-baseline justify-between gap-x-3">
						<span class="font-semibold" style="color:var(--accent)">{f.names[0]}</span>
						{#if densityDisplay(f.density)}
							<span class="uc-num text-xs" style="color:var(--text-muted)"
								>{densityDisplay(f.density)}</span
							>
						{/if}
					</span>
					{#if f.names.length > 1 || f.aliases.length > 0}
						<span class="mt-1 block text-sm" style="color:var(--text-faint)">
							Also: {otherNames(f.names, f.aliases).slice(0, 4).join(', ')}
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</div>
