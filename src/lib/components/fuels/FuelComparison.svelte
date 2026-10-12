<script lang="ts">
	/**
	 * "Compare fuels at a glance": a ranked bar list on /fuels. Every figure
	 * comes from `fuelCharts()` (src/lib/ui/fuel-chart.ts), i.e. from the engine;
	 * this component only lays it out.
	 *
	 * It is a real <ol> with the value as text in every row, so a screen reader
	 * gets the same ranking a sighted reader sees; the bars are decoration and
	 * hidden from the accessibility tree.
	 *
	 * Folded away until opened (<details>, closed in the prerendered HTML, so nothing
	 * moves on load). Measured on 2026-10-13: open, the chart is 1,845px tall at 375px
	 * (CO₂e metric: 23 rows of 50 to 71px plus the caption; the energy metric is about
	 * as tall, 1,892px at 320px), more than two phone screens, and it would push the fuel
	 * list, which is what the page is for, far below the fold. Closed it is a 58px line.
	 * The list is not cut to fit instead: the point is that coal, gas, oil and wood sit
	 * in one ranking, and a cut would drop exactly the fuels at the bottom (wood, biogas).
	 */
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import ExactnessBadge from '#lib/components/badges/ExactnessBadge.svelte';
	import { sharedExactness } from '#lib/ui/basis-sections.js';
	import { resolveSources } from '#lib/ui/engine.js';
	import { fuelCharts, FUEL_CHART_METRICS, type FuelChartMetric } from '#lib/ui/fuel-chart.js';
	import { nextRadioIndex } from '#lib/ui/radio-keys.js';

	const charts = fuelCharts();
	let metric = $state<FuelChartMetric>('co2e_per_kwh');

	const info = $derived(FUEL_CHART_METRICS.find((m) => m.id === metric) ?? FUEL_CHART_METRICS[0]);
	const chart = $derived(charts[metric]);
	// Said once above the list; a row keeps its own badge only where it differs.
	const shared = $derived(sharedExactness(chart.rows));
	const allShared = $derived(chart.rows.every((r) => r.exactness === shared));
	const hasBiogenic = $derived(chart.rows.some((r) => r.biogenic));
	const sources = $derived(resolveSources(chart.sources));
	// What the bars measure, said once. The emission-factor region and year come from
	// the catalog, so the sentence cannot name a place the figures are not from.
	const scopeText = $derived(
		metric === 'co2e_per_kwh'
			? `Grams of CO₂e released per kWh of fuel energy, net (LHV) basis. Direct combustion only, not lifecycle or well-to-wheel.${
					chart.factorLabels.length > 0
						? ` Emission factors: ${chart.factorLabels.join(', ')}.`
						: ''
				}`
			: 'Energy in one kilogram of fuel, net (LHV) basis.'
	);

	const radioId = (id: FuelChartMetric) => `uc-fuel-chart-${id}`;

	/** Arrow keys move the choice, as in any radio group; focus follows it. */
	function onKeydown(event: KeyboardEvent, index: number): void {
		const next = nextRadioIndex(event.key, index, FUEL_CHART_METRICS.length);
		if (next === undefined) return;
		event.preventDefault();
		metric = FUEL_CHART_METRICS[next].id;
		void tick().then(() => document.getElementById(radioId(metric))?.focus());
	}
</script>

<details
	class="uc-chart group rounded-lg border"
	style="border-color:var(--border);background:var(--surface)"
