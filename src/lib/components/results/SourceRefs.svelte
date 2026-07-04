<script lang="ts">
	/** Render a list of source_refs as links into /sources anchors. */
	import { resolve } from '$app/paths';
	import { resolveSources } from '$lib/ui/engine';

	let { refs, compact = false }: { refs: string[] | undefined; compact?: boolean } = $props();
	const sources = $derived(resolveSources(refs));
</script>

{#if sources.length > 0}
	<ul class="flex flex-wrap gap-x-3 gap-y-1" class:text-xs={compact} class:text-sm={!compact}>
		{#each sources as s (s.id)}
			<li>
				<a
					href={resolve(`/sources#${s.id}`)}
					class="inline-flex items-center gap-1 hover:text-[var(--accent)]"
					style="color:var(--text-muted)"
					title={s.title}
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<span class="max-w-[16rem] truncate">{s.publisher ?? s.title}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
