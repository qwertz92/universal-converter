<script lang="ts">
	/**
	 * An embedded, read-only live conversion — used in Learn articles to show a
	 * real result computed by the engine (spec §11: embed a relevant live example).
	 * Renders the full ResultSet plus a link into the converter.
	 */
	import { resolve } from '$app/paths';
	import { engine } from '$lib/ui/engine';
	import type { ConversionResultSet } from '$lib/conversion/types';
	import ResultSet from './ResultSet.svelte';

	let { query }: { query: string } = $props();

	const result = $derived.by<ConversionResultSet | null>(() => {
		const out = engine().convertText(query, { basis: 'lhv' });
		return 'error' in out ? null : out;
	});
</script>

{#if result}
	<div
		class="my-6 rounded-[var(--radius-card)] border p-4 sm:p-5"
		style="border-color:var(--border);background:var(--surface-2)"
	>
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<span class="text-xs font-semibold tracking-wide uppercase" style="color:var(--accent)">
				Live example
			</span>
			<a
				href={resolve(`/convert?q=${encodeURIComponent(query)}`)}
				class="text-sm font-medium hover:underline"
				style="color:var(--accent)"
			>
				Open in converter →
			</a>
		</div>
		<ResultSet resultSet={result} />
	</div>
{/if}
