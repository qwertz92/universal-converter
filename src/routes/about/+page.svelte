<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import pkg from '../../../package.json';
</script>

<Seo
	title="About"
	description="What the Universal Converter is, where it is in its life, and the honest scope of what it does and does not do."
/>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero eyebrow="About" title="About Universal Converter" />

	<div class="uc-prose">
		<p>
			Universal Converter is a transparent converter for units, energy, fuels and emissions. Its
			goal is modest but specific: convert values <em>and</em> show you how much to trust each result
			— whether it follows from a definition, rests on a cited source, or is only ever a representative
			estimate.
		</p>

		<h2>Why it exists</h2>
		<p>
			Most online converters give a single number with no context. But many real questions — how
			much energy is in a litre of diesel, how much CO₂ comes from a cubic metre of gas, what a
			barrel of oil is worth in kWh — do not have a single exact answer. They depend on material
			properties, sources, conventions and boundaries. This tool is built to surface those, not hide
			them.
		</p>

		<h2>Where it is now: v{pkg.version}</h2>
		<p>
			This is an early, honest version. It ships a solid exact-units engine, a growing fuel catalog,
			a basic emissions model, sourced provenance, and a set of explanatory Learn pages. Grid
			electricity is the clearest example of how it treats missing context: it ships region- and
			year-specific CO₂ or CO₂e factors for a small, cited set — currently the UK (2025) and the
			EU-27 (2023 and 2022) — and for any other region or year it refuses to invent a number,
			returning <em>context required</em> instead. A real gas-billing model and currency conversion are
			still out of scope; the tool asks for context rather than faking either.
		</p>

		<h2>What it is not</h2>
		<p>
			It is an explanatory reference aid — not a compliance calculator. Do not use it for billing
			disputes, statutory GHG reporting, trading settlement, or any calculation that is legally or
			financially binding without checking the primary sources it cites. Where it says <code>~</code
			>, it means the value is an estimate.
		</p>

		<h2>How to read a result</h2>
		<p>
			Each result carries an <a href={resolve('/methodology')}>exactness badge</a>, an expandable
			calculation path, its assumptions, any warnings, and links to its
			<a href={resolve('/sources')}>sources</a>. Follow those back to the original document for
			anything that matters. That traceability is the entire point.
		</p>
	</div>

	<div class="mt-8 flex flex-wrap gap-3">
		<a
			href={resolve('/convert')}
			class="rounded-lg px-4 py-2.5 text-sm font-semibold"
			style="background:var(--accent);color:var(--accent-contrast)"
		>
			Open the converter
		</a>
		<a
			href={resolve('/methodology')}
			class="rounded-lg border px-4 py-2.5 text-sm font-semibold"
			style="border-color:var(--border);color:var(--text)"
		>
			How it works
		</a>
	</div>
</div>
