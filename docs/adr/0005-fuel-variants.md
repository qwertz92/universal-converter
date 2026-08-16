# ADR 0005 — Fuel variants are first-class fuels, linked to their relatives

- **Status:** accepted (v0.3.1)
- **Supersedes:** nothing
- **Context for:** `data/fuels.json`, `src/lib/data/schemas.ts`, `/fuels/[fuel]`

## Context

DESNZ publishes several fuels that this catalog collapsed into one entry. The
clearest case is diesel: the catalog ships **"Diesel (average biofuel blend)"**,
while DESNZ separately lists **"100% mineral diesel"** and **"Gas oil"** — the
UK term for off-road / red diesel. They are not the same substance:

| | density (kg/m³) | NCV (MJ/kg) | CO₂e (kg/L) |
|---|---|---|---|
| Diesel (average biofuel blend) | 832.361 | 42.839 | 2.57082 |
| Gas oil (red / off-road) | 853.971 | 42.569 | 2.75541 |

A 7% difference in CO₂e per litre is not a rounding detail — it is the
difference between a right and a wrong answer for anyone working with
agricultural or construction fuel.

Until now, `1 L red diesel` answered with road-diesel numbers and (since v0.3.0)
a note saying the word "red" was ignored. That is honest, but it is not an
answer. The figures have been recorded verbatim in `docs/research-notes.md`
since the v0.1 research pass; the blocker was never the data, it was the absence
of a decision about how to represent it.

## Options considered

1. **Variants nested inside a parent fuel** — `diesel.variants[]`, with a
   selector in the UI, a variant slot in the query grammar, and variant state in
   the URL.
2. **Multi-valued properties** — `density` becomes an array, each entry tagged
   with the variant it belongs to.
3. **Separate fuels, cross-linked** — each variant is an ordinary catalog entry
   with its own aliases, and related entries point at each other.

## Decision

**Option 3.** Each variant is a first-class fuel, plus a new optional
`related_fuels` field naming its close relatives.

Reasons, in order of weight:

- **It is what the data is.** DESNZ lists these as separate products with
  separate rows, and a user asking for "red diesel" is asking for a different
  fuel, not for a different source of the same fuel. Options 1 and 2 model them
  as facets of one thing, which they are not.
- **No new concept reaches the user.** Option 1 requires a variant picker, a
  variant term in the grammar, and a variant parameter in shareable URLs — three
  new things to learn, to test and to get wrong. Option 3 reuses the fuel
  concept the tool already has: `1 L gas oil` simply works.
- **Aliases already solve the naming problem.** "red diesel", "off-road diesel"
  and "35-second oil" are aliases of `gas-oil`, so the phrasing people actually
  use resolves without any UI at all.
- **Option 2 breaks the value ↔ provenance pairing.** Today one density has one
  `source_refs` and one set of reference conditions. An array of densities makes
  every consumer ask "which one?" — including the engine, which would have to
  pick, which is exactly the kind of silent choice this project forbids.

The cost of Option 3 is a longer fuel list with near-identical neighbours, and
the risk that someone picks `diesel` when they meant `gas-oil`. `related_fuels`
is the mitigation: each entry names its relatives, the detail page links them
with a one-line explanation of the difference, and the fuel index shows them
together under their shared category.

## Consequences

- `data/fuels.json` gains variant entries. Every figure is transcribed verbatim
  from `docs/research-notes.md` with its source cell — the no-invented-numbers
  rule applies unchanged, and a variant is only added when density, at least one
  calorific value **and** its emission factors are all recorded.
- `Fuel` gains `related_fuels?: string[]`, validated to resolve like any other
  cross-reference.
- The parser needs no change: variants are matched by the existing alias
  machinery.
- This also unblocks the **Source Diff Viewer** on the roadmap. That feature was
  waiting for "more than one figure for the same thing"; with variants shipped,
  the comparison it wants to show is between *products*, which is a genuine
  comparison, rather than between sources for one product, which the rulebook
  forbids averaging anyway.
- Fuels whose variant data is incomplete stay out. Biopropane and landfill gas,
  for instance, have a recorded CO₂e factor but no recorded density or calorific
  value, so shipping them would produce a fuel that cannot answer the questions
  the tool is for.
