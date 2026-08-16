<script lang="ts">
	/** Render a list of source_refs as links into /sources anchors. */
	import { resolve } from '$app/paths';
	import { resolveSources } from '$lib/ui/engine';

	let { refs, compact = false }: { refs: string[] | undefined; compact?: boolean } = $props();
	const sources = $derived(resolveSources(refs));
</script>

{#if sources.length > 0}
	<!-- Publisher names are long ("UK Department for Energy Security and Net
	     Zero"). The label truncates to whatever width it actually gets, instead
	     of demanding a fixed 16rem that pushed narrow grid cells past the
	     viewport on a phone. -->
	<ul
		class="flex min-w-0 max-w-full flex-wrap gap-x-3 gap-y-1"
		class:text-xs={compact}
		class:text-sm={!compact}
	>
		{#each sources as s (s.id)}
			<li class="min-w-0 max-w-full">
				<a
					href={resolve(`/sources#${s.id}`)}
					class="inline-flex min-w-0 max-w-full items-center gap-1 hover:text-[var(--accent)]"
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
					<span class="truncate">{s.publisher ?? s.title}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
