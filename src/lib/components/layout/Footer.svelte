<script lang="ts">
	/** Site footer: honest v0.1 positioning + section links. */
	import { resolve } from '$app/paths';
	const cols = [
		{
			title: 'Convert',
			links: [
				{ href: '/convert', label: 'Converter' },
				{ href: '/units', label: 'Unit index' },
				{ href: '/fuels', label: 'Fuel catalog' }
			]
		},
		{
			title: 'Understand',
			links: [
				{ href: '/learn', label: 'Learn' },
				{ href: '/methodology', label: 'Methodology' },
				{ href: '/sources', label: 'Sources' }
			]
		},
		{
			title: 'Project',
			links: [
				{ href: '/about', label: 'About' },
				{ href: '/methodology', label: 'Exactness levels' }
			]
		}
	] as const;
	const year = new Date().getFullYear();
</script>

<footer class="mt-20 border-t" style="border-color:var(--border)">
	<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
		<div class="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
			<div class="max-w-xs">
				<div class="mb-2 font-semibold tracking-tight">Universal Converter</div>
				<p class="text-sm leading-relaxed" style="color:var(--text-muted)">
					A transparent converter for units, energy, fuels and emissions. Every non-exact result is
					traceable to its source.
				</p>
			</div>
			{#each cols as col (col.title)}
				<div>
					<div
						class="mb-3 text-xs font-semibold tracking-wide uppercase"
						style="color:var(--text-faint)"
					>
						{col.title}
					</div>
					<ul class="space-y-2">
						{#each col.links as link (link.href + link.label)}
							<li>
								<a
									href={resolve(link.href)}
									class="text-sm transition-colors hover:text-[var(--accent)]"
									style="color:var(--text-muted)">{link.label}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		<div
			class="mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
			style="border-color:var(--border);color:var(--text-faint)"
		>
			<span
				>&copy; {year} Universal Converter · v0.1 — an explanatory reference tool, not a compliance calculator.</span
			>
			<span>Sources over invented numbers · exact vs. estimate kept distinct.</span>
		</div>
	</div>
</footer>
