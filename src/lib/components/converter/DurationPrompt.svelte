<script lang="ts">
	/**
	 * The control that answers a `context_required: time` prompt (rulebook §D.1).
	 *
	 * Before v0.3 the converter asked for a duration but offered nowhere to enter
	 * one, so `5 kW` was a dead end. Applying a duration writes it into the query
	 * text ("5 kW for 3 h") rather than into hidden state: it stays visible,
	 * editable and shareable, and the engine still never assumes it.
	 */
	import type { Unit } from '$lib/conversion/types';

	let {
		units,
		onapply
	}: {
		units: Unit[];
		/** Receives the duration clause to append, e.g. "for 3 h". */
		onapply: (clause: string) => void;
	} = $props();

	const timeUnits = $derived(units.filter((u) => u.dimension === 'time'));

	let amount = $state('1');
	let unitId = $state('hour');

	const presets = [
		{ label: '1 hour', clause: 'for 1 h' },
		{ label: '24 hours', clause: 'for 24 h' },
		{ label: '1 year', clause: 'for 1 yr' }
	];

	function apply() {
		const unit = timeUnits.find((u) => u.id === unitId) ?? timeUnits[0];
		const n = amount.trim();
		if (!unit || n === '') return;
		onapply(`for ${n} ${unit.symbols[0]}`);
	}
</script>

<div class="flex flex-wrap items-end gap-2">
	<div>
		<label
			for="uc-duration-amount"
			class="mb-1 block text-xs font-medium"
			style="color:var(--text-muted)"
		>
			For how long?
		</label>
		<div class="flex items-center gap-1.5">
			<input
				id="uc-duration-amount"
				type="text"
				inputmode="decimal"
				bind:value={amount}
				class="uc-num w-20 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			/>
			<label for="uc-duration-unit" class="sr-only">Time unit</label>
			<select
				id="uc-duration-unit"
				bind:value={unitId}
				class="rounded-lg border px-2 py-1.5 text-sm outline-none"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			>
				{#each timeUnits as u (u.id)}
					<option value={u.id}>{u.names[0]}</option>
				{/each}
			</select>
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 text-sm font-semibold"
				style="background:var(--accent);color:var(--accent-contrast)"
				onclick={apply}
			>
				Use
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-1.5 pb-1">
		{#each presets as p (p.clause)}
			<button
				type="button"
				class="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
				style="border-color:var(--border);color:var(--text-muted)"
				onclick={() => onapply(p.clause)}
			>
				{p.label}
			</button>
		{/each}
	</div>
</div>
