<script lang="ts">
	/**
	 * The single exactness badge used everywhere (result rows, unit/fuel detail
	 * pages, the legend). Colours + glyph come from `EXACTNESS_META` so every
	 * surface renders a level identically (spec §10).
	 *
	 * By default the badge links to the legend. A `title` tooltip is invisible on
	 * touch devices, which is where most casual visitors are — so the meaning of
	 * "◆ source-based" has to be reachable by tapping it, not only by hovering.
	 * `interactive={false}` renders the plain span (used inside the legend
	 * itself, where linking back to the same section would be circular).
	 */
	import { resolve } from '$app/paths';
	import type { Exactness } from '$lib/conversion/types';
	import { EXACTNESS_META, badgeStyle } from '$lib/ui/exactness';

	let {
		exactness,
		size = 'sm',
		showGlyph = true,
		interactive = true
	}: {
		exactness: Exactness;
		size?: 'sm' | 'xs';
		showGlyph?: boolean;
		interactive?: boolean;
	} = $props();

	const meta = $derived(EXACTNESS_META[exactness]);
	// Hover/focus must not resize or move the badge (no border-width or padding
	// changes) — only the underline decoration changes.
	const shared = 'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap';
</script>

{#if interactive}
	<a
		href={resolve('/methodology#exactness-levels')}
		class="{shared} no-underline hover:underline focus-visible:underline"
		class:px-2={size === 'sm'}
		class:py-0.5={size === 'sm'}
		class:text-xs={size === 'sm'}
		class:px-1.5={size === 'xs'}
		class:text-[0.68rem]={size === 'xs'}
		style={badgeStyle(exactness)}
		title="{meta.description} (tap for the full legend)"
	>
		{#if showGlyph}<span aria-hidden="true" class="font-semibold">{meta.glyph}</span>{/if}
		<span>{meta.label}</span>
	</a>
{:else}
	<span
		class={shared}
		class:px-2={size === 'sm'}
		class:py-0.5={size === 'sm'}
		class:text-xs={size === 'sm'}
		class:px-1.5={size === 'xs'}
		class:text-[0.68rem]={size === 'xs'}
		style={badgeStyle(exactness)}
		title={meta.description}
	>
		{#if showGlyph}<span aria-hidden="true" class="font-semibold">{meta.glyph}</span>{/if}
		<span>{meta.label}</span>
	</span>
{/if}
