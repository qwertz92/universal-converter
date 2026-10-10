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
		lede="Type a value and a unit — the unit is never guessed. Add a material, a target, a duration, your price or your appliance's efficiency; questions in English or German work too."
	/>

	<!-- People who arrive here from a shared ?q= link never see the homepage's
	     legend teaser, so the way results are labelled is explained here too —
	     in one line, because on a phone everything above the field pushes the
	     results further down. The syntax examples the lede used to spell out
	     are the example chips under the field. -->
	<p class="-mt-4 mb-6 text-sm" style="color:var(--text-muted)">
		Every result is labeled with how exact it is.
		<a
			href={resolve('/methodology#exactness-levels')}
			class="font-medium hover:underline"
			style="color:var(--accent)">What the labels mean →</a
		>
	</p>

	<Converter />
</div>
