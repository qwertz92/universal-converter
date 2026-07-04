<script lang="ts">
	/**
	 * Global conversion options (spec §10, rulebook §C.1):
	 *  - Heating-value basis toggle (LHV/NCV default, HHV/GCV), with an info popover;
	 *  - a disabled region/year control marked "coming in 0.2" (spec roadmap).
	 */
	import { resolve } from '$app/paths';
	import type { HeatingBasis } from '$lib/conversion/types';
	import InfoPopover from './InfoPopover.svelte';

	let { basis = $bindable() }: { basis: HeatingBasis } = $props();

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

	<div class="flex items-center gap-2 opacity-60">
		<span class="text-sm font-medium" style="color:var(--text-muted)">Region &amp; year</span>
		<span
			class="rounded-full border px-2 py-0.5 text-[0.68rem] font-medium"
			style="border-color:var(--border);color:var(--text-faint)"
		>
			coming in 0.2
		</span>
	</div>
</div>