>
	<summary
		class="uc-chart-summary flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 [&::-webkit-details-marker]:hidden"
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			class="shrink-0 transition-transform group-open:rotate-90"
			style="color:var(--text-muted)"
		>
			<path
				d="M9 6l6 6-6 6"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		<span class="min-w-0">
			<span class="block text-sm font-semibold" style="color:var(--text)"
				>Compare fuels at a glance</span
			>
			<span class="block text-xs" style="color:var(--text-muted)"
				>CO₂e per kWh and energy per kg, ranked</span
			>
		</span>
	</summary>

	<div class="border-t px-3 pt-3 pb-4 sm:px-4" style="border-color:var(--border)">
		<div role="radiogroup" aria-label="Compare fuels by" class="grid grid-cols-2 gap-1.5">
			{#each FUEL_CHART_METRICS as m, i (m.id)}
				<button
					type="button"
					role="radio"
					id={radioId(m.id)}
					aria-checked={metric === m.id}
					tabindex={metric === m.id ? 0 : -1}
					onkeydown={(e) => onKeydown(e, i)}
					class="min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition-colors"
					style={metric === m.id
						? 'background:var(--accent);border-color:var(--accent);color:var(--accent-contrast)'
						: 'background:var(--surface);border-color:var(--border);color:var(--text-muted)'}
					onclick={() => (metric = m.id)}
				>
					{m.label}
				</button>
			{/each}
		</div>

		<p class="mt-3 text-xs leading-relaxed" style="color:var(--text-muted)">
			{scopeText} Calculated by the converter from the catalog’s sources:
			{#each sources as s, i (s.id)}<a
					href={resolve(`sources#${s.id}`)}
					class="underline underline-offset-2"
					style="color:var(--text)">{s.publisher ?? s.title}</a
				>{i < sources.length - 1 ? ', ' : '.'}{/each}
		</p>
		{#if shared}
			<p
				class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
				style="color:var(--text-muted)"
			>
				<span
					>{allShared
						? 'Exactness of every value:'
						: 'Exactness of most values (the others are marked):'}</span
				>
				<ExactnessBadge exactness={shared} size="xs" />
			</p>
		{/if}

		<p
			id="uc-fuel-chart-title"
			aria-live="polite"
			class="mt-4 text-sm font-semibold"
			style="color:var(--text)"
		>
			{info.title}
			<span class="font-normal" style="color:var(--text-muted)">· highest first</span>
		</p>
		<ol aria-labelledby="uc-fuel-chart-title" class="mt-1">
			{#each chart.rows as r (r.fuelId)}
				<!-- Phone: the name and value share the first line and the bar takes the full width
				     below; from 640px all three sit in one row. `order` moves the bar below the
				     value on a phone without changing the reading order of the DOM. -->
				<li
					class="uc-chart-row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t px-1 py-2 first:border-t-0 sm:min-h-11 sm:grid-cols-[13rem_minmax(0,1fr)_7rem]"
					style="border-color:var(--border)"
				>
					<span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<!-- The link's ::after covers the whole row, so the tap target is the row (≥44px)
						     and the badge, which must stay clickable, sits above it. -->
						<a
							href={resolve(`fuels/${r.fuelId}`)}
							class="uc-chart-link text-sm font-medium underline decoration-1 underline-offset-2"
							style="color:var(--text);text-decoration-color:var(--text-faint)">{r.name}</a
						>
						{#if r.exactness !== shared}
							<span class="relative z-10"><ExactnessBadge exactness={r.exactness} size="xs" /></span
							>
						{/if}
					</span>
					<span
						class="uc-chart-track order-3 col-span-2 block h-2.5 sm:order-none sm:col-span-1"
						aria-hidden="true"
					>
						<span class="uc-chart-bar block h-full" style="width:{(r.share * 100).toFixed(2)}%"
						></span>
					</span>
					<span
						class="uc-num order-2 text-right text-sm whitespace-nowrap sm:order-none"
						style="color:var(--text)"
						>{r.value}
						<span class="text-xs" style="color:var(--text-muted)">{info.unit}</span></span
					>
					{#if r.biogenic}
						<span
							class="order-4 col-span-2 text-xs sm:order-none sm:col-start-2"
							style="color:var(--text-muted)"
							>Not in the bar: <span class="uc-num">{r.biogenic.value} {info.unit}</span> biogenic CO₂</span
						>
					{/if}
				</li>
			{/each}
		</ol>

		{#if hasBiogenic}
			<p class="mt-2 text-xs leading-relaxed" style="color:var(--text-muted)">
				Wood and the biofuels show CO₂e from methane and nitrous oxide only. The CO₂ released when
				biomass burns is a separate figure in the catalog (biogenic CO₂); it is printed under the
				name and never added to the bar.
			</p>
		{/if}

		{#if chart.omitted.length > 0}
			<div class="mt-3 text-xs leading-relaxed" style="color:var(--text-muted)">
				<p class="font-medium">Not shown</p>
				<ul class="mt-0.5 space-y-1">
					{#each chart.omitted as o (o.reason)}
						<li>
							{#each o.fuels as f, j (f.fuelId)}<a
									href={resolve(`fuels/${f.fuelId}`)}
									class="underline underline-offset-2"
									style="color:var(--text)">{f.name}</a
								>{j < o.fuels.length - 1 ? ', ' : ''}{/each}
							— {o.reason}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</details>

<style>
	/* Hover only where a pointer can hover; a row never changes size or position. */
	@media (hover: hover) and (pointer: fine) {
		.uc-chart-row:hover {
			background: var(--surface-2);
		}
	}
	.uc-chart-link::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	/* The focus ring goes on the row-sized overlay, not the small text box. */
	.uc-chart-link:focus-visible {
		outline: none;
	}
	.uc-chart-link:focus-visible::after {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
		border-radius: 0.35rem;
	}
	.uc-chart-summary:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
	/* Marks: a thin track and a bar that is square at the baseline, rounded at the
	   data end. The fill is --accent on --surface-2: measured ≥3:1 in both themes. */
	.uc-chart-track {
		background: var(--surface-2);
		border-radius: 0.125rem 4px 4px 0.125rem;
	}
	.uc-chart-bar {
		background: var(--accent);
		min-width: 2px;
		border-radius: 0 4px 4px 0;
	}
</style>
