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

// Must match the `--bg` token for each mode in src/routes/layout.css — kept as
// literals here (rather than read from computed styles) so the browser-chrome
// theme-color can be set synchronously from apply(), including on the very
// first toggle before any stylesheet-dependent measurement would be possible.
const LIGHT_BG = '#f8fafb';
const DARK_BG = '#0b1220';

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
	isDark = $state(
		typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
	);

	constructor() {
		// isDark seeds from the class the app.html inline script already applied
		// pre-paint (above), so the very first client render agrees with it —
		// otherwise UI driven by isDark (e.g. ThemeToggle's icon) would render
		// wrong-then-flip once init() runs on mount. mode/full resolution is
		// still corrected in init() once the DOM is available.
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

		// app.html ships two `media`-scoped theme-color tags that only track OS
		// preference. Keep browser chrome (address bar etc.) in sync with the
		// ACTIVE theme too: an override tag with no `media` attribute always
		// matches, so it must be the first matching <meta name="theme-color">
		// in tree order (the browser uses first-match) — prepended, not
		// appended, to win over the two static tags regardless of OS preference.
		let metaEl = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
		if (!metaEl) {
			metaEl = document.createElement('meta');
			metaEl.setAttribute('name', 'theme-color');
			// insertBefore, not prepend: the generated Cloudflare Workers types
			// declare an HTMLRewriter `prepend(content: string)` that shadows the
			// DOM signature in this project's global type space.
			document.head.insertBefore(metaEl, document.head.firstChild);
		}
		metaEl.setAttribute('content', this.isDark ? DARK_BG : LIGHT_BG);
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
