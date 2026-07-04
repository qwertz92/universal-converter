/**
 * Fuel registry: lookup a fuel by id / name / alias (case-insensitive). Works
 * with an EMPTY catalog now — the architecture supports fuels the Data agent
 * adds later (tests use inline fixtures, tests/fixtures/).
 */

import type { Fuel } from '$lib/conversion/types';
import { normalizeLoose } from '$lib/units/aliases';

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
}
