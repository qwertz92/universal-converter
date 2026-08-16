<script lang="ts">
	/**
	 * A calm, expandable warnings note (spec §10: visible but not intrusive).
	 * Renders at group or set level. Critical warnings are shown expanded.
	 */
	import type { Warning } from '$lib/conversion/types';

	let { warnings, title = 'Warnings' }: { warnings: Warning[]; title?: string } = $props();

	let open = $state(false);
	$effect(() => {
		// Read `warnings` itself (not a memoized boolean) so the dependency is on
		// the array the parent passes in: a brand-new result set that is ALSO
		// critical must still re-open a note the user had collapsed, even though
		// "has a critical warning" was already true before and after — a
		// `$derived` boolean wouldn't re-notify subscribers when its value is
		// unchanged, so the check has to run again directly off the array here.
		if (warnings.some((w) => w.severity === 'critical')) open = true;
	});
</script>

{#if warnings.length > 0}
	<div
		class="rounded-lg border px-3 py-2 text-sm"
		style="background:var(--warn-bg);border-color:var(--warn-bd);color:var(--warn-fg)"
	>
		<button
			type="button"
			class="flex w-full items-center gap-2 text-left font-medium"
			onclick={() => (open = !open)}
			aria-expanded={open}
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M12 9v4m0 3h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span>{title} ({warnings.length})</span>
			<svg
				class="ml-auto transition-transform"
				style={open ? 'transform:rotate(180deg)' : ''}
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
			</svg>
		</button>
		{#if open}
			<ul class="mt-2 space-y-1.5 pl-1">
				{#each warnings as w, i (w.kind + i)}
					<li class="flex gap-2">
						<span
							aria-hidden="true"
							class="mt-0.5 shrink-0 {w.severity === 'critical'
								? 'text-[#c00009] dark:text-red-400'
								: 'opacity-70'}"
						>
							{w.severity === 'critical' ? '‼' : w.severity === 'caution' ? '△' : 'ℹ'}
						</span>
						<span
							class="leading-snug {w.severity === 'critical'
								? 'text-[#c00009] dark:text-red-400'
								: ''}"
						>
							<!-- The glyph alone has no legend anywhere, so severity is also
							     spelled out for the two levels that change what you should do. -->
							{#if w.severity === 'critical'}<strong class="font-semibold">Critical:</strong>
							{:else if w.severity === 'caution'}<strong class="font-semibold">Caution:</strong>
							{/if}{w.text}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
