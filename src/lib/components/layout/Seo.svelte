<script lang="ts">
	/**
	 * Per-page SEO head: title, description, canonical, and OpenGraph tags
	 * (spec §10 / frontend brief). Canonical uses the production origin.
	 */
	import { page } from '$app/state';

	let {
		title,
		description,
		noindex = false
	}: { title: string; description: string; noindex?: boolean } = $props();

	const SITE = 'Universal Converter';
	const ORIGIN = 'https://universal-converter.org';
	const fullTitle = $derived(title === SITE ? title : `${title} · ${SITE}`);
	const canonical = $derived(ORIGIN + page.url.pathname);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
</svelte:head>
