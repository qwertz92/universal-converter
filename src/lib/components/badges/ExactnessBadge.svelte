<script lang="ts">
	/**
	 * The single exactness badge used everywhere (result rows, unit/fuel detail
	 * pages, the legend). Colours + glyph come from `EXACTNESS_META` so every
	 * surface renders a level identically (spec §10).
	 */
	import type { Exactness } from '$lib/conversion/types';
	import { EXACTNESS_META, badgeStyle } from '$lib/ui/exactness';

	let {
		exactness,
		size = 'sm',
		showGlyph = true
	}: { exactness: Exactness; size?: 'sm' | 'xs'; showGlyph?: boolean } = $props();

	const meta = $derived(EXACTNESS_META[exactness]);
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap"
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
