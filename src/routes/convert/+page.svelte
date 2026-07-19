<script lang="ts">
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
		lede="Type a value and unit — or a fuel question like 1 liter diesel. Results are grouped by kind, each tagged with how exact it is and traceable to its source."
	/>

	<Converter />
</div>
