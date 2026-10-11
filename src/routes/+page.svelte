<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import Converter from '$lib/components/converter/Converter.svelte';
	import ExactnessBadge from '$lib/components/badges/ExactnessBadge.svelte';

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

<svelte:head>
	<!-- This page is prerendered with the worked example (10 L diesel) and its
	     results. A shared ?q= link would show that example until the app has
	     started and drawn the shared one — the wrong answer, for a moment. This
	     runs before the first paint and hides the converter for links with a
	     query; Converter.svelte reveals it once the shared result is drawn. -->
	<script>
		(function () {
			try {
				var q = new URLSearchParams(location.search).get('q');
				if (q && q.trim()) document.documentElement.dataset.ucShared = '';
			} catch (e) {
				/* no query string to read: nothing to hide */
			}
		})();
	</script>
</svelte:head>

<!-- The converter IS the page: a short title, then the tool, already showing a
     worked example. The explanation of what makes it different follows below,
     for anyone who scrolls. -->
<section class="border-b" style="border-color:var(--border);background:var(--bg-subtle)">
	<div class="mx-auto max-w-5xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
			Convert units, fuels and emissions
		</h1>
		<p class="mt-2 max-w-2xl text-sm sm:text-base" style="color:var(--text-muted)">
			Every figure says how exact it is and where it comes from — exact conversions and estimates
			are never mixed up.
		</p>

		<div
			class="uc-home-converter mt-5 rounded-[var(--radius-card)] border p-4 sm:p-6"
			style="border-color:var(--border);background:var(--bg)"
		>
			<Converter />
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

<style>
	/* visibility keeps the converter's box, so nothing below moves while it is
	   hidden. The animation is a failsafe: it shows the converter after 4s even
	   if the script that reveals it never runs. */
	:global(html[data-uc-shared]) .uc-home-converter {
		visibility: hidden;
		animation: uc-show 0s 4s forwards;
	}
	@keyframes uc-show {
		to {
			visibility: visible;
		}
	}
</style>
