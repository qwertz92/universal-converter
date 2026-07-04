<script lang="ts">
	/**
	 * Quick-start example chips (spec §8.1). Loaded from data/examples.json via the
	 * engine loader; degrades gracefully to a small built-in set when the data file
	 * is empty (a spec requirement — the UI must handle sparse data).
	 */
	import { loadExamples } from '$lib';

	let { onpick }: { onpick: (input: string) => void } = $props();

	// Built-in fallback covers the spec §8.2 "must work" inputs.
	const FALLBACK = [
		'1 kWh',
		'1000 kcal',
		'1 MMBTU',
		'1 therm',
		'1 barrel',
		'1 toe',
		'1 L diesel',
		'1 m³ natural gas',
		'1 kg hydrogen'
	];

	const examples = $derived.by(() => {
		try {
			const loaded = loadExamples();
			if (loaded.length > 0)
				return loaded.map((e) => ({ input: e.input, label: e.label ?? e.input }));
		} catch {
			/* fall through to built-ins */
		}
		return FALLBACK.map((s) => ({ input: s, label: s }));
	});
</script>

<div class="flex flex-wrap items-center gap-2">
	<span class="text-xs font-medium" style="color:var(--text-faint)">Try:</span>
	{#each examples as ex (ex.input)}
		<button
			type="button"
			class="rounded-full border px-3 py-1 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
			style="border-color:var(--border);color:var(--text-muted)"
			onclick={() => onpick(ex.input)}
		>
			{ex.label}
		</button>
	{/each}
</div>
