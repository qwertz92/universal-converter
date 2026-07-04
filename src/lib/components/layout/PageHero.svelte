<script lang="ts">
	/** Consistent page header used across content pages. */
	let {
		eyebrow,
		title,
		lede,
		children
	}: {
		eyebrow?: string;
		title: string;
		lede?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<header class="mb-8">
	{#if eyebrow}
		<div class="mb-2 text-xs font-semibold tracking-wide uppercase" style="color:var(--accent)">
			{eyebrow}
		</div>
	{/if}
	<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
	{#if lede}
		<p class="mt-2 max-w-2xl text-[0.95rem] leading-relaxed" style="color:var(--text-muted)">
			{lede}
		</p>
	{/if}
	{#if children}
		<div class="mt-4">{@render children()}</div>
	{/if}
</header>
