/**
 * German phrasing.
 *
 * The catalog has been half-bilingual since v0.1 — `erdgas`, `heizöl`,
 * `wasserstoff`, `steinkohle` and `benzin` all resolve — but the GRAMMAR was
 * English-only. So a German sentence hit "Start with a number, e.g. 1 kWh",
 * the least useful message the tool has, for a phrasing this site's most likely
 * audience actually uses. One grammar now serves both languages: the German
 * question is rewritten into the same `Y to X` shape as the English one.
 */

import { describe, expect, it } from 'vitest';
import { getConverter } from '$lib/index';

const converter = getConverter();

function value(input: string, unitId: string): string | undefined {
	const out = converter.convertText(input);
	if ('error' in out) throw new Error(`"${input}" failed: ${out.error.message}`);
	return out.groups.flatMap((g) => g.results).find((r) => r.unit_id === unitId)?.value;
}

describe('a German question is answered', () => {
	it.each([
		['wie viel kWh hat 1 liter diesel', 'kilowatt_hour', '9.905'],
		['wieviel kWh hat 1 liter diesel', 'kilowatt_hour', '9.905'],
		['wie viele kWh hat 1 m3 erdgas', 'kilowatt_hour', '10.19'],
		['wie viel MJ sind in 5 kWh', 'megajoule', '18'],
		['wie viel MJ steckt in 5 kWh', 'megajoule', '18']
	])('%s', (query, unitId, expected) => {
		expect(value(query, unitId)).toBe(expected);
	});

	it('German filler in front of an ordinary query is stripped', () => {
		expect(value('berechne 5 kWh in MJ', 'megajoule')).toBe('18');
		expect(value('bitte 5 kWh in MJ', 'megajoule')).toBe('18');
		expect(value('was ist 1 liter benzin', 'kilowatt_hour')).toBe('8.926');
	});

	it('a German question whose wanted half is not a unit still converts the source', () => {
		// "wie viel CO2 macht 50 l diesel" — CO2 is not a unit, so the source is
		// converted and the emissions group answers the actual question.
		const out = converter.convertText('wie viel CO2 macht 50 l diesel');
		if ('error' in out) throw new Error('should parse');
		const co2 = out.groups
			.flatMap((g) => g.results)
			.find((r) => r.category === 'emissions' && r.unit_id === 'kilogram_co2e');
		expect(Number(co2?.raw)).toBeCloseTo(128.541, 2);
	});

	it('the English forms it was modelled on still work', () => {
		expect(value('how many kWh in 1 liter diesel', 'kilowatt_hour')).toBe('9.905');
		expect(value('convert 5 kwh to mj', 'megajoule')).toBe('18');
	});

	it('English gained the "does X make" shape at the same time', () => {
		const out = converter.convertText('how much co2 does 50 l diesel make');
		expect('error' in out).toBe(false);
	});
});

describe('an unknown material still points somewhere useful', () => {
	it('filler is dropped from the message and the lookup', () => {
		// "1 kg of coal dust" reported '"of coal dust" is not a material' with no
		// suggestions — the leading "of" defeated the fuzzy matcher.
		const out = converter.convertText('1 kg of coal dust');
		expect('error' in out).toBe(true);
		if ('error' in out) {
			expect(out.error.token).toBe('coal dust');
			expect(out.error.message).not.toContain('of coal dust');
		}
	});

	it.each([
		['1 kg coal dust', 'hard coal'],
		['1 L heizöl extra leicht', 'gas oil'],
		['1 kg brown coal dust', 'lignite']
	])('"%s" offers the grades it is built on', (query, expected) => {
		const out = converter.convertText(query);
		expect('error' in out).toBe(true);
		if ('error' in out) expect(out.error.suggestions).toContain(expected);
	});

	it('a phrase built on nothing gets no invented suggestions', () => {
		const out = converter.convertText('1 kg unobtainium');
		expect('error' in out).toBe(true);
		if ('error' in out) expect(out.error.suggestions ?? []).toEqual([]);
	});
});
