<script lang="ts">
	/**
	 * Renders a parser error as a helpful, non-alarming prompt (spec §8.2):
	 * unknown-unit suggestions, ambiguity choices, empty-input examples.
	 */
	import type { ParseError } from '$lib/conversion/types';

	let {
		error,
		onpick
	}: {
		error: ParseError;
		/**
		 * Called when the user clicks a repair. `replaces` is the exact token the
		 * choice is FOR — without it the caller cannot know which word to swap,
		 * and replacing the trailing word deleted the material or target the user
		 * had typed ("10 gallons diesel" → "10 gallons US gallon").
		 */
		onpick?: (text: string, replaces?: string) => void;
	} = $props();

	const examples = ['1 kWh', '1000 kcal', '1 MMBTU', '1 barrel'];
	const suggestions = $derived(
		error.kind === 'unknown_unit' || error.kind === 'unknown_fuel' ? (error.suggestions ?? []) : []
	);
</script>

<div
	class="rounded-[var(--radius-card)] border p-4 sm:p-5"
	style="border-color:var(--border);background:var(--surface)"
>
	<div class="flex items-start gap-3">
		<span
			class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
			style="background:var(--surface-2);color:var(--text-muted)"
			aria-hidden="true"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
				<path
					d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.5h.01"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</span>
		<div class="min-w-0 flex-1">
			<p class="font-medium" style="color:var(--text)">{error.message}</p>
			{#if error.hint}
				<p class="mt-1 text-sm leading-snug" style="color:var(--text-muted)">{error.hint}</p>
			{/if}

			{#if error.kind === 'ambiguous_unit' && error.interpretations?.length}
				<p class="mt-1 text-sm" style="color:var(--text-muted)">Choose one:</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each error.interpretations as interp (interp.unit_id)}
						<button
							type="button"
							class="rounded-full border px-3 py-1 text-sm hover:bg-[var(--surface-2)]"
							style="border-color:var(--border);color:var(--text)"
							onclick={() => onpick?.(interp.label, error.token)}
							title={interp.note}
						>
							{interp.label}
						</button>
					{/each}
				</div>
			{:else if suggestions.length}
				<!--
					"Did you mean" is typo-correction framing, and it is wrong for a
					split material: nobody mistyped "coal" or "heizöl", the word simply
					names several products. The message above already says "Pick the one
					you mean:", so repeating a guess-flavoured heading under it read as
					if the tool thought the input was a mistake.
				-->
				<p class="mt-1 text-sm" style="color:var(--text-muted)">
					{error.message.endsWith('Pick the one you mean:') ? 'The options:' : 'Did you mean:'}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each suggestions as sug (sug)}
						<button
							type="button"
							class="rounded-full border px-3 py-1 text-sm hover:bg-[var(--surface-2)]"
							style="border-color:var(--border);color:var(--text)"
							onclick={() => onpick?.(sug.replace(/_/g, ' '), error.token)}
						>
							{sug.replace(/_/g, ' ')}
						</button>
					{/each}
				</div>
			{:else}
				<div class="mt-2 flex flex-wrap gap-2">
					{#each examples as ex (ex)}
						<button
							type="button"
							class="rounded-full border px-3 py-1 text-sm hover:bg-[var(--surface-2)]"
							style="border-color:var(--border);color:var(--text-muted)"
							onclick={() => onpick?.(ex)}
						>
							{ex}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
