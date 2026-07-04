<script lang="ts">
	/**
	 * A generic, accessible, keyboard-navigable combobox. Options are grouped by a
	 * caller-supplied `group` field and filtered/ranked by the caller (we just
	 * render). Implements the ARIA 1.2 combobox/listbox pattern: arrow keys,
	 * Enter/Escape, Home/End, and type-to-filter. Used for both the unit and fuel
	 * pickers in the structured input row (spec §8.1).
	 */
	import { tick } from 'svelte';

	export interface ComboOption {
		id: string;
		/** Primary label. */
		label: string;
		/** Secondary label (symbol / category), shown muted. */
		hint?: string;
		/** Grouping key (dimension / category). */
		group: string;
	}

	let {
		options,
		value = $bindable(),
		query = $bindable(''),
		placeholder = 'Search…',
		label,
		id,
		allowClear = true,
		onselect
	}: {
		options: ComboOption[];
		value: string | undefined;
		query: string;
		placeholder?: string;
		label: string;
		id: string;
		allowClear?: boolean;
		onselect?: (id: string | undefined) => void;
	} = $props();

	let open = $state(false);
	let active = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);

	// Flattened, ordered list matching what is rendered (for keyboard indexing).
	const flat = $derived(options);

	// Group options preserving order.
	const grouped = $derived.by<[string, ComboOption[]][]>(() => {
		const byGroup: Record<string, ComboOption[]> = {};
		const order: string[] = [];
		for (const o of options) {
			if (!byGroup[o.group]) {
				byGroup[o.group] = [];
				order.push(o.group);
			}
			byGroup[o.group].push(o);
		}
		return order.map((g) => [g, byGroup[g]]);
	});

	const selectedLabel = $derived(options.find((o) => o.id === value)?.label);

	function choose(opt: ComboOption | undefined) {
		value = opt?.id;
		query = opt?.label ?? '';
		open = false;
		onselect?.(value);
	}

	function clear() {
		value = undefined;
		query = '';
		open = false;
		onselect?.(undefined);
		inputEl?.focus();
	}

	async function moveActive(delta: number) {
		if (!open) {
			open = true;
			await tick();
		}
		const n = flat.length;
		if (n === 0) return;
		active = (active + delta + n) % n;
		await tick();
		const el = listEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	}

	function onKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				moveActive(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				moveActive(-1);
				break;
			case 'Home':
				if (open) {
					e.preventDefault();
					active = 0;
				}
				break;
			case 'End':
				if (open) {
					e.preventDefault();
					active = flat.length - 1;
				}
				break;
			case 'Enter':
				if (open && flat[active]) {
					e.preventDefault();
					choose(flat[active]);
				}
				break;
			case 'Escape':
				if (open) {
					e.preventDefault();
					open = false;
				}
				break;
		}
	}

	function onInput() {
		open = true;
		active = 0;
		// Typing invalidates a previously-committed selection until re-picked.
		if (value && query !== selectedLabel) {
			value = undefined;
			onselect?.(undefined);
		}
	}

	// Index lookup so grouped rendering can tag each row with its flat index.
	function idxOf(opt: ComboOption): number {
		return flat.indexOf(opt);
	}

	let rootEl = $state<HTMLDivElement | null>(null);
	function onFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && rootEl?.contains(next)) return;
		open = false;
	}

	const listboxId = $derived(`${id}-listbox`);
</script>

<div class="relative" bind:this={rootEl} onfocusout={onFocusOut}>
	<label for={id} class="mb-1 block text-xs font-medium" style="color:var(--text-muted)"
		>{label}</label
	>
	<div class="relative">
		<input
			{id}
			bind:this={inputEl}
			type="text"
			role="combobox"
			aria-expanded={open}
			aria-controls={listboxId}
			aria-autocomplete="list"
			aria-activedescendant={open && flat[active] ? `${id}-opt-${active}` : undefined}
			autocomplete="off"
			spellcheck="false"
			{placeholder}
			bind:value={query}
			oninput={onInput}
			onfocus={() => (open = true)}
			onkeydown={onKeydown}
			class="w-full rounded-lg border py-2.5 pr-9 pl-3 text-sm outline-none"
			style="background:var(--surface);border-color:var(--border);color:var(--text)"
		/>
		{#if allowClear && (value || query)}
			<button
				type="button"
				onclick={clear}
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 hover:bg-[var(--surface-2)]"
				style="color:var(--text-faint)"
				aria-label="Clear {label}"
				tabindex="-1"
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M6 6l12 12M18 6L6 18"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		{/if}
	</div>

	{#if open}
		<ul
			bind:this={listEl}
			id={listboxId}
			role="listbox"
			aria-label={label}
			class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border py-1 shadow-lg"
			style="background:var(--surface);border-color:var(--border)"
		>
			{#if flat.length === 0}
				<li class="px-3 py-2 text-sm" style="color:var(--text-faint)">No matches</li>
			{:else}
				{#each grouped as [group, opts] (group)}
					<li
						role="presentation"
						class="px-3 pt-2 pb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
						style="color:var(--text-faint)"
					>
						{group}
					</li>
					{#each opts as opt (opt.id)}
						{@const i = idxOf(opt)}
						<li
							id="{id}-opt-{i}"
							data-idx={i}
							role="option"
							aria-selected={value === opt.id}
							class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
							style={i === active ? 'background:var(--surface-2)' : ''}
							onmouseenter={() => (active = i)}
							onmousedown={(e) => {
								e.preventDefault();
								choose(opt);
							}}
						>
							<span style="color:var(--text)">{opt.label}</span>
							{#if opt.hint}
								<span class="uc-num shrink-0 text-xs" style="color:var(--text-faint)"
									>{opt.hint}</span
								>
							{/if}
						</li>
					{/each}
				{/each}
			{/if}
		</ul>
	{/if}
</div>
