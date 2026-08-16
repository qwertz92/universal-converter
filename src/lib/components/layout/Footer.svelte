<script lang="ts">
	/** Site footer: honest versioned positioning, section links, OGL attribution
	 *  (docs/sources.md: DESNZ-derived figures require the standard OGL line). */
	import { resolve } from '$app/paths';
	import { APP_VERSION } from '$lib/version';
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
				// Deep-links the legend section rather than repeating the bare
				// /methodology link that already sits in the column to the left.
				{ href: '/methodology#exactness-levels', label: 'Exactness levels' }
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
				>&copy; {year} Universal Converter · v{APP_VERSION} — an explanatory reference tool, not a compliance
				calculator.</span
			>
			<span>Sources over invented numbers · exact vs. estimate kept distinct.</span>
		</div>
		<!-- No public issue tracker or contact address is published yet, so this
		     points at the thing a reader can actually do today: check the figure
		     against its own named source. -->
		<p class="mt-3 text-xs" style="color:var(--text-faint)">
			A number looks wrong? Every figure here is traceable — each result names the source it came
			from, and the full register with publishers, years and licences is on the
			<a
				href={resolve('/sources')}
				class="underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
				>sources page</a
			>. If it still looks wrong, the source is the place to start.
		</p>
		<p class="mt-3 text-xs leading-relaxed" style="color:var(--text-faint)">
			Contains public sector information licensed under the
			<a
				href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
				rel="license external"
				class="underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
				>Open Government Licence v3.0</a
			>
			(UK DESNZ 2025 GHG conversion factors) — see
			<a
				href={resolve('/sources')}
				class="underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
				>all sources &amp; licenses</a
			>.
		</p>
	</div>
</footer>
