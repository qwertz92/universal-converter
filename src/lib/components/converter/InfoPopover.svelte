<script lang="ts">
	/** A small accessible info popover triggered by an (i) button. */
	let {
		label = 'More information',
		children
	}: { label?: string; children: import('svelte').Snippet } = $props();

	let open = $state(false);
	let rootEl = $state<HTMLSpanElement | null>(null);

	function onFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && rootEl?.contains(next)) return;
		open = false;
	}
</script>

<span class="relative inline-flex" bind:this={rootEl} onfocusout={onFocusOut}>
	<button
		type="button"
		class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[0.7rem] font-semibold"
		style="border-color:var(--border);color:var(--text-faint)"
		aria-label={label}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		i
	</button>
	{#if open}
		<div
			class="absolute top-6 left-0 z-30 w-72 rounded-lg border p-3 text-sm leading-snug shadow-lg"
			style="background:var(--surface);border-color:var(--border);color:var(--text-muted)"
			role="tooltip"
		>
			{@render children()}
		</div>
	{/if}
</span>
