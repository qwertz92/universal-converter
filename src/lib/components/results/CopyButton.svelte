<script lang="ts">
	/**
	 * Copy-to-clipboard button with a transient "copied" confirmation.
	 *
	 * `compact` is the only variant that ships inside result rows, so even it
	 * stays comfortably tappable on a phone rather than shrinking to text height.
	 */
	import { copyText } from '$lib/ui/clipboard';

	let {
		text,
		label = 'Copy',
		copiedLabel = 'Copied',
		compact = false
	}: { text: string; label?: string; copiedLabel?: string; compact?: boolean } = $props();

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
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M5 13l4 4L19 7"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span>{copiedLabel}</span>
		</span>
		<span
			class="col-start-1 row-start-1 inline-flex items-center gap-1.5"
			class:invisible={copied}
			aria-hidden={copied}
		>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6" />
				<path
					d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
					stroke="currentColor"
					stroke-width="1.6"
				/>
			</svg>
			<span>{label}</span>
		</span>
	</span>
</button>
