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

	it('biogenic combustion CO2 is never filed under an upstream scope', () => {
		// It is CO2 leaving the stack when YOU burn the fuel. Labelling it
		// "Scope 3 upstream (indirect, before you buy it)" told the reader the
		// opposite of what the number is (rulebook §C.5).
		for (const ef of emissionFactors) {
			if (ef.pollutant !== 'biogenic_CO2' && !ef.biogenic) continue;
			expect(ef.scope, `factor ${ef.id}`).toBe('outside_of_scopes');
		}
	});

	it('a factor value matches any component breakdown stated in its own notes', () => {
		// A digit transposition shipped hard coal's CO2e as 2.375… when its own
		// note (and the research ledger) records components summing to 2.395…
		const perTonne = /\(CO2\s+([\d.]+)\s*\+\s*CH4\s+([\d.]+)\s*\+\s*N2O\s+([\d.]+)\s+per tonne\)/;
		let checked = 0;
		for (const ef of emissionFactors) {
			const m = ef.notes?.match(perTonne);
			if (!m) continue;
			checked++;
			const sumPerKg = (Number(m[1]) + Number(m[2]) + Number(m[3])) / 1000;
			expect(Number(ef.value), `factor ${ef.id} vs its own components`).toBeCloseTo(sumPerKg, 8);
		}
		expect(checked).toBeGreaterThan(0);
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
			'outside_of_scopes',
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
	 * NOTE ON DESIGN: names are matched case-INSENSITIVELY; symbols AND aliases
	 * are first tried as an exact case-SENSITIVE match (units/registry.ts
	 * `bySymbol`, fed from both `symbols` and `aliases`), falling back to a
	 * case-insensitive match only when no case-sensitive hit exists (see
	 * units/aliases.ts normalizeSymbol vs normalizeLoose). This lets:
	 *  - "cal" (calorie) and "Cal" (food Calorie/kcal) coexist as distinct
	 *    SYMBOLS (rulebook §C.4/§D.7);
	 *  - "mg" (milligram symbol/alias) and "Mg" (SI megagram = tonne alias)
	 *    coexist as distinct case-sensitive ALIASES (fixed: see the dedicated
	 *    test below — this used to be a genuine factor-of-1e9 bug where "Mg"
	 *    silently misparsed as milligram).
	 *
	 * This block checks for collisions in the LOOSE (lowercased) namespace,
	 * which is what the registry falls back to ONLY when no case-sensitive
	 * symbol/alias match exists. A loose-key collision between two units that
	 * are each other's case-sensitively-distinct symbol/alias (like "mg"/"Mg")
	 * is NOT a real collision — case-sensitive resolution disambiguates it
	 * before the loose map is ever consulted, and the one genuinely ambiguous
	 * case (a loose-cased query like "MG", matching neither "mg" nor "Mg"
	 * exactly) is now reported as `ambiguous`, never silently picked.
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
		// Documented, understood collisions — both are case-sensitively distinct
		// symbols/aliases ("cal" vs "Cal", "mg" vs "Mg"), resolved via the
		// case-sensitive pass in units/registry.ts before ever reaching this
		// loose (lowercased) view. No OTHER collisions are tolerated.
		const known = new Set(['mg', 'cal']);
		const unexpected = collisions.filter((c) => !known.has(c.key));
		expect(unexpected, JSON.stringify(unexpected)).toHaveLength(0);
		expect(collisions.map((c) => c.key)).toContain('mg');
		expect(collisions.map((c) => c.key)).toContain('cal');
	});

	it(
		'FIXED: "Mg" (SI symbol for megagram = tonne, listed as a tonne alias) now ' +
			'resolves to tonne, not milligram. Root cause was units/registry.ts falling back ' +
			'to the case-INSENSITIVE `byLoose` map for any token that is not an exact ' +
			'case-sensitive SYMBOL match; "Mg" was only an ALIAS (not a symbol) of tonne, so it ' +
			'never hit the symbol path, and lowercasing collided it with milligram\'s own "mg" ' +
			'symbol/alias. Fix: the registry now runs a case-sensitive pass across BOTH symbols ' +
			'AND aliases before any case-insensitive fallback.',
		() => {
			const registry = new UnitRegistry(units);
			const mg = registry.resolve('Mg');
			expect(mg.kind).toBe('match');
			if (mg.kind === 'match') {
				expect(mg.unit.id).toBe('tonne');
			}

			// Lowercase "mg" still resolves to milligram, unaffected.
			const lower = registry.resolve('mg');
			expect(lower.kind).toBe('match');
			if (lower.kind === 'match') {
				expect(lower.unit.id).toBe('milligram');
			}
		}
	);

	it('an all-caps "MG" (matching neither "mg" nor "Mg" exactly) is reported as ambiguous, not silently picked', () => {
		const registry = new UnitRegistry(units);
		const match = registry.resolve('MG');
		expect(match.kind).toBe('ambiguous');
		if (match.kind === 'ambiguous') {
			const ids = match.interpretations.map((i) => i.unit_id);
			expect(ids).toEqual(expect.arrayContaining(['milligram', 'tonne']));
			expect(ids).toHaveLength(2);
		}
	});
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
