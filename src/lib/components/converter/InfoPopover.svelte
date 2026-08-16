<script lang="ts">
	/**
	 * A small accessible info popover triggered by an (i) button.
	 *
	 * Built as a DISCLOSURE (button + aria-expanded + aria-controls), not as a
	 * tooltip. `role="tooltip"` used to be on the panel and was a lie about what
	 * this is: a tooltip is non-interactive, describes its trigger, and appears on
	 * hover/focus — this panel is click-toggled, stays open, and contains a link
	 * you are meant to tab into. Screen readers announce a tooltip as the
	 * button's description, so its link was announced as part of the button's
	 * name and never as something reachable.
	 */
	let {
		label = 'More information',
		children
	}: { label?: string; children: import('svelte').Snippet } = $props();

	// Per-instance id: OptionsBar renders two of these side by side, and a
	// literal would have both buttons claiming to control the same panel.
	// Two lines because `$props.id()` may only initialise a declaration.
	const uid = $props.id();
	const panelId = `uc-info-${uid}`;

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
		aria-controls={panelId}
		onclick={() => (open = !open)}
	>
		i
	</button>
	{#if open}
		<!-- Anchored to the RIGHT edge below `sm`: the trigger sits well past the
		     point where a 288px panel still fits, and an absolutely positioned box
		     past the viewport edge widens the document — the page starts scrolling
		     sideways on a phone. -->
		<!-- No role: the panel is plain explanatory content, and the button's
		     aria-controls is what ties the two together while it is open. -->
		<div
			id={panelId}
			class="absolute top-6 right-0 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-lg border p-3 text-sm leading-snug shadow-lg sm:right-auto sm:left-0"
			style="background:var(--surface);border-color:var(--border);color:var(--text-muted)"
		>
			{@render children()}
		</div>
	{/if}
</span>
