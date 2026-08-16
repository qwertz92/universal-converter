<script lang="ts">
	/**
	 * Recent and saved conversions, always reachable.
	 *
	 * The recents used to live in the empty state, which meant they vanished the
	 * moment you had a result — exactly when you want to jump back to the last
	 * calculation. This sits below the results instead, and separates what the
	 * tool remembered for you (recent) from what you deliberately kept (saved).
	 *
	 * Everything here is browser-local. Nothing is sent anywhere.
	 */
	import type { SavedEntry } from '$lib/ui/history';

	let {
		recent,
		saved,
		current = '',
		onrun,
		onsave,
		onunsave,
		onclearRecent,
		onclearSaved
	}: {
		recent: string[];
		saved: SavedEntry[];
		/** The query in the box, so it can be offered for saving. */
		current?: string;
		onrun: (query: string) => void;
		onsave: (query: string) => void;
		onunsave: (query: string) => void;
		onclearRecent: () => void;
		onclearSaved: () => void;
	} = $props();

	const savedKeys = $derived(new Set(saved.map((e) => e.query.toLowerCase())));
	const isSaved = (q: string) => savedKeys.has(q.trim().toLowerCase());
	const hasAnything = $derived(recent.length > 0 || saved.length > 0);
</script>

{#if hasAnything}
	<section
		class="rounded-[var(--radius-card)] border p-4 sm:p-5"
		style="border-color:var(--border);background:var(--surface)"
		aria-label="Conversion history"
	>
		<header class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<h2 class="text-sm font-semibold tracking-wide uppercase" style="color:var(--text)">
				History
			</h2>
			<p class="text-xs" style="color:var(--text-faint)">
				Kept in this browser only — never sent anywhere.
			</p>
		</header>

		{#if saved.length > 0}
			<div class="mb-4">
				<div class="mb-1.5 flex items-center justify-between gap-3">
					<span class="text-xs font-semibold" style="color:var(--text-muted)">Saved</span>
					<button
						type="button"
						class="rounded px-1.5 py-1 text-xs font-medium hover:underline"
						style="color:var(--text-faint)"
						onclick={onclearSaved}
					>
						Clear saved
					</button>
				</div>
				<ul class="flex flex-wrap gap-1.5">
					{#each saved as entry (entry.query)}
						<li class="inline-flex max-w-full items-stretch">
							<button
								type="button"
								class="uc-num min-w-0 truncate rounded-l-full border py-1.5 pr-2 pl-2.5 text-xs font-medium hover:bg-[var(--surface-2)]"
								style="border-color:var(--border);color:var(--text)"
								onclick={() => onrun(entry.query)}
								title={entry.label ? `${entry.label} — ${entry.query}` : entry.query}
							>
								{entry.label ?? entry.query}
							</button>
							<button
								type="button"
								class="rounded-r-full border border-l-0 px-2.5 py-1.5 text-xs hover:bg-[var(--surface-2)]"
								style="border-color:var(--border);color:var(--text-faint)"
								onclick={() => onunsave(entry.query)}
								aria-label="Remove {entry.query} from saved"
								title="Remove from saved"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if recent.length > 0}
			<div>
				<div class="mb-1.5 flex items-center justify-between gap-3">
					<span class="text-xs font-semibold" style="color:var(--text-muted)">Recent</span>
					<button
						type="button"
						class="rounded px-1.5 py-1 text-xs font-medium hover:underline"
						style="color:var(--text-faint)"
						onclick={onclearRecent}
					>
						Clear recent
					</button>
				</div>
				<ul class="flex flex-wrap gap-1.5">
					{#each recent as query (query)}
						<li class="inline-flex max-w-full items-stretch">
							<button
								type="button"
								class="uc-num min-w-0 truncate rounded-l-full border py-1.5 pr-2 pl-2.5 text-xs font-medium hover:bg-[var(--surface-2)]"
								style="border-color:var(--border);color:var(--text)"
								onclick={() => onrun(query)}
							>
								{query}
							</button>
							<button
								type="button"
								class="rounded-r-full border border-l-0 px-2.5 py-1.5 text-xs hover:bg-[var(--surface-2)]"
								style="border-color:var(--border);color:{isSaved(query)
									? 'var(--accent)'
									: 'var(--text-faint)'}"
								onclick={() => (isSaved(query) ? onunsave(query) : onsave(query))}
								aria-label={isSaved(query) ? `Unsave ${query}` : `Save ${query}`}
								title={isSaved(query) ? 'Saved — click to remove' : 'Save this conversion'}
							>
								{isSaved(query) ? '★' : '☆'}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if current.trim() && !isSaved(current)}
			<button
				type="button"
				class="mt-3 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]"
				style="border-color:var(--border);color:var(--text)"
				onclick={() => onsave(current)}
			>
				☆ Save this conversion
			</button>
		{/if}
	</section>
{/if}
