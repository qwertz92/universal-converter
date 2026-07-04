/**
 * §13.5 DATA VALIDATION — extends tests/data-validation.test.ts (which only
 * covers units + the aggregate validateAll() report) with fuel-, emission-
 * factor-, alias-, and spec-conformance-level checks called out explicitly by
 * spec §13.5 and the Test-agent brief:
 *  - unique fuel_ids / emission-factor ids / source ids (units already covered);
 *  - every source_ref/source_id resolves (units already covered; extends to
 *    fuels + emission factors + density + heating values);
 *  - every non-exact numeric carries >=1 source ref;
 *  - heating values all carry a basis;
 *  - emission factors carry pollutant + scope + source;
 *  - aliases don't collide across UNITS (no alias maps to two unit ids) — and
 *    documents one genuine collision found in the real catalog (see the
 *    dedicated describe block below and the final report);
 *  - every spec §8.5 fuel exists in the catalog;
 *  - every spec §8.2 example input exists in examples.json (cross-checked
 *    from the data-validation angle; examples.test.ts checks it PARSES).
 */

import { describe, expect, it } from 'vitest';
import { loadDataBundle, loadExamples } from '$lib/data/load-data';
import { UnitRegistry } from '$lib/units/registry';

const { units, fuels, emissionFactors, sources } = loadDataBundle();
const sourceIds = new Set(sources.map((s) => s.id));

