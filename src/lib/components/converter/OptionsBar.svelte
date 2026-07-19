<script lang="ts">
	/**
	 * Global conversion options (spec §10, rulebook §C.1, §C.6):
	 *  - Heating-value basis toggle (LHV/NCV default, HHV/GCV), with an info popover;
	 *  - the grid region/year picker for electricity emissions (0.2 roadmap item 1).
	 */
	import { resolve } from '$app/paths';
	import type { HeatingBasis } from '$lib/conversion/types';
	import InfoPopover from './InfoPopover.svelte';
	import GridPicker from './GridPicker.svelte';

	let {
		basis = $bindable(),
		grid = $bindable('')
	}: { basis: HeatingBasis; grid?: string } = $props();

	const options: { id: HeatingBasis; label: string }[] = [
		{ id: 'lhv', label: 'LHV / NCV' },
		{ id: 'hhv', label: 'HHV / GCV' }
	];
</script>

<div
	class="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border px-4 py-3"
	style="border-color:var(--border);background:var(--surface)"
>
	<div class="flex items-center gap-2">
		<span class="text-sm font-medium" style="color:var(--text)">Heating value basis</span>
		<InfoPopover label="About heating value basis">
			<strong style="color:var(--text)">LHV/NCV</strong> (lower / net) excludes the heat of
			water-vapour condensation; <strong style="color:var(--text)">HHV/GCV</strong> (higher / gross)
			includes it. They differ by ~5–6% for gas and up to ~10–20% for hydrogen or wet biomass, so
			every fuel-energy result is labeled with its basis. Default is LHV/NCV.
			<a
				href={resolve('/learn/hhv-vs-lhv')}
				class="mt-1 block hover:text-[var(--accent)]"
				style="color:var(--accent)"
			>
				Learn: HHV vs LHV →
			</a>
		</InfoPopover>
	</div>

	<div
		class="inline-flex overflow-hidden rounded-lg border"
		style="border-color:var(--border)"
		role="radiogroup"
		aria-label="Heating value basis"
	>
		{#each options as opt (opt.id)}
			<button
				type="button"
				role="radio"
				aria-checked={basis === opt.id}
				class="px-3 py-1.5 text-sm font-medium transition-colors"
				style={basis === opt.id
					? 'background:var(--accent);color:var(--accent-contrast)'
					: 'background:var(--surface);color:var(--text-muted)'}
				onclick={() => (basis = opt.id)}
			>
				{opt.label}
			</button>
		{/each}
	</div>

	<div class="flex items-center gap-2">
		<GridPicker bind:value={grid} id="uc-grid-options" />
		<InfoPopover label="About grid region and year">
			Grid electricity CO2/CO2e depends on the country/region, the year and the generation mix —
			there is no single correct global factor. Only region/year combinations with a cited factor
			are offered; each is labeled CO2 or CO2e (they are different metrics).
			<a
				href={resolve('/learn/electricity-emissions-region-year')}
				class="mt-1 block hover:text-[var(--accent)]"
				style="color:var(--accent)"
			>
				Learn: why region and year matter →
			</a>
		</InfoPopover>
	</div>
</div>
