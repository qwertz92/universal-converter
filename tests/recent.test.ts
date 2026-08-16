/**
 * Browser-local history of recently run conversions (roadmap 0.3). Tested
 * against a fake store so the behaviour — including a storage that refuses to
 * cooperate — is verified without a browser.
 */

import { describe, expect, it } from 'vitest';
import { clearRecent, pushRecent, readRecent, type RecentStore } from '$lib/ui/recent';

function fakeStore(initial: Record<string, string> = {}): RecentStore {
	const data = { ...initial };
	return {
		getItem: (k) => data[k] ?? null,
		setItem: (k, v) => {
			data[k] = v;
		},
		removeItem: (k) => {
			delete data[k];
		}
	};
}

/** A store that throws on every operation (private mode, blocked storage). */
const hostileStore: RecentStore = {
	getItem() {
		throw new Error('blocked');
	},
	setItem() {
		throw new Error('blocked');
	},
	removeItem() {
		throw new Error('blocked');
	}
};

describe('recent conversions', () => {
	it('starts empty and records the most recent first', () => {
		const s = fakeStore();
		expect(readRecent(s)).toEqual([]);
		pushRecent(s, '1 kWh');
		expect(pushRecent(s, '10 L diesel')).toEqual(['10 L diesel', '1 kWh']);
	});

	it('moves a repeat to the front instead of duplicating it', () => {
		const s = fakeStore();
		pushRecent(s, '1 kWh');
		pushRecent(s, '10 L diesel');
		expect(pushRecent(s, '1 kwh')).toEqual(['1 kwh', '10 L diesel']);
	});

	it('caps the list at 8 entries', () => {
		const s = fakeStore();
		for (let i = 1; i <= 12; i++) pushRecent(s, `${i} kWh`);
		const list = readRecent(s);
		expect(list).toHaveLength(8);
		expect(list[0]).toBe('12 kWh');
	});

	it('ignores blank queries and anything longer than a legal query', () => {
		const s = fakeStore();
		expect(pushRecent(s, '   ')).toEqual([]);
		expect(pushRecent(s, 'x'.repeat(201))).toEqual([]);
	});

	it('survives malformed or foreign stored values', () => {
		expect(readRecent(fakeStore({ 'uc-recent': 'not json' }))).toEqual([]);
		expect(readRecent(fakeStore({ 'uc-recent': '{"a":1}' }))).toEqual([]);
		expect(readRecent(fakeStore({ 'uc-recent': '["1 kWh", 42, null]' }))).toEqual(['1 kWh']);
	});

	it('clears', () => {
		const s = fakeStore();
		pushRecent(s, '1 kWh');
		expect(clearRecent(s)).toEqual([]);
		expect(readRecent(s)).toEqual([]);
	});

	it('degrades gracefully when storage is unavailable or hostile', () => {
		// Nothing persists, but the returned list is still correct so the current
		// session keeps working instead of silently losing the feature.
		expect(readRecent(undefined)).toEqual([]);
		expect(pushRecent(undefined, '1 kWh')).toEqual(['1 kWh']);
		expect(clearRecent(undefined)).toEqual([]);
		expect(readRecent(hostileStore)).toEqual([]);
		expect(pushRecent(hostileStore, '1 kWh')).toEqual(['1 kWh']);
		expect(() => clearRecent(hostileStore)).not.toThrow();
	});
});
