<script lang="ts">
	import Seo from '$lib/components/layout/Seo.svelte';
	import Converter from '$lib/components/converter/Converter.svelte';
</script>

<Seo
	title="Convert"
	description="Convert units, energy, fuels and emissions. Every result shows its exactness, assumptions and sources — exact conversions and estimates are kept distinct."
/>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<header class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Converter</h1>
		<p class="mt-2 max-w-2xl text-[0.95rem]" style="color:var(--text-muted)">
			Type a value and unit — or a fuel question like <em>1 liter diesel</em>. Results are grouped
			by kind, each tagged with how exact it is and traceable to its source.
		</p>
	</header>

	<Converter />
</div>
