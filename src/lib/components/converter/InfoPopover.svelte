<script lang="ts">
	/** A small accessible info popover triggered by an (i) button. */
	let {
		label = 'More information',
		children
	}: { label?: string; children: import('svelte').Snippet } = $props();

	let open = $state(false);
	let rootEl = $state<HTMLSpanElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	function onFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && rootEl?.contains(next)) return;
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			open = false;
			triggerEl?.focus();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<span class="relative inline-flex" bind:this={rootEl} onfocusout={onFocusOut}>
	<button
		type="button"
		bind:this={triggerEl}
		class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[0.7rem] font-semibold"
		style="border-color:var(--border);color:var(--text-faint)"
		aria-label={label}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		i
	</button>
	{#if open}
		<!-- Anchored to the RIGHT edge below `sm`: the trigger sits well past the
		     point where a 288px panel still fits, and an absolutely positioned box
		     past the viewport edge widens the document — the page starts scrolling
		     sideways on a phone. -->
		<div
			class="absolute top-6 right-0 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-lg border p-3 text-sm leading-snug shadow-lg sm:right-auto sm:left-0"
			style="background:var(--surface);border-color:var(--border);color:var(--text-muted)"
			role="tooltip"
		>
			{@render children()}
		</div>
	{/if}
</span>
