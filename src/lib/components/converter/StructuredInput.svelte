<script lang="ts">
	/**
	 * Structured fallback input (spec §8.1): a value field + a searchable unit
	 * combobox + an optional searchable fuel combobox. Emits a composed free-text
	 * query the engine can parse (e.g. "1 L diesel"), so it shares the exact same
	 * pipeline as the free-text box.
	 */
	import type { Unit, Fuel } from '$lib/conversion/types';
	import Combobox, { type ComboOption } from '$lib/components/search/Combobox.svelte';
	import { DIMENSION_LABEL, DIMENSION_ORDER } from '$lib/ui/engine';
	import { searchUnits, searchFuels } from '$lib/ui/search';

	let {
		units,
		fuels,
		onsubmit
	}: {
		units: Unit[];
		fuels: Fuel[];
		onsubmit: (query: string) => void;
	} = $props();

	let value = $state('1');
	let unitId = $state<string | undefined>(undefined);
	let unitQuery = $state('');
	let fuelId = $state<string | undefined>(undefined);
	let fuelQuery = $state('');

	// Rank units by search query; group + order by dimension for the listbox.
	const unitOptions = $derived.by<ComboOption[]>(() => {
		const matched = searchUnits(units, unitQuery, 200);
		const byDim: Record<string, Unit[]> = {};
		for (const u of matched) {
			(byDim[u.dimension] ??= []).push(u);
		}
		const out: ComboOption[] = [];
		for (const dim of DIMENSION_ORDER) {
			for (const u of byDim[dim] ?? []) {
				out.push({
					id: u.id,
					label: u.names[0],
					hint: u.symbols[0],
					group: DIMENSION_LABEL[dim] ?? dim
				});
			}
		}
		return out;
	});

	const fuelOptions = $derived.by<ComboOption[]>(() =>
		searchFuels(fuels, fuelQuery, 200).map((f) => ({
			id: f.id,
			label: f.names[0],
			hint: undefined,
			group: f.category
		}))
	);

	const canSubmit = $derived(Boolean(value.trim()) && Boolean(unitId));

	function submit() {
		if (!canSubmit) return;
		const unit = units.find((u) => u.id === unitId);
		const fuel = fuels.find((f) => f.id === fuelId);
		if (!unit) return;
		// Compose a query the parser understands: "<value> <unit symbol> [<fuel name>]".
		const unitToken = unit.symbols[0] ?? unit.names[0];
		const parts = [value.trim(), unitToken];
		if (fuel) parts.push(fuel.names[0]);
		onsubmit(parts.join(' '));
	}
</script>

<form
	class="grid gap-3 sm:grid-cols-[7rem_1fr_1fr_auto]"
	onsubmit={(e) => {
		e.preventDefault();
		submit();
	}}
>
	<div>
		<label
			for="struct-value"
			class="mb-1 block text-xs font-medium"
			style="color:var(--text-muted)"
		>
			Value
		</label>
		<input
			id="struct-value"
			type="text"
			inputmode="decimal"
			bind:value
			class="uc-num w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
			style="background:var(--surface);border-color:var(--border);color:var(--text)"
		/>
	</div>

	<Combobox
		id="struct-unit"
		label="Unit"
		placeholder="Search units…"
		options={unitOptions}
		bind:value={unitId}
		bind:query={unitQuery}
	/>

	<Combobox
		id="struct-fuel"
		label="Fuel / material (optional)"
		placeholder={fuels.length ? 'Search fuels…' : 'No fuels loaded'}
		options={fuelOptions}
		bind:value={fuelId}
		bind:query={fuelQuery}
	/>

	<div class="flex items-end">
		<button
			type="submit"
			disabled={!canSubmit}
			class="h-[42px] w-full rounded-lg px-4 text-sm font-semibold transition-opacity sm:w-auto"
			style="background:var(--accent);color:var(--accent-contrast)"
			class:opacity-40={!canSubmit}
		>
			Convert
		</button>
	</div>
</form>
