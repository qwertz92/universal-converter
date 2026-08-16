/**
 * Conversion history, stored in the browser only.
 *
 * Two lists, because they answer different needs:
 *  - **recent** is automatic and short-lived: the last handful of conversions,
 *    so going back one step is one click rather than retyping;
 *  - **saved** is deliberate and unbounded-ish: the calculations you want to
 *    come back to, kept until you remove them, each with an optional label.
 *
 * Nothing leaves the device and nothing is derived about the user — the stored
 * value is exactly the text that was typed. Written against a minimal storage
 * interface so the behaviour is unit-testable and so a browser that refuses
 * storage (private mode, blocked cookies) degrades to an in-session list rather
 * than throwing.
 */

/** The slice of the Web Storage API this module needs. */
export interface HistoryStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface SavedEntry {
	/** The query text, exactly as typed. */
	query: string;
	/** Optional user label, e.g. "boiler sizing". */
	label?: string;
}

const RECENT_KEY = 'uc-recent';
const SAVED_KEY = 'uc-saved';
const MAX_RECENT = 8;
const MAX_SAVED = 50;
/** Refuse to persist anything longer than a legal query (parser guard is 200). */
const MAX_LENGTH = 200;

function readJson(store: HistoryStore | undefined, key: string): unknown {
	if (!store) return undefined;
	try {
		const raw = store.getItem(key);
		return raw ? JSON.parse(raw) : undefined;
	} catch {
		return undefined;
	}
}

function write(store: HistoryStore | undefined, key: string, value: unknown): void {
	if (!store) return;
	try {
		store.setItem(key, JSON.stringify(value));
	} catch {
		/* quota or private mode — the in-memory list is still correct */
	}
}

function usableQuery(query: string): string | undefined {
	const trimmed = query.trim();
	if (trimmed === '' || trimmed.length > MAX_LENGTH) return undefined;
	return trimmed;
}

/* ------------------------------------------------------------------ *
 * Recent
 * ------------------------------------------------------------------ */

/** Read the recent list, tolerating absent, malformed or foreign values. */
export function readRecent(store: HistoryStore | undefined): string[] {
	const parsed = readJson(store, RECENT_KEY);
	if (!Array.isArray(parsed)) return [];
	return parsed
		.filter((v): v is string => typeof v === 'string')
		.map((v) => v.trim())
		.filter((v) => v.length > 0 && v.length <= MAX_LENGTH)
		.slice(0, MAX_RECENT);
}

/**
 * Put `query` at the front, dropping any earlier occurrence that differs only
 * by case or padding, and cap the list.
 */
export function pushRecent(store: HistoryStore | undefined, query: string): string[] {
	const trimmed = usableQuery(query);
	if (!trimmed) return readRecent(store);
	const key = trimmed.toLowerCase();
	const next = [trimmed, ...readRecent(store).filter((q) => q.toLowerCase() !== key)].slice(
		0,
		MAX_RECENT
	);
	write(store, RECENT_KEY, next);
	return next;
}

export function clearRecent(store: HistoryStore | undefined): string[] {
	try {
		store?.removeItem(RECENT_KEY);
	} catch {
		/* ignore */
	}
	return [];
}

/* ------------------------------------------------------------------ *
 * Saved
 * ------------------------------------------------------------------ */

/** Read the saved list, tolerating absent, malformed or foreign values. */
export function readSaved(store: HistoryStore | undefined): SavedEntry[] {
	const parsed = readJson(store, SAVED_KEY);
	if (!Array.isArray(parsed)) return [];
	const out: SavedEntry[] = [];
	for (const item of parsed) {
		// Accept the plain-string shape too, so an older stored list still loads.
		if (typeof item === 'string') {
			const q = usableQuery(item);
			if (q) out.push({ query: q });
			continue;
		}
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		if (typeof record.query !== 'string') continue;
		const q = usableQuery(record.query);
		if (!q) continue;
		const label = typeof record.label === 'string' ? record.label.trim().slice(0, 60) : undefined;
		out.push(label ? { query: q, label } : { query: q });
	}
	return out.slice(0, MAX_SAVED);
}

/** True when this exact query (case-insensitively) is already saved. */
export function isSaved(saved: SavedEntry[], query: string): boolean {
	const key = query.trim().toLowerCase();
	return saved.some((e) => e.query.toLowerCase() === key);
}

/** Save a query, or update its label if it is already there. Newest first. */
export function save(store: HistoryStore | undefined, query: string, label?: string): SavedEntry[] {
	const trimmed = usableQuery(query);
	if (!trimmed) return readSaved(store);
	const key = trimmed.toLowerCase();
	const entry: SavedEntry = label?.trim()
		? { query: trimmed, label: label.trim().slice(0, 60) }
		: { query: trimmed };
	const next = [entry, ...readSaved(store).filter((e) => e.query.toLowerCase() !== key)].slice(
		0,
		MAX_SAVED
	);
	write(store, SAVED_KEY, next);
	return next;
}

export function unsave(store: HistoryStore | undefined, query: string): SavedEntry[] {
	const key = query.trim().toLowerCase();
	const next = readSaved(store).filter((e) => e.query.toLowerCase() !== key);
	write(store, SAVED_KEY, next);
	return next;
}

export function clearSaved(store: HistoryStore | undefined): SavedEntry[] {
	try {
		store?.removeItem(SAVED_KEY);
	} catch {
		/* ignore */
	}
	return [];
}
