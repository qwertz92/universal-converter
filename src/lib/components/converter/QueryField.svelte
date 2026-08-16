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
		id = 'uc-query',
		/** The query the engine will actually run (the pin may have completed it). */
		effective = undefined,
		/** Set when a pinned unit supplied something the text did not. */
		pinApplied = false,
		/** The currently pinned units, for the toggle's label. */
		pinnedFrom = undefined,
		pinnedTo = undefined,
		onpin = undefined
	}: {
		value: string;
		units: Unit[];
		fuels: Fuel[];
		parse: (text: string) => ParseResult;
		onsubmit: () => void;
		/** Called after every edit so the caller can debounce a conversion. */
		oninput?: () => void;
		id?: string;
		effective?: string;
		pinApplied?: boolean;
		pinnedFrom?: string;
		/** A pinned TARGET unit. Surfaced so a `?pin=>MJ` link can be seen and cleared. */
		pinnedTo?: string;
		/** Pin (or unpin, with undefined) the unit of the current query. */
		onpin?: (unitId: string | undefined) => void;
	} = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	/** -1 = nothing highlighted; Enter then submits instead of completing. */
	let active = $state(-1);

	// Describe what the engine will RUN, not only what was typed — with a pinned
	// unit those differ, and the line has to show the difference rather than
	// hide it.
	const interpretation = $derived(describeQuery(effective ?? value, parse, units));
	const pinnedUnit = $derived(units.find((u) => u.id === pinnedFrom));
	const pinnedTarget = $derived(units.find((u) => u.id === pinnedTo));
	/** Any pin at all — a target-only pin must be visible, or it cannot be removed. */
	const anyPin = $derived(pinnedUnit ?? pinnedTarget);
	/** The unit the current query could be pinned to. */
	const pinnable = $derived(
		interpretation.status === 'ok' && interpretation.unit ? interpretation.unit : undefined
	);
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
				// Tab accepts ONLY an option the user actually highlighted, and
				// never on Shift+Tab: `e.key` is "Tab" for both, so not checking
				// shiftKey turned "move focus backwards" into "rewrite my text".
				// Accepting items[0] when nothing was highlighted silently changed
				// "1 barrel" into "1 bbl" for anyone tabbing out of the field.
				if (showList) {
					if (!e.shiftKey && active >= 0 && items[active]) {
						e.preventDefault();
						accept(items[active]);
					} else {
						open = false;
						active = -1;
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
				aria-describedby="{id}-interpretation-text"
				placeholder="1 kWh · 10 L diesel · 5 kW for 3 h · 1000 kWh at 0.32 EUR/kWh"
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

	<!--
		Live interpretation. Two fixed rows: a statement of what was understood,
		and a second row that is EITHER the teaching hint OR the one-click unit
		chips. Both rows always occupy their space and their text is clamped, so
		the page cannot move while typing — the owner's hard no-layout-shift rule.
		The full text of an error also appears in the result area below, so
		clamping here loses nothing.
	-->
	<!-- Not a live region: it is the input's own `aria-describedby` target, so a
	     live role would announce it twice on focus and again on every edit — and
	     it now contains buttons, which do not belong in a live region. -->
	<div
		id="{id}-interpretation"
		class="mt-2 flex min-h-[5.5rem] flex-col justify-center gap-1 rounded-lg px-3 py-2 text-sm"
		style="background:var(--surface-2)"
	>
		<div class="flex items-start justify-between gap-2">
			<p
				id="{id}-interpretation-text"
				class="line-clamp-2 min-w-0 flex-1 leading-snug"
				style="color:{statusColor}"
			>
				{#if interpretation.status === 'ok'}
					<span aria-hidden="true">✓</span>
				{:else if interpretation.status === 'unsupported'}
					<span aria-hidden="true">✗</span>
				{/if}
				<span class="uc-num">{interpretation.message}</span>
				{#if interpretation.unit}
					<span style="color:var(--text-faint)">· {interpretation.unit.dimension}</span>
				{/if}
				{#if pinApplied}
					<!-- Never let a pinned unit look like something the tool assumed
					     on its own: say where it came from, in the same breath. -->
					<span style="color:var(--accent)">· from your pinned unit</span>
				{/if}
			</p>

			{#if onpin && (anyPin || pinnable)}
				<button
					type="button"
					class="shrink-0 rounded-full border px-2 py-1 text-xs font-medium whitespace-nowrap hover:bg-[var(--surface)]"
					style="border-color:var(--border);color:{anyPin ? 'var(--accent)' : 'var(--text-muted)'}"
					onclick={() => onpin(anyPin ? undefined : pinnable?.id)}
					title={anyPin
						? `Pinned: ${pinnedUnit ? `bare numbers use ${pinnedUnit.symbols[0]}` : ''}${
								pinnedUnit && pinnedTarget ? ', ' : ''
							}${pinnedTarget ? `answers convert to ${pinnedTarget.symbols[0]}` : ''}. Click to unpin.`
						: `Pin ${pinnable?.symbol} so a bare number is enough`}
				>
					{#if anyPin}
						📌 {pinnedUnit?.symbols[0] ?? ''}{pinnedTarget
							? `${pinnedUnit ? ' ' : ''}→ ${pinnedTarget.symbols[0]}`
							: ''}
					{:else}
						Pin {pinnable?.symbol}
					{/if}
				</button>
			{/if}
		</div>

		<!-- One row, never two: wrapping chips would change this box's height on a
		     narrow screen, which is the shift this whole layout exists to avoid.
		     Overflow scrolls instead. -->
		<div
			class="flex min-h-[1.75rem] flex-nowrap items-center gap-1.5 overflow-x-auto"
			style="scrollbar-width:none"
		>
			{#if chips.length > 0}
				<span class="shrink-0 text-xs font-medium" style="color:var(--text-muted)">Add a unit:</span
				>
				{#each chips as unit (unit.id)}
					<button
						type="button"
						class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
						style="border-color:var(--border);color:var(--text)"
						onclick={() => appendUnit(unit)}
						title="Add {unit.names[0]}"
					>
						{unit.symbols[0]}
					</button>
				{/each}
			{:else}
				<p class="line-clamp-1 text-xs" style="color:var(--text-faint)">
					{interpretation.hint ?? ''}
				</p>
			{/if}
		</div>
	</div>
</div>
