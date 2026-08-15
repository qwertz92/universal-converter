<script lang="ts">
	/**
	 * The converter's main input (v0.3 UX). Three jobs beyond "hold text":
	 *
	 *  1. It completes the unit you are typing, so the catalog is discoverable
	 *     without leaving the field (ARIA 1.2 combobox pattern).
	 *  2. It states, on every keystroke, exactly what the engine understood —
	 *     value, unit, material, duration, target — or precisely what is still
	 *     missing. Nobody should have to guess whether the unit is required.
	 *  3. When only the unit is missing it offers one-click starter units.
	 *
	 * Layout stability is deliberate: the interpretation line reserves its space
	 * and clamps its text, and the suggestion list is absolutely positioned, so
	 * typing never moves the page. The full error, when there is one, is still
	 * rendered in the result area below.
	 */
	import { tick } from 'svelte';
	import type { Fuel, ParseResult, Unit } from '$lib/conversion/types';
	import {
		describeQuery,
		starterUnits,
		suggestCompletions,
		type Completion
	} from '$lib/ui/interpretation';

	let {
		value = $bindable(''),
		units,
		fuels,
		parse,
		onsubmit,
		oninput,
		id = 'uc-query'
	}: {
		value: string;
		units: Unit[];
		fuels: Fuel[];
		parse: (text: string) => ParseResult;
		onsubmit: () => void;
		/** Called after every edit so the caller can debounce a conversion. */
		oninput?: () => void;
		id?: string;
	} = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	/** -1 = nothing highlighted; Enter then submits instead of completing. */
	let active = $state(-1);

	const interpretation = $derived(describeQuery(value, parse, units));
	const completions = $derived(open ? suggestCompletions(value, units, fuels) : null);
	const items = $derived<Completion[]>(completions?.items ?? []);
	const showList = $derived(open && items.length > 0);
	const chips = $derived(interpretation.errorKind === 'no_unit' ? starterUnits(units) : []);

	const listboxId = $derived(`${id}-listbox`);

	/** Group the flat list for rendering while keeping flat indices for keys. */
	const grouped = $derived.by<{ group: string; entries: { item: Completion; index: number }[] }[]>(
		() => {
			const out: { group: string; entries: { item: Completion; index: number }[] }[] = [];
			items.forEach((item, index) => {
				let bucket = out.find((b) => b.group === item.group);
				if (!bucket) {
					bucket = { group: item.group, entries: [] };
					out.push(bucket);
				}
				bucket.entries.push({ item, index });
			});
			return out;
		}
	);

	function edited(): void {
		open = true;
		active = -1;
		oninput?.();
	}

	function accept(completion: Completion): void {
		value = completion.apply;
		open = false;
		active = -1;
		inputEl?.focus();
		oninput?.();
	}

	function appendUnit(unit: Unit): void {
		value = `${value.trim()} ${unit.symbols[0]}`;
		open = false;
		inputEl?.focus();
		oninput?.();
	}

	async function move(delta: number): Promise<void> {
		if (!open) {
			open = true;
			await tick();
		}
		const n = items.length;
		if (n === 0) return;
		active = active === -1 ? (delta > 0 ? 0 : n - 1) : (active + delta + n) % n;
		await tick();
		listEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({
			block: 'nearest'
		});
	}

	function onKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				move(-1);
				break;
			case 'Tab':
				// Tab completes the highlighted (or first) suggestion, and only
				// then moves on — the standard "accept what you see" behaviour.
				if (showList) {
					const pick = items[active] ?? items[0];
					if (pick) {
						e.preventDefault();
						accept(pick);
					}
				}
				break;
			case 'Enter':
				if (showList && active >= 0 && items[active]) {
					e.preventDefault();
					accept(items[active]);
				}
				break;
			case 'Escape':
				if (open) {
					e.preventDefault();
					open = false;
					active = -1;
				}
				break;
		}
	}

	function onFocusOut(e: FocusEvent): void {
		const next = e.relatedTarget as Node | null;
		if (next && rootEl?.contains(next)) return;
		open = false;
		active = -1;
	}

	/** "/" focuses the converter from anywhere on the page. */
	function onWindowKeydown(e: KeyboardEvent): void {
		if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
		const el = e.target as HTMLElement | null;
		const tag = el?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
		e.preventDefault();
		inputEl?.focus();
		inputEl?.select();
	}

	const statusColor = $derived(
		interpretation.status === 'ok'
			? 'var(--ok-fg, var(--accent))'
			: interpretation.status === 'unsupported'
				? 'var(--warn-fg)'
				: 'var(--text-muted)'
	);
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div bind:this={rootEl} onfocusout={onFocusOut}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			open = false;
			active = -1;
			onsubmit();
		}}
	>
		<div class="relative">
			<label for={id} class="sr-only">Value and unit to convert</label>
			<input
				{id}
				bind:this={inputEl}
				bind:value
				oninput={edited}
				onfocus={() => (open = true)}
				onkeydown={onKeydown}
				type="text"
				role="combobox"
				aria-expanded={showList}
				aria-controls={listboxId}
				aria-autocomplete="list"
				aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
				aria-describedby="{id}-interpretation"
				placeholder="1 kWh · 10 L diesel · 5 kW for 3 h · 1 kWh to MJ"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="go"
				class="uc-num w-full rounded-xl border py-4 pr-28 pl-4 text-base outline-none sm:text-lg"
				style="background:var(--surface);border-color:var(--border);color:var(--text)"
			/>
			<button
				type="submit"
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold"
				style="background:var(--accent);color:var(--accent-contrast)"
			>
				Convert
			</button>

			{#if showList}
				<ul
					bind:this={listEl}
					id={listboxId}
					role="listbox"
					aria-label="Matching units and materials"
					class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border py-1 shadow-lg"
					style="background:var(--surface);border-color:var(--border)"
				>
					{#each grouped as { group, entries } (group)}
						<li
							role="presentation"
							class="px-3 pt-2 pb-1 text-[0.68rem] font-semibold tracking-wide uppercase"
							style="color:var(--text-faint)"
						>
							{group}
						</li>
						{#each entries as { item, index } (item.kind + item.id)}
							<li
								id="{id}-opt-{index}"
								data-idx={index}
								role="option"
								aria-selected={index === active}
								class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
								style={index === active ? 'background:var(--surface-2)' : ''}
								onmouseenter={() => (active = index)}
								onmousedown={(e) => {
									e.preventDefault();
									accept(item);
								}}
							>
								<span style="color:var(--text)">{item.label}</span>
								<span class="uc-num shrink-0 text-xs" style="color:var(--text-faint)"
									>{item.hint}</span
								>
							</li>
						{/each}
					{/each}
				</ul>
			{/if}
		</div>
	</form>

	<!-- Live interpretation. Height is reserved and text is clamped so the page
	     never moves while typing; the full error also appears in the results. -->
	<div
		id="{id}-interpretation"
		aria-live="polite"
		class="mt-2 flex min-h-[2.6rem] flex-col justify-center gap-0.5 rounded-lg px-3 py-1.5 text-sm"
		style="background:var(--surface-2)"
	>
		<p class="line-clamp-2 leading-snug" style="color:{statusColor}">
			{#if interpretation.status === 'ok'}
				<span aria-hidden="true">✓</span>
			{:else if interpretation.status === 'unsupported'}
				<span aria-hidden="true">✗</span>
			{/if}
			<span class="uc-num">{interpretation.message}</span>
			{#if interpretation.unit}
				<span style="color:var(--text-faint)">· {interpretation.unit.dimension}</span>
			{/if}
		</p>
		{#if interpretation.hint}
			<p class="line-clamp-1 text-xs" style="color:var(--text-faint)">{interpretation.hint}</p>
		{/if}
	</div>

	{#if chips.length > 0}
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-medium" style="color:var(--text-muted)">Add a unit:</span>
			{#each chips as unit (unit.id)}
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
					style="border-color:var(--border);color:var(--text)"
					onclick={() => appendUnit(unit)}
					title={unit.names[0]}
				>
					{unit.symbols[0]}
				</button>
			{/each}
		</div>
	{/if}
</div>
