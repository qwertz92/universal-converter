<script lang="ts">
	/**
	 * The guided converter (default mode): pick what you are converting, fill
	 * in two to four fields, and the answer follows as you type. The form only
	 * COMPOSES a query in the text grammar (`#lib/ui/guided.js`) — the engine, the
	 * guards and the shared URL are the same as the text mode's.
	 *
	 * Layout: the task buttons are a fixed grid and the blurb one clamped line,
	 * so nothing moves while typing. Switching tasks resizes the form to its
	 * fields — the reader's own click, so the results moving with it is
	 * expected; no space is held empty for a task that is not shown.
	 */
	import type { Dimension, Fuel, Unit } from '#lib/conversion/types.js';
	import { tick } from 'svelte';
	import { DIMENSION_LABEL, engine, gridPickerOptions } from '#lib/ui/engine.js';
	import { displayUnitLabel } from '#lib/formatting/units.js';
	import { nextRadioIndex } from '#lib/ui/radio-keys.js';
	import {
		CURRENCIES,
		GUIDED_TASKS,
		answerableTargets,
		defaultState,
		priceablePerUnits,
		targetDimensions,
		unitDimensions,
		type GuidedState,
		type GuidedTask
	} from '#lib/ui/guided.js';

	let {
		form = $bindable(),
		grid = $bindable(''),
		units,
		fuels,
		onchange,
		composed,
		held,
		onedittext
	}: {
		form: GuidedState;
		grid?: string;
		units: Unit[];
		fuels: Fuel[];
		/** Called after every edit; the parent re-runs the conversion. */
		onchange: () => void;
		/** The query the form currently stands for, if complete. */
		composed: string | undefined;
		/** A typed query no form could hold; switching back restores it. */
		held?: string;
		/** Switch to the text mode with the composed query (or the held one). */
		onedittext: () => void;
	} = $props();

	const uid = $props.id();
	const fid = (name: string) => `uc-guided-${name}-${uid}`;

	// A fuel category is free text in the data, so the lookup is a Map: an
	// unlisted category falls back to its own name instead of a blank group.
	const CATEGORY_LABEL = new Map([
		['oil', 'Oil products'],
		['gas', 'Gases'],
		['hydrogen', 'Hydrogen'],
		['coal', 'Coal'],
		['biomass', 'Wood & biomass'],
		['biofuel', 'Biofuels']
	]);

	function unitGroups(dims: Dimension[]): { label: string; units: Unit[] }[] {
		return dims
			.map((d) => ({ label: DIMENSION_LABEL[d], units: units.filter((u) => u.dimension === d) }))
			.filter((g) => g.units.length > 0);
	}

	const fuelGroups = $derived.by(() => {
		const groups: { label: string; fuels: Fuel[] }[] = [];
		for (const f of fuels) {
			if (f.category === 'electricity') continue;
			const label = CATEGORY_LABEL.get(f.category) ?? f.category;
			let g = groups.find((x) => x.label === label);
			if (!g) {
				g = { label, fuels: [] };
				groups.push(g);
			}
			g.fuels.push(f);
		}
		return groups;
	});

	const unit = $derived(units.find((u) => u.id === form.unitId));
	const unitOptions = $derived(unitGroups(unitDimensions(form.task)));
	const convert = (text: string) => engine().convertText(text);
	// Fuel form: only targets the engine produces a value for (10 kWh of diesel
	// has no litre figure), each asked for explicitly. The current target stays
	// listed so a shared link asking for one still shows it, and gets its honest
	// "no path" row.
	const answerable = $derived(
		form.task === 'fuel'
			? new Set(
					answerableTargets(
						form.unitId,
						form.fuelId,
						units.filter((u) => targetDimensions('fuel', unit).includes(u.dimension)),
						units,
						fuels,
						convert
					).map((u) => u.id)
				)
			: undefined
	);
	const targetOptions = $derived(
		unitGroups(targetDimensions(form.task, unit))
			.map((g) => ({
				...g,
				units: g.units.filter(
					(u) =>
						u.id !== form.unitId && (!answerable || answerable.has(u.id) || u.id === form.targetId)
				)
			}))
			.filter((g) => g.units.length > 0)
	);
	const timeUnits = $derived(units.filter((u) => u.dimension === 'time'));
	// Cost form: only per-units a price can be applied to for this amount and
	// fuel (a price per ft³ of an amount in kWh has no path).
	const perUnitOptions = $derived.by(() => {
		if (form.task !== 'cost') return [];
		const candidates = units.filter((u) => ['energy', 'volume', 'mass'].includes(u.dimension));
		const ok = new Set(
			priceablePerUnits(
				form.unitId,
				form.fuelId,
				form.currency,
				candidates,
				units,
				fuels,
				convert
			).map((u) => u.id)
		);
		return unitGroups(['energy', 'volume', 'mass'])
			.map((g) => ({
				...g,
				units: g.units.filter((u) => ok.has(u.id) || u.id === form.perUnitId)
			}))
			.filter((g) => g.units.length > 0);
	});
	const gridOptions = gridPickerOptions();
	const blurb = $derived(GUIDED_TASKS.find((t) => t.id === form.task)?.blurb ?? '');

	function pickTask(task: GuidedTask): void {
		if (task === form.task) return;
		form = defaultState(task);
		onchange();
	}

	/** Arrow keys move the selection, as in any radio group; focus follows it. */
	function onTaskKeydown(event: KeyboardEvent, index: number): void {
		const next = nextRadioIndex(event.key, index, GUIDED_TASKS.length);
		if (next === undefined) return;
		event.preventDefault();
		pickTask(GUIDED_TASKS[next].id);
		void tick().then(() => document.getElementById(fid(`task-${GUIDED_TASKS[next].id}`))?.focus());
	}

	/** A changed FROM unit can make the chosen target meaningless (kWh → kg). */
	function unitChanged(): void {
		const next = units.find((u) => u.id === form.unitId);
		const target = units.find((u) => u.id === form.targetId);
		// Also when the target IS the new unit: the target list leaves the
		// input unit out, so the select would show blank while still sending it.
		if (
			target &&
			next &&
			(target.id === next.id || !targetDimensions(form.task, next).includes(target.dimension))
		) {
			form.targetId = '';
		}
		dropUnanswerableTarget();
		onchange();
	}

	function fuelChanged(): void {
		dropUnanswerableTarget();
		onchange();
	}

	/**
	 * The reader's own unit or fuel change can leave the fuel form's target
	 * without an answer (10 L diesel to mL, then the unit set to kWh). It falls
	 * back to "Everything", which still holds every figure the old target could
	 * have shown. A target that arrived in a shared link is left alone — only
	 * these handlers clear it. The cost form's "Per" is deliberately kept: a
	 * price of 0.30 EUR/kWh silently turned into 0.30 EUR/L would answer a
	 * different question, while the kept one gets a row saying to name a fuel.
	 */
	function dropUnanswerableTarget(): void {
		if (form.task === 'fuel' && form.targetId && answerable && !answerable.has(form.targetId)) {
			form.targetId = '';
		}
	}

	const fieldClass = 'h-[42px] w-full min-w-0 rounded-lg border px-3 text-sm outline-none uc-num';
	const fieldStyle = 'background:var(--surface);border-color:var(--border-input);color:var(--text)';
	const labelClass = 'mb-1 block text-xs font-medium';
