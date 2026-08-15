<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import ExactnessLegend from '$lib/components/badges/ExactnessLegend.svelte';
	import pkg from '../../../package.json';

	const layers = [
		{
			n: '1',
			title: 'Exact units engine',
			body: 'Dimension-internal conversions with no material context — joules, watt-hours, calories, BTU, mass, volume, time. These run on fixed, testable factors and are exact (or standard-definition where the unit itself is a convention).'
		},
		{
			n: '2',
			title: 'Context-dependent fuel engine',
			body: 'Conversions that only make sense with a material: litres of diesel to kilograms, m³ of gas to kWh, kg of hydrogen to energy. These need a density and/or heating value from data, carry assumptions, and are source-based or estimated.'
		},
		{
			n: '3',
			title: 'Sources, assumptions & emissions engine',
			body: 'Every non-exact result explains which source and year it used, on what basis (LHV/HHV), for which scope and region, and with what uncertainty. CO₂ and CO₂e stay separate; missing data is marked "not available".'
		}
	];
</script>

<Seo
	title="Methodology"
	description="How the Universal Converter works: three layers, an eight-level exactness taxonomy, an exactness-bounded precision policy, and explicit heating-value basis handling."
/>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		eyebrow="How it works"
		title="Methodology"
		lede="This is not a black box. Here is exactly how a value becomes a result, how we grade its exactness, and how we decide precision — so you can judge whether a figure is fit for your purpose."
	/>

	<!-- Three layers -->
	<section class="mb-10">
		<h2 class="mb-4 text-lg font-semibold tracking-tight">Three separate layers</h2>
		<div class="space-y-3">
			{#each layers as layer (layer.n)}
				<div
					class="flex gap-4 rounded-[var(--radius-card)] border p-5"
					style="border-color:var(--border);background:var(--surface)"
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
						style="background:var(--accent);color:var(--accent-contrast)"
					>
						{layer.n}
					</span>
					<div>
						<h3 class="font-semibold">{layer.title}</h3>
						<p class="mt-1 text-sm leading-relaxed" style="color:var(--text-muted)">{layer.body}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Exactness taxonomy -->
	<section id="exactness-levels" class="mb-10 scroll-mt-20">
		<h2 class="mb-2 text-lg font-semibold tracking-tight">Exactness levels</h2>
		<p class="mb-5 text-sm leading-relaxed" style="color:var(--text-muted)">
			Every result carries one of these labels. A result takes the <em>least exact</em> level of any input
			in its calculation path — exactness is a floor, set by the weakest link. These are the badges you
			see throughout the app.
		</p>
		<div
			class="rounded-[var(--radius-card)] border p-5"
			style="border-color:var(--border);background:var(--surface)"
		>
			<ExactnessLegend />
		</div>
	</section>

	<!-- Precision policy -->
	<section class="mb-10">
		<h2 class="mb-2 text-lg font-semibold tracking-tight">
			Precision &amp; the <code class="uc-prose">~</code> marker
		</h2>
		<div class="uc-prose">
			<p>
				Showing six significant figures for an estimate is itself an error — false precision. We
				compute internally at full precision and only round at display time, capped by exactness:
			</p>
			<table>
				<thead>
					<tr><th>Level</th><th>Max sig. figures</th><th>Marker</th></tr>
				</thead>
				<tbody>
					<tr
						><td>exact / standard definition</td><td>up to 6 (or the constant's own)</td><td
							>none</td
						></tr
					>
					<tr><td>source-based</td><td>3–4</td><td>none</td></tr>
					<tr><td>estimate</td><td>2–3</td><td><code>~</code></td></tr>
					<tr><td>region + year</td><td>2–3</td><td><code>~</code> + label</td></tr>
				</tbody>
			</table>
			<p>
				The leading <code>~</code> means "this is a representative value with genuine spread" — it
				appears only on estimates and region/year figures, never on exact identities. Where a
				property genuinely spans a range, we show <code>~A–B</code> rather than a false point value.
			</p>
		</div>
	</section>

	<!-- Basis handling -->
	<section class="mb-10">
		<h2 class="mb-2 text-lg font-semibold tracking-tight">Heating value basis (LHV vs HHV)</h2>
		<div class="uc-prose">
			<p>
				Fuel energy depends on whether you count the heat released when water vapour condenses. The
				<strong>default is LHV/NCV</strong> (lower / net) — the dominant convention in international
				energy statistics — and every fuel-energy result is <strong>labeled with its basis</strong>.
				Where the data has an HHV/GCV value too, we show it alongside; we never derive one basis
				from the other with a generic factor. <a href={resolve('/learn/hhv-vs-lhv')}>Read more →</a>
			</p>
		</div>
	</section>

	<!-- What it refuses -->
	<section class="mb-10">
		<h2 class="mb-2 text-lg font-semibold tracking-tight">What the tool refuses to do</h2>
		<div class="uc-prose">
			<ul>
				<li>Convert power to energy without a duration (kW is not kWh).</li>
				<li>Give a grid-electricity CO₂e figure without a region and year.</li>
				<li>Turn CO₂ into CO₂e, or derive a missing heating-value basis.</li>
				<li>Invent a number when the data is missing — it says <em>not available</em> instead.</li>
			</ul>
			<p>
				Refusing is a feature: a <em>context required</em> prompt means the question is answerable once
				you pin down one more thing, which is more useful than a confident wrong answer.
			</p>
		</div>
	</section>

	<div
		class="rounded-[var(--radius-card)] border p-5"
		style="border-color:var(--border);background:var(--surface-2)"
	>
		<p class="text-sm" style="color:var(--text-muted)">
			For the honest scope of what v{pkg.version} answers exactly, estimates, and refuses — and what you
			must not use it for — see the limitations summary, and follow every result's
			<a href={resolve('/sources')} class="font-medium hover:underline" style="color:var(--accent)"
				>sources</a
			> back to the primary document.
		</p>
	</div>
</div>
