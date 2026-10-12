# Open issues

One list of known open defects, by priority. Closed items are deleted — git
keeps them. P1 core function unusable / wrong data; P2 normal flow wrong or
clearly disturbing; P3 minor or rare; P4 not noticeable.

## P3

None open (2026-10-12).

## P4

- **`/fuels/heavy-fuel-oil` and `/fuels/fuel-oil` land on `/fuels/heating-oil`**,
  because `data/fuels.json` names that entry "fuel oil" / "heavy fuel oil" (it is
  residual fuel oil; the id is the misleading part). A data-naming question, not
  a resolver bug. (2026-10-11)
- **Valid unit URLs in a different case answer HTTP 404 first.** `/units/MW`
  has no prerendered file (lower-case redirects only, for case-insensitive
  filesystems), so Cloudflare serves the static 404 shell, which then redirects
  in the browser to `/units/megawatt`. Visitors land right; a crawler sees 404.
  (2026-10-11, verified on the live site)
