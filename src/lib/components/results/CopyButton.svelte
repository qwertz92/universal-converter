<script lang="ts">
	/**
	 * Copy-to-clipboard button with a transient "copied" confirmation.
	 *
	 * `compact` is the labelled variant for toolbars. `iconOnly` is the one that
	 * ships inside result rows: a square button whose label is spoken, not shown,
	 * because a "Copy" word repeated on every row took room the value needed.
	 * Both stay comfortably tappable on a phone.
	 */
	import { copyText } from '$lib/ui/clipboard';

	let {
		text,
		label = 'Copy',
		copiedLabel = 'Copied',
		compact = false,
		iconOnly = false
	}: {
		text: string;
		label?: string;
		copiedLabel?: string;
		compact?: boolean;
		iconOnly?: boolean;
	} = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function doCopy() {
		const ok = await copyText(text);
		if (!ok) return;
		copied = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 1400);
	}
</script>

{#snippet copyIcon()}
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6" />
		<path
			d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
			stroke="currentColor"
			stroke-width="1.6"
		/>
	</svg>
{/snippet}

{#snippet checkIcon()}
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M5 13l4 4L19 7"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

{#if iconOnly}
	<!-- Fixed square: the icon swap cannot change its size. The confirmation is
	     announced by a live region NEXT to the button — a button's children are
	     presentational, so one inside it may never be read. -->
	<button
		type="button"
		onclick={doCopy}
		class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[var(--surface-2)] sm:h-8 sm:w-8"
		style="border-color:var(--border);color:{copied
			? 'var(--badge-exact-fg)'
			: 'var(--text-muted)'}"
		aria-label={label}
		title={copied ? copiedLabel : `${label} to clipboard`}
	>
		{#if copied}{@render checkIcon()}{:else}{@render copyIcon()}{/if}
	</button>
	<span class="sr-only" aria-live="polite">{copied ? copiedLabel : ''}</span>
{:else}
	<button
		type="button"
		onclick={doCopy}
		class="inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition-colors hover:bg-[var(--surface-2)]"
		class:px-2.5={!compact}
		class:py-1.5={!compact}
		class:px-2={compact}
		class:py-1={compact}
		style="border-color:var(--border);color:var(--text-muted)"
		aria-live="polite"
		title="{label} to clipboard"
	>
		<!--
			Both states are stacked in the same grid cell so the button is always as
			wide as the WIDER of "Copy"/"Copied" and never resizes on click. Swapping
			the label directly made this button shrink ~20px for 1400 ms, which slid
			the export toolbar sideways and — inside a result row's shrink-0 cluster —
			squeezed the value line opposite it into re-wrapping, changing the row's
			height and pushing every row below it down.
		-->
		<span class="grid place-items-center">
			<span
				class="col-start-1 row-start-1 inline-flex items-center gap-1.5"
				class:invisible={!copied}
				aria-hidden={!copied}
			>
				{@render checkIcon()}
				<span>{copiedLabel}</span>
			</span>
			<span
				class="col-start-1 row-start-1 inline-flex items-center gap-1.5"
				class:invisible={copied}
				aria-hidden={copied}
			>
				{@render copyIcon()}
				<span>{label}</span>
			</span>
		</span>
	</button>
{/if}
