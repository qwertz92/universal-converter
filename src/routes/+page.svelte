<script lang="ts">
	import { PROJECT_NAME } from '$lib';
</script>

<svelte:head>
	<title>{PROJECT_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center"
>
	<h1 class="text-4xl font-bold tracking-tight">{PROJECT_NAME}</h1>
	<p class="text-lg text-gray-600">
		A transparent converter for units, energy, fuels and emissions.
	</p>
</main>
