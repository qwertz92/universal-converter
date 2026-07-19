<script lang="ts">
	/**
	 * Per-page SEO head: title, description, canonical, and OpenGraph tags
	 * (spec §10 / frontend brief). Canonical uses the production origin.
	 */
	import { page } from '$app/state';

	let {
		title,
		description,
		noindex = false,
		image
	}: { title: string; description: string; noindex?: boolean; image?: string } = $props();

	const SITE = 'Universal Converter';
	const ORIGIN = 'https://universal-converter.org';
	/** Default social-card image (see scripts/generate-og.mjs). Callers may
	 *  override per-page via `image` once page-specific cards exist. */
	const DEFAULT_OG_IMAGE = `${ORIGIN}/og.png`;
	const DEFAULT_OG_IMAGE_ALT =
		'Universal Converter — transparent conversions for units, energy, fuels and emissions';
	const fullTitle = $derived(title === SITE ? title : `${title} · ${SITE}`);
	const canonical = $derived(ORIGIN + page.url.pathname);
	const ogImage = $derived(image ?? DEFAULT_OG_IMAGE);
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
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={DEFAULT_OG_IMAGE_ALT} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>
