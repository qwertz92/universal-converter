<script lang="ts">
	/** Manual dark/light toggle (spec §10). Persists via the theme store. */
	import { theme } from '$lib/ui/theme.svelte';
</script>

<button
	type="button"
	onclick={() => theme.toggle()}
	class="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-2)]"
	style="border-color:var(--border)"
	aria-label={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
	title={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
>
	{#if theme.isDark}
		<!-- sun -->
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6" />
			<path
				d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<!-- moon -->
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M20 14.5A8 8 0 0 1 9.5 4a0.5 0.5 0 0 0-.7-.6A9 9 0 1 0 20.6 15.2a0.5 0.5 0 0 0-.6-.7Z"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>
