/**
 * Fuel registry: lookup a fuel by id / name / alias (case-insensitive). Works
 * with an EMPTY catalog now — the architecture supports fuels the Data agent
 * adds later (tests use inline fixtures, tests/fixtures/).
 */

import type { Fuel } from '$lib/conversion/types';
import { levenshtein, normalizeLoose } from '$lib/units/aliases';

export class FuelRegistry {
	private readonly byId = new Map<string, Fuel>();
	private readonly byLoose = new Map<string, Fuel>();

	constructor(private readonly fuels: Fuel[]) {
		for (const f of fuels) {
			this.byId.set(f.id, f);
			this.addLoose(f.id, f);
			for (const name of f.names) this.addLoose(name, f);
			for (const alias of f.aliases) this.addLoose(alias, f);
		}
	}

	private addLoose(token: string, fuel: Fuel): void {
		const key = normalizeLoose(token);
		if (!this.byLoose.has(key)) this.byLoose.set(key, fuel);
	}

	get(id: string): Fuel | undefined {
		return this.byId.get(id);
	}

	all(): Fuel[] {
		return this.fuels;
	}

	/** Resolve a free-text fuel phrase to a fuel, or undefined if unknown. */
	resolve(token: string): Fuel | undefined {
		return this.byLoose.get(normalizeLoose(token));
	}

	/**
	 * Try to peel a known fuel phrase off the END of a token stream, returning
	 * the matched fuel and the leftover (non-fuel) prefix words. Greedy longest
	 * match so "wood pellets" beats "wood". Returns undefined if no suffix of the
	 * words matches a fuel.
	 */
	matchTrailingFuel(words: string[]): { fuel: Fuel; consumed: number } | undefined {
		for (let start = 0; start < words.length; start++) {
			const phrase = words.slice(start).join(' ');
			const fuel = this.resolve(phrase);
			if (fuel) return { fuel, consumed: words.length - start };
		}
		return undefined;
	}

	/**
	 * Up to 3 canonical fuel NAMES a failed material phrase plausibly meant, so
	 * "1 barrel oil" or "1 m³ gas" can offer the real catalog entries instead of
	 * a bare "unknown material". Substring relatives rank first ("oil" → crude
	 * oil, heating oil); edit-distance candidates must be close relative to the
	 * shorter string so unrelated words yield nothing rather than noise.
	 */
	suggest(phrase: string): string[] {
		const loose = normalizeLoose(phrase);
		if (loose.length < 2 || loose.length > 60) return [];

		const contains: { name: string; len: number }[] = [];
		const near: { name: string; d: number }[] = [];
		for (const [key, fuel] of this.byLoose) {
			const name = fuel.names[0];
			if (key.includes(loose) || loose.includes(key)) {
				contains.push({ name, len: key.length });
				continue;
			}
			const d = levenshtein(loose, key);
			const tolerance = Math.max(1, Math.floor(Math.min(loose.length, key.length) / 3));
			if (d <= tolerance) near.push({ name, d });
		}
		contains.sort((a, b) => a.len - b.len);
		near.sort((a, b) => a.d - b.d);

		const out: string[] = [];
		for (const { name } of [...contains, ...near]) {
			if (!out.includes(name)) out.push(name);
			if (out.length >= 3) break;
		}
		return out;
	}
}
