/**
 * Mass/volume → energy via heating value, with the basis (LHV/HHV) always
 * labeled (rulebook §C.1, §D.2). Default basis is LHV; HHV is shown alongside
 * only from real data, never derived from LHV (§C.1 rule 4).
 *
 * Heating values are stored per-mass (MJ/kg, kWh/kg) or per-volume (MJ/L,
 * kWh/L, MJ/m³, kWh/m³). This module normalises each to joules-per-base
 * (J/kg for mass, J/m³ for volume) so the engine can multiply by a base-unit
 * amount and get joules.
 */

import Decimal from 'decimal.js';
import type { Fuel, HeatingBasis, HeatingValue } from '$lib/conversion/types';

Decimal.set({ precision: 40 });

/** J per one MJ / kWh (exact). */
const MJ_TO_J = new Decimal('1000000');
const KWH_TO_J = new Decimal('3600000');
/** m³ per L (exact) for per-volume unit normalisation. */
const L_PER_M3 = new Decimal('1000');

export type HeatingKind = 'per_mass' | 'per_volume';

export interface HeatingValueResolved {
	basis: HeatingBasis;
	kind: HeatingKind;
	/** J per kg (per_mass) or J per m³ (per_volume). */
	jPerBase: string;
	/** The original stored value + unit, for the human-readable formula. */
	displayValue: string;
	displayUnit: string;
	range?: { low: string; high: string };
	source_refs: string[];
}

/** Which physical base a heating-value unit is expressed against. */
function classify(
	unit: string
): { kind: HeatingKind; jPerBase: (v: Decimal) => Decimal } | undefined {
	switch (unit) {
		case 'mj_per_kg':
			return { kind: 'per_mass', jPerBase: (v) => v.times(MJ_TO_J) };
		case 'kwh_per_kg':
			return { kind: 'per_mass', jPerBase: (v) => v.times(KWH_TO_J) };
		case 'mj_per_l':
			return { kind: 'per_volume', jPerBase: (v) => v.times(MJ_TO_J).times(L_PER_M3) };
		case 'kwh_per_l':
			return { kind: 'per_volume', jPerBase: (v) => v.times(KWH_TO_J).times(L_PER_M3) };
		case 'mj_per_m3':
			return { kind: 'per_volume', jPerBase: (v) => v.times(MJ_TO_J) };
		case 'kwh_per_m3':
			return { kind: 'per_volume', jPerBase: (v) => v.times(KWH_TO_J) };
		default:
			return undefined;
	}
}

/** Resolve one stored heating value into normalised J-per-base form. */
export function resolveHeatingValue(hv: HeatingValue): HeatingValueResolved | undefined {
	const c = classify(hv.unit);
	if (!c) return undefined;
	return {
		basis: hv.basis,
		kind: c.kind,
		jPerBase: c.jPerBase(new Decimal(hv.value)).toFixed(),
		displayValue: hv.value,
		displayUnit: displayHvUnit(hv.unit),
		range: hv.range,
		source_refs: hv.source_refs
	};
}

/**
 * Pick the heating value for a requested basis and physical kind. Returns the
 * requested basis if present; otherwise undefined (caller marks "not available"
 * — we NEVER derive the missing basis, rulebook §C.1 rule 4).
 */
export function pickHeatingValue(
	fuel: Fuel,
	basis: HeatingBasis,
	kind: HeatingKind
): HeatingValueResolved | undefined {
	for (const hv of fuel.heating_values ?? []) {
		const r = resolveHeatingValue(hv);
		if (r && r.basis === basis && r.kind === kind) return r;
	}
	return undefined;
}

/** All resolvable heating values of a fuel (for showing HHV alongside LHV). */
export function allHeatingValues(fuel: Fuel): HeatingValueResolved[] {
	const out: HeatingValueResolved[] = [];
	for (const hv of fuel.heating_values ?? []) {
		const r = resolveHeatingValue(hv);
		if (r) out.push(r);
	}
	return out;
}

/** energy(J) = amount(base) × heating value(J/base). */
export function amountToEnergyJ(amountBase: string, jPerBase: string): string {
	return new Decimal(amountBase).times(new Decimal(jPerBase)).toFixed();
}

/** amount(base) = energy(J) / heating value(J/base). */
export function energyToAmountBase(energyJ: string, jPerBase: string): string {
	return new Decimal(energyJ).div(new Decimal(jPerBase)).toFixed();
}

export function basisLabel(basis: HeatingBasis): string {
	return basis === 'lhv' ? 'LHV/NCV' : 'HHV/GCV';
}

function displayHvUnit(unit: string): string {
	const map: Record<string, string> = {
		mj_per_kg: 'MJ/kg',
		kwh_per_kg: 'kWh/kg',
		mj_per_l: 'MJ/L',
		kwh_per_l: 'kWh/L',
		mj_per_m3: 'MJ/m³',
		kwh_per_m3: 'kWh/m³'
	};
	return map[unit] ?? unit;
}
