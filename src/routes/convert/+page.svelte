<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/layout/Seo.svelte';
	import PageHero from '$lib/components/layout/PageHero.svelte';
	import Converter from '$lib/components/converter/Converter.svelte';
</script>

<Seo
	title="Convert"
	description="Convert units, energy, fuels and emissions. Every result shows its exactness, assumptions and sources — exact conversions and estimates are kept distinct."
/>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<PageHero
		title="Converter"
		lede="Type a value and a unit — the unit is always required, never guessed. Add a material (1 L diesel), a target (1 kWh to MJ), a duration (5 kW for 3 h), your price (1000 kWh at 0.32 EUR/kWh) or your appliance's efficiency (100 kWh at 3.5 COP). Plain questions work too, in English or German: “how many kWh in 1 L diesel”, “wie viel kWh hat 1 Liter Diesel”. Results are grouped by kind, each tagged with how exact it is."
	/>

	<!-- People who arrive here from a shared ?q= link never see the homepage's
	     legend teaser, so the way results are labelled is explained here too. -->
	<p class="mb-6 text-sm" style="color:var(--text-muted)">
		Every result carries a label — exact, standard definition, source-based, estimate, or a prompt
		for the context it still needs.
		<a
			href={resolve('/methodology#exactness-levels')}
			class="font-medium hover:underline"
			style="color:var(--accent)">See what the labels mean →</a
		>
	</p>

	<Converter />
</div>
