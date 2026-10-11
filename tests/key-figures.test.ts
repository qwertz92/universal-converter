import { describe, expect, it } from 'vitest';
import { getConverter, loadDataBundle } from '#lib/index.js';
import { keyFigures } from '#lib/ui/key-figures.js';
import type { EngineOptions } from '#lib/conversion/types.js';

const converter = getConverter();
const { units } = loadDataBundle();

function figures(text: string, options?: EngineOptions) {
	const out = converter.convertText(text, options);
	if ('error' in out) throw new Error(out.error.message);
	const dim = units.find((u) => u.id === out.input.unit_id)!.dimension;
	return keyFigures(out, dim).map((f) => `${f.label}=${f.row.value} ${f.row.unit_label}`);
}

describe('keyFigures', () => {
	it('a fuel opens with energy, mass and both CO₂ metrics — not its own volume', () => {
		expect(figures('10 L diesel')).toEqual([
			'Energy · LHV=99.05 kWh',
			'Mass=8.324 kg',
			'CO₂=~25.4 kg CO2',
			'CO₂e=~25.7 kg CO2e'
		]);
	});

	it('the headline follows the basis the reader chose', () => {
		expect(figures('10 L diesel', { basis: 'hhv' })[0]).toBe('Energy · HHV=105.3 kWh');
	});

	it('power × time headlines the energy', () => {
		expect(figures('5 kW for 3 h')).toEqual(['Energy=15 kWh']);
	});

	it('an emission input is not restated as its own tile', () => {
		expect(figures('10 kg CO2e').some((f) => f.startsWith('CO₂e='))).toBe(false);
		expect(figures('10 kg CO2').some((f) => f.startsWith('CO₂='))).toBe(false);
	});

	it('a plain unit conversion has nothing to headline beyond the table', () => {
		expect(figures('1 kWh')).toEqual([]);
	});

	it('a priced amount headlines its cost', () => {
		expect(figures('1000 kWh at 0.32 EUR/kWh').some((f) => f.startsWith('Cost='))).toBe(true);
	});
});
