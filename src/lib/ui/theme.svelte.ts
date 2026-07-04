/**
 * Theme (dark/light) store — UI-only. The initial class is set before paint by
 * the inline bootstrap in app.html; this store keeps the reactive UI in sync and
 * persists the user's explicit choice to localStorage.
 *
 * `mode` is the user's *choice*: 'light' | 'dark' | 'system'. `resolved` is what
 * is actually applied. Toggling cycles between explicit light/dark (a manual
 * toggle, per spec §10), while 'system' follows the OS until the user overrides.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'uc-theme';

function systemPrefersDark(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStored(): ThemeMode {
	if (typeof localStorage === 'undefined') return 'system';
	const v = localStorage.getItem(STORAGE_KEY);
	return v === 'light' || v === 'dark' ? v : 'system';
}

class ThemeStore {
	mode = $state<ThemeMode>('system');
	/** Whether dark is currently applied. Derived from mode + OS preference. */
	isDark = $state(false);

	constructor() {
		// Values are corrected in init() once the DOM is available.
	}

	/** Call once from the root layout (client only). */
	init(): void {
		this.mode = readStored();
		this.isDark = this.mode === 'system' ? systemPrefersDark() : this.mode === 'dark';
		this.apply();

		// Follow OS changes while in 'system' mode.
		if (typeof window !== 'undefined') {
			const mq = window.matchMedia('(prefers-color-scheme: dark)');
			mq.addEventListener('change', (e) => {
				if (this.mode === 'system') {
					this.isDark = e.matches;
					this.apply();
				}
			});
		}
	}

	private apply(): void {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('dark', this.isDark);
		document.documentElement.style.colorScheme = this.isDark ? 'dark' : 'light';
	}

	/** Manual toggle: flips to an explicit light/dark and persists it. */
	toggle(): void {
		this.isDark = !this.isDark;
		this.mode = this.isDark ? 'dark' : 'light';
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, this.mode);
		this.apply();
	}
}

export const theme = new ThemeStore();
