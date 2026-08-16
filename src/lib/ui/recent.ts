/**
 * Recently run conversions (roadmap 0.3 "saved scenarios", the half that needs
 * no new data). Stored in the browser only — nothing is sent anywhere, and the
 * list holds exactly what the user typed, nothing derived about them.
 *
 * Written against a minimal storage interface rather than `localStorage`
 * directly so the behaviour is unit-testable and so a browser that refuses
 * storage (private mode, blocked cookies) degrades to "no history" instead of
 * throwing.
 */

/** The slice of the Web Storage API this module needs. */
export interface RecentStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

const KEY = 'uc-recent';
const MAX = 8;
/** Refuse to persist anything longer than a legal query (parser guard is 200). */
const MAX_LENGTH = 200;

/** Read the stored list, tolerating absent, malformed or foreign values. */
export function readRecent(store: RecentStore | undefined): string[] {
	if (!store) return [];
	try {
		const raw = store.getItem(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((v): v is string => typeof v === 'string')
			.map((v) => v.trim())
			.filter((v) => v.length > 0 && v.length <= MAX_LENGTH)
			.slice(0, MAX);
	} catch {
		return [];
	}
}

/**
 * Put `query` at the front, dropping any earlier occurrence that differs only
 * by case or padding, and cap the list. Returns the new list; storage failures
 * are swallowed so a full or blocked quota can never break a conversion.
 */
export function pushRecent(store: RecentStore | undefined, query: string): string[] {
	const trimmed = query.trim();
	if (trimmed === '' || trimmed.length > MAX_LENGTH) return readRecent(store);
	const key = trimmed.toLowerCase();
	const next = [trimmed, ...readRecent(store).filter((q) => q.toLowerCase() !== key)].slice(0, MAX);
	if (store) {
		try {
			store.setItem(KEY, JSON.stringify(next));
		} catch {
			/* storage full or blocked — the in-memory list is still correct */
		}
	}
	return next;
}

/** Forget everything. */
export function clearRecent(store: RecentStore | undefined): string[] {
	try {
		store?.removeItem(KEY);
	} catch {
		/* ignore */
	}
	return [];
}
