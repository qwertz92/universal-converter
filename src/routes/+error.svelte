<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');

	/**
	 * A 404 under /units/ or /fuels/ is nearly always a near-miss of a real slug
	 * ("kWh", "natural_gas", "Diesel"). The matching index page reads `?q=` as its
	 * search box, so the typed slug becomes the query — separators turned into
	 * spaces, because the index matches names and aliases, not ids.
	 */
	const nearMiss = $derived.by(() => {
		if (status !== 404) return null;
		const m = /^\/(units|fuels)\/([^/]+)\/?$/.exec(page.url.pathname);
		if (!m) return null;
		let slug = m[2];
		try {
			slug = decodeURIComponent(slug);
		} catch {
			// A malformed escape in the path: search for it as typed.
		}
		const kind = m[1] === 'units' ? 'unit' : 'fuel';
		const query = slug.replace(/[-_+\s]+/g, ' ').trim();
		return {
			kind,
			slug,
			href:
				m[1] === 'units'
					? resolve(`/units?q=${encodeURIComponent(query)}`)
					: resolve(`/fuels?q=${encodeURIComponent(query)}`)
		};
	});

	const links = [
		{ href: '/convert', label: 'Converter' },
		{ href: '/units', label: 'Unit index' },
		{ href: '/fuels', label: 'Fuel catalog' },
		{ href: '/learn', label: 'Learn' }
	] as const;
</script>

<svelte:head>
	<title>{status} · Universal Converter</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center"
>
	<div class="uc-num text-6xl font-bold tracking-tight" style="color:var(--accent)">{status}</div>
	<h1 class="mt-3 text-2xl font-bold tracking-tight">
		{status === 404 ? 'Page not found' : 'Something went wrong'}
	</h1>
	<p class="mt-2 max-w-md text-[0.95rem]" style="color:var(--text-muted)">
		{status === 404
			? 'That page does not exist — but the unit or fuel you were after is probably one click away.'
			: message}
	</p>

	{#if nearMiss}
		<a
			href={nearMiss.href}
			class="mt-5 inline-flex min-h-10 max-w-full items-center rounded-lg px-4 py-2 text-sm font-semibold break-words"
			style="background:var(--accent);color:var(--accent-contrast)"
		>
			Search the {nearMiss.kind} index for “{nearMiss.slug}” →
		</a>
	{/if}

	<div class="mt-6 flex flex-wrap justify-center gap-2">
		{#each links as link (link.href)}
			<a
				href={resolve(link.href)}
				class="inline-flex min-h-10 items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)]"
				style="border-color:var(--border);color:var(--text)"
			>
				{link.label}
			</a>
		{/each}
	</div>

	<a
		href={resolve('/')}
		class="mt-6 text-sm font-medium hover:underline"
		style="color:var(--accent)">← Back home</a
	>
</div>
