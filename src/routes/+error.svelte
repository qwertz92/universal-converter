<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');

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

	<div class="mt-6 flex flex-wrap justify-center gap-2">
		{#each links as link (link.href)}
			<a
				href={resolve(link.href)}
				class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)]"
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