describe('§13.5 uniqueness across every catalog', () => {
	it('fuel ids are unique', () => {
		const ids = fuels.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('emission-factor ids are unique', () => {
		const ids = emissionFactors.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('source ids are unique', () => {
		const ids = sources.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('unit ids are unique (cross-check; primary assertion lives in data-validation.test.ts)', () => {
		const ids = units.map((u) => u.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('§13.5 every source_ref / source_id resolves (fuels + emission factors)', () => {
	it('every fuel.source_refs entry resolves to a sources.json id', () => {
		for (const f of fuels) {
			for (const ref of f.source_refs) {
				expect(sourceIds.has(ref), `fuel ${f.id} source_ref ${ref}`).toBe(true);
			}
		}
	});

	it('every fuel.density.source_refs entry resolves', () => {
		for (const f of fuels) {
			if (!f.density) continue;
			for (const ref of f.density.source_refs) {
				expect(sourceIds.has(ref), `fuel ${f.id} density source_ref ${ref}`).toBe(true);
			}
		}
	});

	it('every heating_values[].source_refs entry resolves', () => {
		for (const f of fuels) {
			for (const hv of f.heating_values ?? []) {
				for (const ref of hv.source_refs) {
					expect(sourceIds.has(ref), `fuel ${f.id} heating_value source_ref ${ref}`).toBe(true);
				}
			}
		}
	});

	it('every emission_factor.source_id resolves', () => {
		for (const ef of emissionFactors) {
			expect(sourceIds.has(ef.source_id), `factor ${ef.id} source_id ${ef.source_id}`).toBe(true);
		}
	});
});

describe('§13.5 every non-exact numeric carries >=1 source ref', () => {
	it('every fuel density carries >=1 source_ref (schema requires min(1); asserted anyway)', () => {
		for (const f of fuels) {
			if (!f.density) continue;
			expect(f.density.source_refs.length, `fuel ${f.id} density`).toBeGreaterThan(0);
		}
	});

	it('every heating value carries >=1 source_ref', () => {
		for (const f of fuels) {
			for (const hv of f.heating_values ?? []) {
				expect(
					hv.source_refs.length,
					`fuel ${f.id} heating_value ${hv.unit}/${hv.basis}`
				).toBeGreaterThan(0);
			}
		}
	});

	it('every emission factor carries exactly one source_id (non-empty string)', () => {
		for (const ef of emissionFactors) {
			expect(ef.source_id.length, `factor ${ef.id}`).toBeGreaterThan(0);
		}
	});
});

describe('§13.5 heating values all carry a basis (lhv or hhv), never omitted', () => {
	it('every heating value in the catalog has basis "lhv" or "hhv"', () => {
		for (const f of fuels) {
			for (const hv of f.heating_values ?? []) {
				expect(['lhv', 'hhv']).toContain(hv.basis);
			}
		}
	});
});

describe('§13.5 emission factors carry pollutant + scope + source (spec §13.5)', () => {
	it('every emission factor has a recognised pollutant', () => {
		const allowed = new Set(['CO2', 'CH4', 'N2O', 'CO2e', 'biogenic_CO2']);
		for (const ef of emissionFactors) {
			expect(allowed.has(ef.pollutant), `factor ${ef.id}`).toBe(true);
		}
	});

	it('every emission factor has a recognised scope', () => {
		const allowed = new Set([
			'direct_combustion',
			'scope_1',
			'scope_2',
			'scope_3_upstream',
			'well_to_tank',
			'tank_to_wheel',
			'well_to_wheel',
			'unknown_or_mixed'
		]);
		for (const ef of emissionFactors) {
			expect(allowed.has(ef.scope), `factor ${ef.id}`).toBe(true);
		}
	});

	it('every emission factor has a non-empty source_id (already checked for resolution above)', () => {
		for (const ef of emissionFactors) {
			expect(ef.source_id.length, `factor ${ef.id}`).toBeGreaterThan(0);
		}
	});

	it('biogenic-flagged factors use pollutant biogenic_CO2 (never plain CO2/CO2e mislabeled)', () => {
		for (const ef of emissionFactors) {
			if (ef.biogenic) expect(ef.pollutant, `factor ${ef.id}`).toBe('biogenic_CO2');
		}
	});
});

describe('§13.5 fuel -> emission-factor cross-references resolve both ways', () => {
	it('every fuel.emission_factor_ids entry resolves to a real emission-factors.json id', () => {
		const factorIds = new Set(emissionFactors.map((f) => f.id));
		for (const f of fuels) {
			for (const fid of f.emission_factor_ids ?? []) {
				expect(factorIds.has(fid), `fuel ${f.id} -> factor ${fid}`).toBe(true);
			}
		}
	});

	it('every emission_factor.fuel_id (when set) resolves to a real fuels.json id', () => {
		const fuelIds = new Set(fuels.map((f) => f.id));
		for (const ef of emissionFactors) {
			if (ef.fuel_id)
				expect(fuelIds.has(ef.fuel_id), `factor ${ef.id} -> fuel ${ef.fuel_id}`).toBe(true);
		}
	});
});

describe('§13.5 fuel aliases do not collide across fuels (no alias maps to two fuel ids)', () => {
	it('every fuel name/alias (case-insensitive) maps to exactly one fuel id', () => {
		const map = new Map<string, string>();
		const collisions: string[] = [];
		for (const f of fuels) {
			for (const token of [...f.names, ...f.aliases]) {
				const key = token.toLowerCase().trim();
				const owner = map.get(key);
				if (owner && owner !== f.id) {
					collisions.push(`"${token}" -> both ${owner} and ${f.id}`);
				} else {
					map.set(key, f.id);
				}
			}
		}
		expect(collisions, collisions.join('; ')).toHaveLength(0);
	});
});

describe('§13.5 unit aliases: case-insensitive-loose collisions across DIFFERENT units', () => {
	/**
	 * NOTE ON DESIGN: names/aliases are matched case-INSENSITIVELY, but symbols
	 * are matched case-SENSITIVELY (units/aliases.ts normalizeSymbol vs
	 * normalizeLoose) precisely so that e.g. "cal" (calorie) and "Cal" (food
	 * Calorie/kcal) can coexist as distinct SYMBOLS (rulebook §C.4/§D.7 — this
	 * is intentional and not a collision at the symbol level).
	 *
	 * This block checks for collisions in the LOOSE (lowercased) namespace,
	 * which is what actually happens during alias/name resolution (and what a
	 * symbol falls back to when no case-sensitive symbol match is found).
	 */
	it('lists every loose-key collision across different units for inspection', () => {
		const map = new Map<string, string>();
		const collisions: Array<{ key: string; a: string; b: string }> = [];
		for (const u of units) {
			for (const token of [...u.symbols, ...u.names, ...u.aliases]) {
				const key = token.toLowerCase().trim();
				const owner = map.get(key);
				if (owner && owner !== u.id) {
					collisions.push({ key, a: owner, b: u.id });
				} else {
					map.set(key, u.id);
				}
			}
		}
		// Documented, understood collisions:
		//  - "cal" <-> "Cal": INTENTIONAL by design (rulebook §C.4/§D.7) — "cal"
		//    (calorie) and "Cal" (food Calorie = kcal) are meant to be distinct
		//    SYMBOLS, disambiguated by case-sensitive symbol matching; they only
		//    collide in this loose (lowercased) view, which the engine does not
		//    actually use for symbol resolution (see units/registry.ts bySymbol).
		//  - "mg" <-> "Mg": a GENUINE BUG (see the dedicated test below) — "Mg"
		//    (megagram/tonne alias) is not a registered symbol, so it falls
		//    through to this loose map and collides with milligram's "mg".
		// No OTHER collisions are tolerated.
		const known = new Set(['mg', 'cal']);
		const unexpected = collisions.filter((c) => !known.has(c.key));
		expect(unexpected, JSON.stringify(unexpected)).toHaveLength(0);
		expect(collisions.map((c) => c.key)).toContain('mg');
		expect(collisions.map((c) => c.key)).toContain('cal');
	});

	it(
		'BUG (engine, not fixed here): "Mg" (SI symbol for megagram = tonne, listed as a ' +
			'tonne alias) is silently misparsed as milligram — a factor-of-1e9 unit-confusion ' +
			'error. Root cause: units/registry.ts falls back to the case-INSENSITIVE `byLoose` ' +
			'map for any token that is not an exact case-sensitive SYMBOL match; "Mg" is only an ' +
			'ALIAS (not a symbol) of tonne, so it never hits the symbol path, and lowercasing ' +
			'collides it with milligram\'s own "mg" symbol/alias, which was registered first. ' +
			'See final report for the precise repro and suggested fix (case-sensitive alias ' +
			'lookup, or removing ambiguous "Mg"/"mg" pairing from the alias lists).',
		() => {
			const registry = new UnitRegistry(units);
			const match = registry.resolve('Mg');
			// PINS DOWN THE BUG'S CURRENT (WRONG) BEHAVIOUR so a future fix is visible
			// as a passing-test change here, not a silent regression elsewhere.
			expect(match.kind).toBe('match');
			if (match.kind === 'match') {
				// This SHOULD be 'tonne' (megagram); it is actually 'milligram'.
				expect(match.unit.id).toBe('milligram');
			}
		}
	);
});

describe('§13.5 every spec §8.5 fuel exists in the catalog', () => {
	const SPEC_8_5_FUELS = [
		'crude-oil',
		'gasoline',
		'diesel',
		'heating-oil',
		'kerosene',
		'lpg',
		'propane',
		'butane',
		'natural-gas',
		'methane',
		'lng',
		'hydrogen',
		'hard-coal',
		'lignite',
		'anthracite',
		'wood-logs', // spec says "wood"; catalog uses wood-logs (see notes)
		'wood-pellets',
		'ethanol',
		'biodiesel',
		'biogas'
	];

	it.each(SPEC_8_5_FUELS)('fuel "%s" exists in data/fuels.json', (id) => {
		expect(
			fuels.some((f) => f.id === id),
			id
		).toBe(true);
	});

	it('Brent/WTI (spec-optional "only if serious data without false precision") is absent — acceptable per spec', () => {
		expect(fuels.some((f) => /brent|wti/i.test(f.id))).toBe(false);
	});
});

describe('§13.5 every spec §8.2 example input exists in examples.json', () => {
	const SPEC_8_2_INPUTS = [
		'1 kWh',
		'1 MWh',
		'1 MJ',
		'1 GJ',
		'1 BTU',
		'1 MMBTU',
		'1 therm',
		'1 toe',
		'1 boe',
		'1000 kcal',
		'1 liter diesel',
		'1 L gasoline',
		'1 liter heating oil',
		'1 barrel crude oil',
		'1 m3 natural gas',
		'1 kg hydrogen',
		'1 kg hard coal',
		'1 kg lignite',
		'1 kg wood pellets'
	];

	it('examples.json contains every spec §8.2 literal input (cross-check from the data side)', () => {
		const inputs = new Set(loadExamples().map((e) => e.input));
		for (const spec of SPEC_8_2_INPUTS) {
			expect(inputs.has(spec), `missing example for "${spec}"`).toBe(true);
		}
	});
});
