<script lang="ts">
	/**
	 * Region/year picker for grid-electricity emissions (rulebook §C.6). Options
	 * are data-driven via `gridIntensityOptions()` — only combinations with a
	 * cited factor are offered, each labeled with its metric (CO2 vs CO2e stay
	 * visibly distinct, §D.6) and source. The empty choice is explicit: no
	 * default grid is ever assumed.
	 */
	import { gridIntensityOptions } from '$lib/ui/engine';

	let {
		value = $bindable(''),
		id = 'uc-grid'
	}: {
		/** '' = not set; else `${region}|${year}` of a cited factor. */
		value?: string;
		id?: string;
	} = $props();

	const options = gridIntensityOptions();

	function prettyUnit(unit: string): string {
		return unit.replace(/^g_(co2e?)_per_kwh$/, (_, p: string) =>
			p === 'co2e' ? 'gCO2e/kWh' : 'gCO2/kWh'
		);
	}
</script>

<div class="flex items-center gap-2">
	<label for={id} class="text-sm font-medium whitespace-nowrap" style="color:var(--text)">
		Grid region &amp; year
	</label>
	<select
		{id}
		bind:value
		class="rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none"
		style="border-color:var(--border);background:var(--surface);color:var(--text)"
	>
		<option value="">Not set — ask per query</option>
		{#each options as opt (opt.region + opt.year)}
			<option value={`${opt.region}|${opt.year}`}>
				{opt.region}
				{opt.year} — {opt.pollutant} ({opt.value}
				{prettyUnit(opt.unit)})
			</option>
		{/each}
	</select>
</div>
