# Public API — `/api/convert` (DRAFT)

> Status: **draft** (roadmap 0.2, spec §16 "`/api/convert`"). The response
> shape may change until 1.0. Introduced in v0.2.0. The endpoint is read-only,
> CORS-open (`Access-Control-Allow-Origin: *`), and a pure function of its
> query string (200 responses are publicly cacheable for a day).

## Request

```
GET /api/convert?q=<free-text query>
```

| Parameter | Required | Values | Meaning |
| --------- | -------- | ------ | ------- |
| `q`       | yes      | free text, e.g. `1 L diesel`, `1000 kcal`, `5 kWh to MJ`, `5 kW for 3 h`, `1000 kWh at 0.32 EUR/kWh`, `100 kWh at 3.5 COP` | Same grammar as the website's input: `[number] [unit] [optional fuel] [to <target unit>] [for <duration>] [at <price>] [at <efficiency>]` (see the rulebook §C.9). A price or efficiency is **your** figure — no tariffs or appliance efficiencies are shipped, and no currency is ever converted. They produce `cost` and `delivered` result groups, never more exact than the quantity underneath them. |
| `basis`   | no       | `lhv` (default) \| `hhv` | Heating-value basis for fuel-energy results (always labeled in the result). |
| `region` + `year` | no (only together) | e.g. `region=UK&year=2025` | Grid region/year for electricity emissions. Only combinations with a cited factor produce a value; anything else stays `context_required` — nothing is estimated. |
| `sigfigs` | no       | integer 1–12 (default 6) | Max significant figures for `exact`/`standard_definition` display values. Non-exact results keep their exactness-bounded caps. |

## Responses

**200** — the parse succeeded. Body:

```jsonc
{
	"api_version": "0.2-draft",
	"exactness_note": "…",
	"result": {
		"input": { "value": "1", "unit_id": "liter", "unit_label": "L", "fuel_id": "diesel", … },
		"groups": [
			{ "key": "volume", "title": "Volume", "results": [ /* ConversionResult[] */ ] },
			{ "key": "mass", … }, { "key": "energy", … }, { "key": "emissions", … }, …
		],
		"assumptions": [ … ],
		"warnings": [ … ],
		"source_refs": [ "uk-desnz-ghg-2025", … ],
		// Present only when `q` asked for a target ("5 kWh to MJ"). `resolved`
		// is false when the target could not be produced — the corresponding
		// row then explains what is missing rather than being omitted.
		"target": { "unit_id": "megajoule", "unit_label": "MJ", "dimension": "energy", "resolved": true }
	}
}
```

Each `ConversionResult` carries:

- `value` — display string (may carry a `~` marker; `null` for value-less
  states like `context_required`);
- `raw` — full-precision decimal **string** (use this for computation);
- `unit_id`, `unit_label`, `category`;
- `exactness` — one of `exact`, `standard_definition`, `source_based`,
  `estimated`, `region_year_specific`, `user_assumption`, `context_required`,
  `unsupported`. **Never present a non-exact value as exact.**
- `assumptions`, `warnings`, `source_refs` (ids into the
  [source register](sources.md));
- optional `formula`, `range`, `missing`, `explanation`,
  `illustrative_examples`;
- `is_target: true` on the single row the query explicitly asked for. That row
  is also floated to the front of its group. A target **highlights** an answer —
  it never removes the other groups, so a client that wants only one number
  should read the `is_target` row and ignore the rest rather than expect a
  filtered response.

The trailing meta-groups (`assumptions` / `warnings` / `sources` / `formula`)
duplicate the set-level fields in group form (rulebook §C.8); their rows are
presentation stubs (`value: null`) — API consumers should read the set-level
`assumptions`/`warnings`/`source_refs` fields instead.

**400** — missing/invalid parameters or a parse failure. Body:

```jsonc
{
	"api_version": "0.2-draft",
	"error": {
		"kind": "unknown_unit", // or missing_query | invalid_parameter | ambiguous_unit |
		// unknown_fuel | no_unit | missing_value | empty_input
		"message": "…",
		"suggestions": ["…"], // for unknown_unit
		"interpretations": [{ "unit_id": "…", "label": "…" }] // for ambiguous_unit
	}
}
```

Note: an **unmatched grid region/year is not an HTTP error** — the parse
succeeded, so the response is 200 with a `context_required` emissions result
listing what is missing and the available illustrative examples.

## Examples

```bash
curl 'https://universal-converter.org/api/convert?q=1+kWh'
curl 'https://universal-converter.org/api/convert?q=1+L+diesel&basis=hhv'
curl 'https://universal-converter.org/api/convert?q=5+kWh+electricity&region=UK&year=2025'
curl 'https://universal-converter.org/api/convert?q=5+kWh+to+MJ'
curl 'https://universal-converter.org/api/convert?q=5+kW+for+3+h'
```

## Guarantees & non-goals

- Same engine, same data, same guards as the website: no silent kW→kWh, no
  CO2↔CO2e path, no invented numbers, basis always labeled.
- No authentication, no rate limiting beyond Cloudflare's defaults (draft).
- No stability promise before 1.0 — pin nothing critical to this shape yet;
  the `x-api-version` response header and `api_version` body field tell you
  what you got.

Implementation: [`src/lib/api/convert-endpoint.ts`](../src/lib/api/convert-endpoint.ts)
(framework-independent handler, unit-tested in
[`tests/api-convert.test.ts`](../tests/api-convert.test.ts)) wrapped by
[`src/routes/api/convert/+server.ts`](../src/routes/api/convert/+server.ts) —
the one non-prerendered route (a Cloudflare Pages Function).
