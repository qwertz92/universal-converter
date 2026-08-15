<script lang="ts">
	/**
	 * Semantic breadcrumb trail + matching BreadcrumbList JSON-LD (SEO batch).
	 * Replaces the previously hand-rolled `<nav><a>/<span></nav>` markup on the
	 * unit/fuel/learn detail pages with one shared, accessible component —
	 * same visual style (small muted text, "/" separators), so there is no
	 * layout shift.
	 *
	 * Items without `href` render as the current page (plain text,
	 * `aria-current="page"`, no link).
	 *
	 * `href` is for DISPLAY and comes from `resolve()`, which under SvelteKit's
	 * default `paths.relative` renders as a page-relative path ("../units").
	 * The absolute URL in the structured data must therefore come from `path`
	 * (the literal route, "/units") — deriving it from the display href emitted
	 * "https://universal-converter.org../units" on every detail page.
	 */
	let { items }: { items: { href?: string; path?: string; label: string }[] } = $props();

	const ORIGIN = 'https://universal-converter.org';

	// BreadcrumbList JSON-LD (schema.org). The current-page item legitimately
	// has no `item` URL — per Google/schema.org's own documented example, the
	// last ListItem may omit it for that reason.
	const jsonLd = $derived.by(() => {
		const itemListElement = items.map((item, i) => {
			const entry: { '@type': string; position: number; name: string; item?: string } = {
				'@type': 'ListItem',
				position: i + 1,
				name: item.label
			};
			if (item.path) entry.item = `${ORIGIN}${item.path}`;
			return entry;
		});
		const json = JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement
		});
		// Defensive: guarantee no literal "</" can prematurely close the
		// surrounding JSON-LD script tag (labels are trusted in-repo content
		// today, but this keeps the embed safe regardless).
		return json.replace(/</g, '\\u003c');
	});

	// The tag is assembled from split fragments: writing the script open/close
	// tags out literally ANYWHERE in a .svelte file (strings and comments
	// included) ends the component's own script block early and breaks parsing.
	const LD_OPEN = '<scr' + 'ipt type="application/ld+json">';
	const LD_CLOSE = '</scr' + 'ipt>';
	const ldTag = $derived(LD_OPEN + jsonLd + LD_CLOSE);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built via JSON.stringify of trusted, non-user data -->
	{@html ldTag}
</svelte:head>

<nav aria-label="Breadcrumb" class="mb-6 text-sm" style="color:var(--text-faint)">
	<ol class="m-0 flex list-none flex-wrap items-center p-0">
		{#each items as item, i (item.label)}
			{#if i > 0}
				<li aria-hidden="true" class="mx-1.5">/</li>
			{/if}
			{#if item.href}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass hrefs already produced by resolve(); this component is a pure presenter over strings -->
				<li><a href={item.href} class="hover:text-[var(--accent)]">{item.label}</a></li>
			{:else}
				<li aria-current="page">{item.label}</li>
			{/if}
		{/each}
	</ol>
</nav>
