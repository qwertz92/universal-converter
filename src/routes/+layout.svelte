<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { theme } from '$lib/ui/theme.svelte';

	let { children } = $props();

	// Sync the reactive theme store with the pre-paint bootstrap (app.html).
	onMount(() => theme.init());
</script>

<a
	href="#main"
	class="sr-only rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
	style="background:var(--surface);border:1px solid var(--border)"
>
	Skip to content
</a>

<div class="flex min-h-dvh flex-col">
	<Header />
	<!-- tabindex="-1" is what makes the skip link above actually skip: without it
	     <main> is not focusable, so several browsers scroll to it but leave focus
	     in the header — the next Tab walks back into the nav the user just asked
	     to jump over. -->
	<main id="main" tabindex="-1" class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>
