# Contributing

The most valuable contribution to this project is **telling us a number is
wrong**. Everything else is secondary.

## Reporting a wrong or suspicious figure

Open an issue with:

1. the exact query you ran (e.g. `1 L diesel`),
2. what the site showed,
3. what you believe it should be, and **which source says so**.

Every figure on the site names the source it came from, and the full register
with publishers, years and licences is on
[/sources](https://universal-converter.org/sources) and in
[`docs/sources.md`](docs/sources.md). A correction that cites a primary document
can be checked and shipped quickly; one that does not, cannot.

## The one rule that overrides everything

**No invented numbers.** Every non-exact value carries `source_refs` resolving
into `data/sources.json`. If a property is unknown, it is marked _not available_
and the conversion says what is missing — it is never estimated, averaged across
disagreeing sources, or filled in from memory. A pull request that adds a figure
without a citable source will not be merged, however plausible the figure is.

Alongside it:

- Exact and non-exact results stay distinguishable; nothing is displayed more
  precisely than its weakest input allows.
- CO₂ and CO₂e are different metrics with no conversion path between them.
- LHV/NCV and HHV/GCV are always labelled and never derived from one another.
- Power never becomes energy without an explicit duration.

These are not style preferences — they are the reason the tool exists. The
normative version, with the reasoning behind each, is
[`docs/conversion-rules.md`](docs/conversion-rules.md).

## Adding or correcting data

Data lives in `data/*.json` and is validated by Zod schemas plus referential
and domain checks (`src/lib/data/validate-data.ts`). For any value you add:

- give it a `source_refs` / `source_id` that resolves in `data/sources.json`,
- record the **original unit and basis** the source published, and note the
  conversion in `notes` if you rescaled it (no silent conversions),
- state the region and year where they matter,
- prefer omitting a property over guessing it.

`notes` fields are rendered verbatim on the public detail pages, so write them
for a reader, not as an internal comment.

## Working on the code

```bash
npm install
npm run dev
```

Gates, all of which must pass:

```bash
npm run lint     # Prettier + ESLint
npm run check    # wrangler types + svelte-check
npm test         # Vitest
npm run build    # Cloudflare adapter build
```

Conventions:

- The conversion engine (`src/lib/conversion`, `units`, `fuels`, `emissions`,
  `data`) stays framework-independent — no Svelte/SvelteKit imports there.
- Conventional Commits (`feat|fix|docs|test|refactor|chore(scope): summary`),
  imperative mood.
- Larger architectural decisions get an ADR in `docs/adr/`.
- Behaviour changes come with a test that would fail without them. Do not
  weaken an existing test to make a change pass.

## Licence

Code is MIT (see [`LICENSE`](LICENSE)). The reference data is not — it carries
the terms of the bodies that published it. Contributions are accepted under the
same terms.
