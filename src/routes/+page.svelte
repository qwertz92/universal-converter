<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import Converter from '$lib/components/converter/Converter.svelte';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';
	import pkg from '../../package.json';

	const features = [
		{
			href: '/methodology',
			title: 'Exact vs. source-based — always distinct',
			body: 'Every result is tagged: an SI identity, a standard definition, a sourced value, or an estimate. We never dress an estimate up as exact.',
			cta: 'How it works'
		},
		{
			href: '/fuels',
			title: 'Fuels & emissions, with the caveats',
			body: 'Density, heating values (LHV/HHV labeled), energy per litre/kg/m³, and CO₂ vs CO₂e kept separate — with the assumptions and warnings on display.',
			cta: 'Browse fuels'
		},
		{
			href: '/learn',
			title: 'Learn the concepts',
			body: 'kW vs kWh, HHV vs LHV, barrel vs boe, why m³ of gas is not exact, why grid emissions depend on region and year — short, sourced explanations.',
			cta: 'Start learning'
		}
	] as const;
</script>

<Seo
	title="Universal Converter"
	description="A transparent converter for units, energy, fuels and emissions. Convert values, understand assumptions, and trace every non-exact result back to its source."
/>

<!-- Hero -->
<section class="border-b" style="border-color:var(--border);background:var(--bg-subtle)">
	<div class="mx-auto max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
		<div
			class="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
			style="border-color:var(--border);background:var(--surface);color:var(--text-muted)"
		>
			<span class="h-2 w-2 rounded-full" style="background:var(--accent)"></span>
			v{pkg.version} — a sourced reference tool, not a black-box calculator
		</div>
		<h1 class="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
			A transparent converter for units, energy, fuels and emissions.
		</h1>
		<p class="mt-4 max-w-2xl text-base sm:text-lg" style="color:var(--text-muted)">
			Convert values, understand the assumptions, and trace every non-exact result back to its
			source. Exact conversions and estimates are always kept apart.
		</p>

		<!-- Embedded converter -->
		<div class="mt-8">
			<p class="mb-3 text-sm" style="color:var(--text-faint)">
				A value always needs a unit. Add a target to convert directly — e.g.
				<code>1 kWh to MJ</code>.
			</p>
			<Converter compact />
			<div class="mt-3 text-right">
				<a
					href={resolve('/convert')}
					class="text-sm font-medium hover:underline"
					style="color:var(--accent)"
				>
					Open the full converter →
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Exactness legend teaser -->
<section class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
	<div class="flex flex-wrap items-center gap-3">
		<span class="text-sm font-medium" style="color:var(--text-muted)">Every result is labeled:</span
		>
		<ExactnessBadge exactness="exact" />
		<ExactnessBadge exactness="standard_definition" />
		<ExactnessBadge exactness="source_based" />
		<ExactnessBadge exactness="estimated" />
		<ExactnessBadge exactness="region_year_specific" />
		<ExactnessBadge exactness="user_assumption" />
		<ExactnessBadge exactness="context_required" />
		<ExactnessBadge exactness="unsupported" />
		<a
			href={resolve('/methodology')}
			class="text-sm font-medium hover:underline"
			style="color:var(--accent)"
		>
			See the full legend →
		</a>
	</div>
</section>

<!-- Feature cards -->
<section class="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
	<div class="grid gap-4 md:grid-cols-3">
		{#each features as f (f.href)}
			<a
				href={resolve(f.href)}
				class="group flex flex-col rounded-[var(--radius-card)] border p-5 transition-colors hover:border-[var(--accent)]"
				style="border-color:var(--border);background:var(--surface)"
			>
				<h2 class="text-base font-semibold tracking-tight">{f.title}</h2>
				<p class="mt-2 flex-1 text-sm leading-relaxed" style="color:var(--text-muted)">{f.body}</p>
				<span class="mt-4 text-sm font-medium" style="color:var(--accent)">{f.cta} →</span>
			</a>
		{/each}
	</div>
</section>

<!-- Positioning strip -->
<section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
	<div
		class="rounded-[var(--radius-card)] border p-6 sm:p-8"
		style="border-color:var(--border);background:var(--surface-2)"
	>
		<h2 class="text-lg font-semibold tracking-tight">Why another converter?</h2>
		<div class="mt-4 grid gap-6 text-sm sm:grid-cols-3" style="color:var(--text-muted)">
			<p>
				<strong style="color:var(--text)">No invented numbers.</strong> Every non-exact factor cites
				a source. Missing data is marked <em>not available</em> — never guessed.
			</p>
			<p>
				<strong style="color:var(--text)">The pitfalls, surfaced.</strong> CO₂ ≠ CO₂e, LHV ≠ HHV, boe
				≠ a physical barrel, kW ≠ kWh — the tool refuses to blur them.
			</p>
			<p>
				<strong style="color:var(--text)">Context over false precision.</strong> When a question needs
				a region, a year, or a duration, we ask — instead of returning a confident wrong answer.
			</p>
		</div>
	</div>
</section>
