# Vendored oxlint plugin: `anti-slop`

`anti-slop/` is a **copy** of a third-party oxlint plugin, not an npm dependency.
Upstream ships it that way on purpose: the README says it is "meant to be
vendored, not treated as a fixed npm dependency", so the rules can be read and
adapted per repository. The copy is therefore source this repo now maintains,
and it ages in place unless somebody re-syncs it.

## Where the copy came from

|             |                                                                          |
| ----------- | ------------------------------------------------------------------------ |
| Upstream    | <https://github.com/dmmulroy/anti-slop>                                  |
| Commit      | `6d538555cb151d4121ed51a27db81890eacf8ae9`                               |
| Commit date | 2026-08-18 (`feat: add opt-in Effect lint rules`)                        |
| Copied path | `skills/install-anti-slop/assets/anti-slop/` → `tools/oxlint/anti-slop/` |
| Licence     | MIT — see `LICENSE.anti-slop` next to this file                          |

The upstream `assets/anti-slop/` tree is generated from upstream `src/` by
upstream's own `scripts/sync-skill-assets.mjs`; at the pinned commit the two are
byte-identical apart from the `*.test.ts` files, which are not copied.

`anti-slop/` is a verbatim copy with **no local edits**, which is what makes the
re-sync below a plain diff. If a rule ever needs a project-specific change, make
it, and record it in a "Local changes" section here — otherwise the next re-sync
silently reverts it.

## Re-syncing to a newer upstream

```bash
git clone https://github.com/dmmulroy/anti-slop /tmp/anti-slop
git -C /tmp/anti-slop log -1 --format='%H %ad %s'
diff -r tools/oxlint/anti-slop /tmp/anti-slop/skills/install-anti-slop/assets/anti-slop
```

An empty diff means the copy is current. Otherwise review the diff, copy the new
tree over, update the commit SHA and date in the table above, re-run the gate
(`npm run lint`), and handle any new findings — a new rule that fires is the
point of upgrading, not a regression.

## Version coupling

`oxlint` and `@oxlint/plugins` are pinned to the **same exact version** in
`package.json` (currently `1.80.0`). They are two halves of one API: the plugin
source imports `@oxlint/plugins`, and the binary that loads it is `oxlint`. A
caret range on both could resolve them to different versions, so the pin is
deliberate.

A pin is only honest when it gets bumped, so: bump both together whenever the
plugin is re-synced, and otherwise on the same schedule as the rest of the
devDependencies. New findings from a newer oxlint are wanted.

## Which rules are on

Decided in `oxlint.config.ts` at the repo root, with the reasoning written there.
Summary:

- All 15 generic anti-slop rules are `error`, except `no-runtime-typeof`, which
  is `off` with a reason in the config.
- The Effect rule group is not registered — this repo does not use Effect.
- oxlint's **own** rule categories are off. ESLint (`eslint.config.js`) owns
  general correctness and style here; oxlint is installed only as the host for
  this plugin. Measured on this repo at oxlint 1.80.0, adopting them would be its
  own project: `correctness` 1, `perf` 2, `suspicious` 42, `pedantic` 352,
  `restriction` 887, `style` 4403 findings. The single `correctness` finding is
  `unicorn(no-new-array)` at `src/lib/units/aliases.ts:36` — `new Array<number>(n)`
  in the Levenshtein inner loop, where the argument is unambiguously a length.
