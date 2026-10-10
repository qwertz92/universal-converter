<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import Breadcrumbs from '$lib/components/layout/Breadcrumbs.svelte';
	import ResultSet from '$lib/components/results/ResultSet.svelte';
	import SourceRefs from '$lib/components/results/SourceRefs.svelte';
	import { engine, fuelById, unitById } from '$lib/ui/engine';
	import { basisLabel } from '$lib/fuels/heating-values';
	import { SCOPE_LABEL, POLLUTANT_LABEL } from '$lib/emissions/scopes';
	import type { Density, EmissionFactor, ConversionResultSet } from '$lib/conversion/types';
	import { loadDataBundle } from '$lib';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { fuel, learn } = $derived(data);

	/**
	 * `loadDataBundle()` re-parses and re-validates ~120 KB of JSON through Zod on
	 * every call, so it is held once here. `$lib/ui/engine` already memoizes the
	 * bundle for units and fuels (used below); it exposes no emission-factor
	 * getter, so this page keeps the one parse it needs for factors.
	 */
	let allFactors: EmissionFactor[] | undefined;
	const emissionFactors = (): EmissionFactor[] => (allFactors ??= loadDataBundle().emissionFactors);

	// Emission factors that apply to this fuel (resolved from the bundle).
	const factors = $derived.by<EmissionFactor[]>(() => {
		const ids = new Set(fuel.emission_factor_ids ?? []);
		return emissionFactors().filter((f) => ids.has(f.id) || f.fuel_id === fuel.id);
	});

	/**
	 * An emission factor's `unit` is a real unit id, so the catalog already holds
	 * a properly-cased symbol for it ("kgCO2e/L"). Splitting the id on
	 * underscores instead printed "kg co2e per l", which reads as sloppy on a
	 * page whose whole job is to look trustworthy about numbers.
	 */
	const unitLabel = (id: string) => unitById(id)?.symbols[0] ?? id.replace(/_/g, ' ');

	/**
	 * Close relatives (ADR 0005). Variants such as gas oil (red diesel) sit next
	 * to their parent with genuinely different numbers, so each is shown with the
	 * two figures that decide which one you actually want — density and headline
	 * emission factor — rather than a prose claim about how they differ.
	 */
	const related = $derived.by(() => {
		const ids = fuel.related_fuels ?? [];
		return ids
			.map((id) => fuelById(id))
			.filter((f) => f !== undefined)
			.map((f) => {
				const factor = emissionFactors().find((e) => e.fuel_id === f.id && e.pollutant === 'CO2e');
				return { fuel: f, density: f.density, factor };
			});
	});

	// A representative conversion: 1 m³ for gases, 1 kg for solids, 1 L for
	// liquids — and 1 kWh for a fuel with no phase and no density at all, which
	// is grid electricity. Falling through to litres there asked the engine for
	// "1 L electricity", a category error on the page for that very fuel.
	const sampleQuery = $derived.by(() => {
		const unit =
			fuel.phase === 'gas'
				? 'm³'
				: fuel.phase === 'solid'
					? 'kg'
					: fuel.density || fuel.phase === 'liquid'
						? 'L'
						: 'kWh';
		return `1 ${unit} ${fuel.names[0]}`;
	});

	const sample = $derived.by<ConversionResultSet | null>(() => {
		const out = engine().convertText(sampleQuery, { basis: 'lhv' });
		return 'error' in out ? null : out;
	});

	/**
	 * Every catalog density is kg/m³ today, but the unit is a data field: a
	 * kg_per_l entry printed under a hardcoded "kg/m³" would be wrong by 1000×.
	 * Both the headline density and the related-fuels table go through here.
	 */
	function densityDisplay(d: Density | undefined): string | null {
		if (!d) return null;
		const unit = { kg_per_l: 'kg/L', kg_per_m3: 'kg/m³', g_per_cm3: 'g/cm³' }[d.unit] ?? d.unit;
		return `${d.value} ${unit}${d.range ? ` (${d.range.low}–${d.range.high})` : ''}`;
	}

	// A Map, not an object: `hv.unit` is an arbitrary string from the data files,
	// so the lookup is partial and `get` returns the `undefined` the fallback needs.
	const hvUnitLabel = new Map<string, string>([
		['mj_per_kg', 'MJ/kg'],
		['kwh_per_kg', 'kWh/kg'],
		['mj_per_l', 'MJ/L'],
		['kwh_per_l', 'kWh/L'],
		['mj_per_m3', 'MJ/m³'],
		['kwh_per_m3', 'kWh/m³']
	]);

	const lhvValues = $derived((fuel.heating_values ?? []).filter((h) => h.basis === 'lhv'));
	const hhvValues = $derived((fuel.heating_values ?? []).filter((h) => h.basis === 'hhv'));

	/**
	 * When every heating-value row cites the same source set (all but hydrogen),
	 * the source is printed once under the card instead of once per row: six
	 * identical, truncated publisher names buried the figures. When the rows
	 * disagree, each row keeps its own source so no figure loses its provenance.
	 */
	const hvSourceKey = (refs: string[] | undefined) => [...(refs ?? [])].sort().join('|');
	const hvSharedRefs = $derived.by<string[] | null>(() => {
		const all = fuel.heating_values ?? [];
		if (all.length === 0) return null;
		const key = hvSourceKey(all[0].source_refs);
		return all.every((h) => hvSourceKey(h.source_refs) === key) ? (all[0].source_refs ?? []) : null;
	});

	/**
	 * Every source this page cites, in first-use order: the fuel's own refs plus
	 * those of its density, heating values and emission factors. The page-level
	 * "Sources" list used to show only `fuel.source_refs`, which omits e.g. the
	 * NIST WebBook that backs one hydrogen heating value.
	 */
	const allSourceRefs = $derived.by<string[]>(() => {
		const ids = [
			...(fuel.source_refs ?? []),
			...(fuel.density?.source_refs ?? []),
			...(fuel.heating_values ?? []).flatMap((h) => h.source_refs ?? []),
			...factors.map((f) => f.source_id)
		];
		return [...new Set(ids)];
	});
