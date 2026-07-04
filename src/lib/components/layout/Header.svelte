<script lang="ts">
	/** Site header: brand, primary nav, theme toggle, responsive menu. */
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ThemeToggle from './ThemeToggle.svelte';

	const links = [
		{ href: '/convert', label: 'Convert' },
		{ href: '/units', label: 'Units' },
		{ href: '/fuels', label: 'Fuels' },
		{ href: '/learn', label: 'Learn' },
		{ href: '/methodology', label: 'Methodology' },
		{ href: '/sources', label: 'Sources' }
	] as const;

	let menuOpen = $state(false);

	function isActive(href: string): boolean {
		const p = page.url.pathname;
		return p === href || p.startsWith(href + '/');
	}
</script>

<header
	class="sticky top-0 z-40 border-b backdrop-blur"
	style="border-color:var(--border);background-color:color-mix(in srgb, var(--bg) 88%, transparent)"
>
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
		<a href={resolve('/')} class="group flex items-center gap-2.5 font-semibold tracking-tight">
			<span
				class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--accent-contrast)]"
				style="background:var(--accent)"
				aria-hidden="true"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
					<path
						d="M4 8h11l-3-3M20 16H9l3 3"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
			<span class="text-[0.98rem]">Universal Converter</span>
		</a>

		<nav class="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
			{#each links as link (link.href)}
				<a
					href={resolve(link.href)}
					class="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
					style={isActive(link.href) ? 'color:var(--accent)' : 'color:var(--text-muted)'}
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-2 md:ml-2">
			<ThemeToggle />
			<button
				type="button"
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg border md:hidden"
				style="border-color:var(--border)"
				aria-label="Toggle navigation menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					{#if menuOpen}
						<path
							d="M6 6l12 12M18 6L6 18"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					{:else}
						<path
							d="M4 7h16M4 12h16M4 17h16"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					{/if}
				</svg>
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav
			class="border-t px-4 pb-3 md:hidden"
			style="border-color:var(--border)"
			aria-label="Primary mobile"
		>
			{#each links as link (link.href)}
				<a
					href={resolve(link.href)}
					class="block rounded-lg px-3 py-2.5 text-sm font-medium"
					style={isActive(link.href)
						? 'color:var(--accent);background-color:var(--surface-2)'
						: 'color:var(--text-muted)'}
					aria-current={isActive(link.href) ? 'page' : undefined}
					onclick={() => (menuOpen = false)}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	{/if}
</header>
