<script lang="ts">
	/**
	 * Region/year picker for grid-electricity emissions (rulebook §C.6). Options
	 * are data-driven via `gridPickerOptions()` — only combinations with a
	 * cited factor are offered, one per region/year, each metric labeled with
	 * its own figure (CO2 vs CO2e stay visibly distinct, §D.6). The empty
	 * choice is explicit: no default grid is ever assumed.
	 */
	import { gridPickerOptions } from '$lib/ui/engine';

	let {
		value = $bindable(''),
		id = 'uc-grid'
	}: {
		/** '' = not set; else `${region}|${year}` of a cited factor. */
		value?: string;
		id?: string;
	} = $props();

	const options = gridPickerOptions();
</script>

<!-- A <select> is as wide as its widest option by default and will not shrink,
     which pushed the whole page 100px past a 375px viewport. It wraps to its own
     line and is allowed to shrink instead. -->
<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
	<label for={id} class="text-sm font-medium whitespace-nowrap" style="color:var(--text)">
		Grid region &amp; year
	</label>
	<select
		{id}
		bind:value
		class="w-full min-w-0 max-w-full rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none sm:w-auto"
		style="border-color:var(--border);background:var(--surface);color:var(--text)"
	>
		<option value="">Not set — ask per query</option>
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>