</script>

<Seo
	title={fuel.names[0]}
	description={`${fuel.names[0]} — density, heating values (LHV/HHV labeled), energy density and CO₂/CO₂e emission factors, with sources and warnings.`}
/>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<Breadcrumbs
		items={[{ href: resolve('/fuels'), path: '/fuels', label: 'Fuels' }, { label: fuel.category }]}
	/>

	<header class="mb-8">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{fuel.names[0]}</h1>
			{#if fuel.phase}
				<span
					class="rounded-md border px-2 py-1 text-xs font-medium"
					style="border-color:var(--border);color:var(--text-muted)"
				>
					{fuel.phase}
				</span>
			{/if}
			<span
				class="rounded-md border px-2 py-1 text-xs font-medium"
				style="border-color:var(--border);color:var(--text-muted)"
			>
				{fuel.category}
			</span>
		</div>
		{#if fuel.notes}
			<p class="mt-3 max-w-2xl text-[0.95rem] leading-relaxed" style="color:var(--text-muted)">
				{fuel.notes}
			</p>
		{/if}
		{#if fuel.typical_ranges}
			<p class="mt-1 text-sm" style="color:var(--text-faint)">
				Typical ranges: {fuel.typical_ranges}
			</p>
		{/if}
	</header>

	<!-- Fuel-level warnings -->
	{#if fuel.warnings && fuel.warnings.length > 0}
		<div
			class="mb-6 rounded-lg border px-4 py-3 text-sm"
			style="background:var(--warn-bg);border-color:var(--warn-bd);color:var(--warn-fg)"
		>
			<ul class="space-y-1.5">
				{#each fuel.warnings as w, i (i)}
					<li class="flex gap-2"><span aria-hidden="true">△</span><span>{w}</span></li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Close relatives (ADR 0005): easy to confuse, different numbers -->
	{#if related.length > 0}
		<section
			class="mb-6 rounded-[var(--radius-card)] border p-4 sm:p-5"
			style="border-color:var(--border);background:var(--surface)"
			aria-labelledby="related-heading"
		>
			<h2
				id="related-heading"
				class="mb-1 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text)"
			>
				Easily confused with
			</h2>
			<p class="mb-3 text-sm" style="color:var(--text-muted)">
				Different products with different numbers. Check you are on the right one.
			</p>
			<ul class="space-y-2">
				{#each related as r (r.fuel.id)}
					<li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
						<a
							href={resolve(`/fuels/${r.fuel.id}`)}
							class="font-medium underline underline-offset-2"
							style="color:var(--accent)">{r.fuel.names[0]}</a
						>
						{#if r.density}
							<span class="uc-num text-xs" style="color:var(--text-muted)">
								{densityDisplay(r.density)}
							</span>
						{/if}
						{#if r.factor}
							<span class="uc-num text-xs" style="color:var(--text-muted)">
								{r.factor.value}
								{unitLabel(r.factor.unit)}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Properties grid -->
	<div class="grid gap-4 sm:grid-cols-2">
		<!-- `[&_.truncate]:whitespace-normal` on these cards: SourceRefs ellipsises a long publisher
		     name; here the card is wide enough to show it whole by wrapping instead. -->
		<!-- Density -->
		<section
			class="min-w-0 rounded-[var(--radius-card)] border p-5 [&_.truncate]:whitespace-normal"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Density
			</h2>
			{#if densityDisplay(fuel.density)}
				<p class="uc-num text-lg font-semibold">{densityDisplay(fuel.density)}</p>
				{#if fuel.density?.reference_conditions}
					<p class="mt-1 text-xs" style="color:var(--text-faint)">
						at {fuel.density.reference_conditions}
					</p>
				{/if}
				<div class="mt-2"><SourceRefs refs={fuel.density?.source_refs} compact /></div>
			{:else}
				<p class="text-sm" style="color:var(--text-faint)">Not available.</p>
			{/if}
		</section>

		<!-- Heating values -->
		<section
			class="min-w-0 rounded-[var(--radius-card)] border p-5 [&_.truncate]:whitespace-normal"
			style="border-color:var(--border);background:var(--surface)"
		>
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Heating values
			</h2>
			{#if (fuel.heating_values ?? []).length === 0}
				<p class="text-sm" style="color:var(--text-faint)">Not available.</p>
			{:else}
				<div class="space-y-3">
					{#each [{ label: basisLabel('lhv'), items: lhvValues }, { label: basisLabel('hhv'), items: hhvValues }] as grp (grp.label)}
						{#if grp.items.length > 0}
							<div>
								<div class="mb-1 text-xs font-semibold" style="color:var(--text-faint)">
									{grp.label}
								</div>
								<ul class="space-y-1">
									{#each grp.items as hv, i (hv.unit + i)}
										<li class="text-sm">
											<span class="uc-num font-medium whitespace-nowrap"
												>{hv.value} {hvUnitLabel.get(hv.unit) ?? hv.unit}</span
											>
											{#if hvSharedRefs === null}
												<div class="mt-0.5"><SourceRefs refs={hv.source_refs} compact /></div>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/each}
					{#if hhvValues.length === 0}
						<p class="text-xs" style="color:var(--text-faint)">
							HHV/GCV not available — not derived from LHV.
						</p>
					{/if}
					{#if hvSharedRefs !== null}
						<div class="border-t pt-2 text-xs" style="border-color:var(--border)">
							<span style="color:var(--text-faint)">Source for all values above</span>
							<div class="mt-0.5"><SourceRefs refs={hvSharedRefs} compact /></div>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	</div>

	<!-- Emission factors -->
	<section
		class="mt-4 rounded-[var(--radius-card)] border p-5"
		style="border-color:var(--border);background:var(--surface)"
	>
		<h2 class="mb-3 text-sm font-semibold tracking-wide uppercase" style="color:var(--text-muted)">
			Emission factors
		</h2>
		{#if factors.length === 0}
			<p class="text-sm" style="color:var(--text-faint)">
				Not available. CO₂ and CO₂e factors are shown only when a cited source exists — never
				derived.
			</p>
		{:else}
			<!-- Below md the five columns need ~590px and the card gives ~300px, which
			     cut off the Source column behind a sideways scroll. A stacked list shows
			     the same five facts with nothing hidden. -->
			<ul class="md:hidden [&_.truncate]:whitespace-normal">
				{#each factors as f (f.id)}
					<li class="border-t py-3 first:border-t-0 first:pt-0" style="border-color:var(--border)">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
							<span class="text-sm font-medium">{POLLUTANT_LABEL[f.pollutant]}</span>
							<span class="uc-num text-sm whitespace-nowrap">{f.value} {unitLabel(f.unit)}</span>
						</div>
						<div class="mt-0.5 text-xs" style="color:var(--text-muted)">
							{SCOPE_LABEL[f.scope]} · {f.region ?? 'general'}{f.year ? ` · ${f.year}` : ''}
						</div>
						<div class="mt-1"><SourceRefs refs={[f.source_id]} compact /></div>
					</li>
				{/each}
			</ul>
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full text-sm">
					<thead>
						<tr style="color:var(--text-faint)">
							<th class="py-1.5 pr-3 text-left font-medium">Metric</th>
							<th class="py-1.5 pr-3 text-left font-medium">Value</th>
							<th class="py-1.5 pr-3 text-left font-medium">Scope</th>
							<th class="py-1.5 pr-3 text-left font-medium">Region / year</th>
							<th class="py-1.5 text-right font-medium">Source</th>
						</tr>
					</thead>
					<tbody>
						{#each factors as f (f.id)}
							<tr class="border-t" style="border-color:var(--border)">
								<td class="py-2 pr-3 font-medium">{POLLUTANT_LABEL[f.pollutant]}</td>
								<td class="uc-num py-2 pr-3">{f.value} {unitLabel(f.unit)}</td>
								<td class="py-2 pr-3" style="color:var(--text-muted)">{SCOPE_LABEL[f.scope]}</td>
								<td class="py-2 pr-3" style="color:var(--text-muted)">
									{f.region ?? 'general'}{f.year ? ` · ${f.year}` : ''}
								</td>
								<td class="py-2 text-right"><SourceRefs refs={[f.source_id]} compact /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-xs" style="color:var(--text-faint)">
				CO₂ ≠ CO₂e — separate metrics, never converted into one another.{#if factors.some((f) => f.pollutant === 'biogenic_CO2' || f.biogenic)}
					Biogenic CO₂ is listed on its own line: the carbon still leaves the stack, but it is
					accounted for separately from fossil CO₂ rather than added to it.{/if}
				<a
					href={resolve('/learn/co2-vs-co2e')}
					class="hover:text-[var(--accent)]"
					style="color:var(--text-muted)">What these metrics mean →</a
				>
			</p>
		{/if}
	</section>

	<!-- Live representative conversion -->
	{#if sample}
		<!-- Collapsed by default: the full result set repeats the density, heating
		     values and emission factors above in a third form and ran to ~2800px on
		     a phone. Opening it is the reader's choice, so nothing shifts on its own. -->
		<details
			class="group mt-8 rounded-[var(--radius-card)] border"
			style="border-color:var(--border);background:var(--surface)"
		>
			<summary
				class="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					class="shrink-0 transition-transform group-open:rotate-90"
					style="color:var(--text-faint)"
				>
					<path
						d="M9 6l6 6-6 6"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>Worked example: {sampleQuery} converted to every unit</span>
			</summary>
			<div class="px-4 pb-4">
				<div class="mb-3">
					<a
						href={resolve(`/convert?q=${encodeURIComponent(sampleQuery)}`)}
						class="inline-flex min-h-10 items-center text-sm font-medium hover:underline"
						style="color:var(--accent)"
					>
						Open in converter →
					</a>
				</div>
				<ResultSet resultSet={sample} />
			</div>
		</details>
	{/if}

	<!-- Sources + learn -->
	{#if allSourceRefs.length > 0}
		<section class="mt-8 [&_.truncate]:whitespace-normal">
			<h2
				class="mb-2 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Sources
			</h2>
			<SourceRefs refs={allSourceRefs} />
		</section>
	{/if}

	{#if learn.length > 0}
		<section class="mt-6">
			<h2
				class="mb-3 text-sm font-semibold tracking-wide uppercase"
				style="color:var(--text-muted)"
			>
				Learn more
			</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each learn as topic (topic.slug)}
					<a
						href={resolve(`/learn/${topic.slug}`)}
						class="rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--accent)]"
						style="border-color:var(--border);background:var(--surface)"
					>
						<span class="block text-sm font-medium" style="color:var(--text)">{topic.title}</span>
						<span class="block text-xs" style="color:var(--text-faint)">{topic.summary}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