</script>

{#snippet amountField(id: string, label: string, bindTo: 'amount' | 'durationAmount' | 'price')}
	<div class="min-w-0">
		<label for={id} class={labelClass} style="color:var(--text-muted)">{label}</label>
		<input
			{id}
			type="text"
			inputmode="decimal"
			autocomplete="off"
			bind:value={form[bindTo]}
			oninput={onchange}
			class={fieldClass}
			style={fieldStyle}
		/>
	</div>
{/snippet}

{#snippet unitSelect(
	id: string,
	label: string,
	groups: { label: string; units: Unit[] }[],
	bindTo: 'unitId' | 'targetId' | 'durationUnitId' | 'perUnitId',
	emptyLabel?: string
)}
	<div class="min-w-0">
		<label for={id} class={labelClass} style="color:var(--text-muted)">{label}</label>
		<select
			{id}
			bind:value={form[bindTo]}
			onchange={bindTo === 'unitId' ? unitChanged : onchange}
			class={fieldClass}
			style={fieldStyle}
		>
			{#if emptyLabel}<option value="">{emptyLabel}</option>{/if}
			{#each groups as g (g.label)}
				<optgroup label={g.label}>
					{#each g.units as u (u.id)}
						<option value={u.id}
							>{displayUnitLabel(u.symbols[0])} — {displayUnitLabel(u.names[0])}</option
						>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
{/snippet}

{#snippet fuelSelect(id: string, label: string, emptyLabel?: string)}
	<div class="min-w-0">
		<label for={id} class={labelClass} style="color:var(--text-muted)">{label}</label>
		<select
			{id}
			bind:value={form.fuelId}
			onchange={fuelChanged}
			class={fieldClass}
			style={fieldStyle}
		>
			{#if emptyLabel}<option value="">{emptyLabel}</option>{/if}
			{#each fuelGroups as g (g.label)}
				<optgroup label={g.label}>
					{#each g.fuels as f (f.id)}
						<option value={f.id}>{f.names[0]}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
{/snippet}

<div class="space-y-3">
	<!-- What is being converted. One line: a sideways strip on a phone (with
	     room for the focus ring), a fixed five-column grid from sm. Selecting
	     changes colours only. -->
	<div
		role="radiogroup"
		aria-label="What do you want to convert?"
		class="-my-1 flex gap-1.5 overflow-x-auto py-1 sm:grid sm:grid-cols-5 sm:overflow-visible"
		style="scrollbar-width:none"
	>
		{#each GUIDED_TASKS as t, i (t.id)}
			<button
				type="button"
				role="radio"
				id={fid(`task-${t.id}`)}
				aria-checked={form.task === t.id}
				tabindex={form.task === t.id ? 0 : -1}
				onkeydown={(e) => onTaskKeydown(e, i)}
				class="min-h-10 shrink-0 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
				style={form.task === t.id
					? 'background:var(--accent);border-color:var(--accent);color:var(--accent-contrast)'
					: 'background:var(--surface);border-color:var(--border);color:var(--text-muted)'}
				onclick={() => pickTask(t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>
	<!-- One line either way: the task's blurb, or — after switching here from a
	     typed query no form can hold — the way back to it. -->
	{#if held}
		<p class="flex min-w-0 items-center gap-1 text-xs" style="color:var(--text-faint)">
			<span class="shrink-0">Your typed query has parts no form can hold.</span>
			<button
				type="button"
				class="min-w-0 truncate font-medium hover:underline"
				style="color:var(--accent)"
				title={held}
				onclick={onedittext}>← Back to “{held}”</button
			>
		</p>
	{:else}
		<p class="line-clamp-1 text-xs" style="color:var(--text-faint)">{blurb}</p>
	{/if}

	<!-- The fields take only the rows they need, so the "typed, that is" line
	     sits right under them. -->
	<div class="grid grid-cols-2 content-start gap-3 sm:grid-cols-4">
		{#if form.task === 'units'}
			{@render amountField(fid('amount'), 'Amount', 'amount')}
			{@render unitSelect(fid('unit'), 'From', unitOptions, 'unitId')}
			<div class="col-span-2">
				{@render unitSelect(
					fid('target'),
					'To',
					targetOptions,
					'targetId',
					'Every unit of this kind'
				)}
			</div>
		{:else if form.task === 'fuel'}
			{@render amountField(fid('amount'), 'Amount', 'amount')}
			{@render unitSelect(fid('unit'), 'Unit', unitOptions, 'unitId')}
			{@render fuelSelect(fid('fuel'), 'Fuel')}
			{@render unitSelect(fid('target'), 'Answer in', targetOptions, 'targetId', 'Everything')}
		{:else if form.task === 'electricity'}
			{@render amountField(fid('amount'), 'Amount', 'amount')}
			{@render unitSelect(fid('unit'), 'Unit', unitOptions, 'unitId')}
			<!-- Never preselected: there is no default grid (rulebook §C.6). -->
			<div class="col-span-2 min-w-0">
				<label for={fid('grid')} class={labelClass} style="color:var(--text-muted)"
					>Grid region &amp; year</label
				>
				<select id={fid('grid')} bind:value={grid} {onchange} class={fieldClass} style={fieldStyle}>
					<option value="">Choose one — needed for CO₂</option>
					{#each gridOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		{:else if form.task === 'power'}
			{@render amountField(fid('amount'), 'Power', 'amount')}
			{@render unitSelect(fid('unit'), 'Unit', unitOptions, 'unitId')}
			{@render amountField(fid('duration'), 'Running for', 'durationAmount')}
			{@render unitSelect(
				fid('duration-unit'),
				'Time unit',
				[{ label: 'Time', units: timeUnits }],
				'durationUnitId'
			)}
		{:else}
			{@render amountField(fid('amount'), 'Amount', 'amount')}
			{@render unitSelect(fid('unit'), 'Unit', unitOptions, 'unitId')}
			{@render amountField(fid('price'), 'Your price', 'price')}
			<div class="min-w-0">
				<label for={fid('currency')} class={labelClass} style="color:var(--text-muted)"
					>Currency</label
				>
				<select
					id={fid('currency')}
					bind:value={form.currency}
					{onchange}
					class={fieldClass}
					style={fieldStyle}
				>
					{#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
				</select>
			</div>
			{@render unitSelect(fid('per'), 'Per', perUnitOptions, 'perUnitId')}
			{@render fuelSelect(fid('fuel'), 'Of (optional)', 'No fuel — energy only')}
		{/if}
	</div>

	<!-- Teaches the text grammar on the side: the same question, typed. One
	     line at every width — a long query is truncated, not wrapped, so the
	     line cannot grow and push the results down. -->
	<div class="flex min-h-9 flex-nowrap items-center gap-2 text-xs" style="color:var(--text-faint)">
		{#if composed}
			<span class="shrink-0">Typed, that is</span>
			<code
				class="min-w-0 truncate rounded px-1.5 py-0.5"
				style="background:var(--surface-2);color:var(--text)"
				title={composed}>{composed}</code
			>
			<button
				type="button"
				class="min-h-9 shrink-0 rounded px-1 font-medium whitespace-nowrap hover:underline"
				style="color:var(--accent)"
				onclick={onedittext}>Edit as text →</button
			>
		{:else}
			<span class="truncate"
				>Fill in an amount{form.task === 'cost' ? ' and your price' : ''} to see the result.</span
			>
		{/if}
	</div>
</div>
