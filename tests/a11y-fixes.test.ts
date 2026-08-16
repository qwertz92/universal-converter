/**
 * Regression pins for the accessibility defects found by adversarial review.
 *
 * Two kinds of evidence, because this project has no browser in its test setup:
 *  - components are rendered with `svelte/server`, which reaches every element
 *    that exists before the first click (all the disclosure triggers);
 *  - state rules that only exist inside a component are exercised through the
 *    pure helpers those components now share.
 *
 * Each test is named for the concrete failure it prevents.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import type { ConversionResult, ResultGroup } from '$lib/conversion/types';
import InfoPopover from '$lib/components/converter/InfoPopover.svelte';
import Header from '$lib/components/layout/Header.svelte';
import ResultGroupCard from '$lib/components/results/ResultGroupCard.svelte';
import WarningsNote from '$lib/components/results/WarningsNote.svelte';
import { NO_HIGHLIGHT, nextHighlight } from '$lib/components/search/Combobox.svelte';
import { readStored, theme, writeStored, type ThemeStorage } from '$lib/ui/theme.svelte';

// Header reads SvelteKit's request-scoped page state, which does not exist
// outside a request; the nav's active link is not what is under test here.
vi.mock('$app/state', () => ({
	page: { url: new URL('https://universal-converter.org/convert') }
}));

/** Every `aria-controls` value in a rendered fragment, in document order. */
function ariaControls(html: string): string[] {
	return [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
}

function sourceOf(path: string): string {
	return readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
}

/** A component's markup only, so a rule is never "proved" by a code comment. */
function markupOf(path: string): string {
	const source = sourceOf(path);
	return source.slice(source.lastIndexOf('</script>'));
}

function resultFixture(unitId: string): ConversionResult {
	return {
		value: '3.6',
		raw: '3.6',
		unit_id: unitId,
		unit_label: 'MJ',
		category: 'energy',
		exactness: 'exact',
		// A formula is what makes the row's detail disclosure worth rendering.
		formula: `1 kWh × 3.6 = 3.6 MJ (${unitId})`,
		assumptions: [],
		warnings: [],
		source_refs: []
	};
}

describe('aria-expanded without aria-controls', () => {
	// Four disclosures announced "expanded"/"collapsed" without ever saying what
	// they expand, so a screen-reader user was told a state and not a target.

	it("the header's menu button names the nav it opens", () => {
		const html = render(Header).body;
		expect(ariaControls(html)).toHaveLength(1);
	});

	it("the warnings note's toggle names the list it opens", () => {
		const html = render(WarningsNote, {
			props: { warnings: [{ kind: 'gas_billing', severity: 'caution', text: 'Billing basis.' }] }
		}).body;
		expect(ariaControls(html)).toHaveLength(1);
	});

	it("the info popover's (i) button names the panel it opens", () => {
		const html = render(InfoPopover, {
			props: {
				label: 'About heating value basis',
				children: createRawSnippet(() => ({ render: () => '<p>NCV vs GCV.</p>' }))
			}
		}).body;
		expect(ariaControls(html)).toHaveLength(1);
	});

	it('every result row on a page controls its OWN detail panel', () => {
		// The failure a literal id would have caused: eight "Show details"
		// buttons in one group, all pointing at the first row's panel.
		const group: ResultGroup = {
			key: 'energy',
			title: 'Energy',
			results: [resultFixture('megajoule'), resultFixture('gigajoule'), resultFixture('therm')]
		};
		const ids = ariaControls(render(ResultGroupCard, { props: { group } }).body);
		expect(ids).toHaveLength(3);
		expect(new Set(ids).size).toBe(3);
	});
});

describe('the skip link has to move focus, not just the viewport', () => {
	it('<main> is focusable', () => {
		// Without tabindex="-1" several browsers scroll to #main but leave focus
		// in the header, so the next Tab walks back into the nav the user just
		// asked to skip. The layout cannot be server-rendered on its own (it
		// pulls in SvelteKit's request-scoped page state), so this pins the
		// markup instead.
		expect(sourceOf('routes/+layout.svelte')).toMatch(/<main id="main" tabindex="-1"/);
	});
});

describe('the info popover is a disclosure, not a tooltip', () => {
	it('carries no tooltip role on its click-toggled panel', () => {
		// A tooltip is non-interactive, describes its trigger and appears on
		// hover — this panel is click-toggled and holds a link. As a tooltip its
		// content was announced as part of the button's description, and the
		// link inside it was announced as unreachable text. The panel only
		// exists after a click, so the pin is on the source.
		expect(markupOf('lib/components/converter/InfoPopover.svelte')).not.toContain('role=');
	});
});

describe('combobox highlight', () => {
	it('Escape does not leave a rejected option armed for the next Enter', () => {
		// `active` used to survive the close, so re-focusing the field restored a
		// highlight the user had just dismissed — and Enter committed it.
		let active = NO_HIGHLIGHT;
		active = nextHighlight(active, 1, 5); // arrow down to the first option
		active = nextHighlight(active, 1, 5); // and to the second
		expect(active).toBe(1);
		active = NO_HIGHLIGHT; // Escape, as the component's handler now does
		expect(nextHighlight(active, 1, 5)).toBe(0);
	});

	it('arrowing from "nothing highlighted" lands on the first or last option', () => {
		expect(nextHighlight(NO_HIGHLIGHT, 1, 5)).toBe(0);
		// Not the generic wrap-around step, which would land on index 3.
		expect(nextHighlight(NO_HIGHLIGHT, -1, 5)).toBe(4);
	});

	it('wraps at both ends', () => {
		expect(nextHighlight(4, 1, 5)).toBe(0);
		expect(nextHighlight(0, -1, 5)).toBe(4);
	});

	it('an empty list keeps nothing highlighted', () => {
		expect(nextHighlight(2, 1, 0)).toBe(NO_HIGHLIGHT);
	});

	it('announces the option the user arrowed to as the selected one', () => {
		// aria-activedescendant pointed at the highlight while aria-selected
		// marked the committed value, so every option the user arrowed to was
		// announced as "not selected". Options exist only in an open listbox,
		// which needs a browser — so the ARIA 1.2 rule is pinned on the source.
		expect(markupOf('lib/components/search/Combobox.svelte')).toContain(
			'aria-selected={i === active}'
		);
	});
});

describe('theme storage', () => {
	function fakeStore(initial: Record<string, string> = {}): ThemeStorage {
		const data = { ...initial };
		return {
			getItem: (k) => data[k] ?? null,
			setItem: (k, v) => {
				data[k] = v;
			}
		};
	}

	/** A store that throws on every operation (private mode, blocked storage). */
	const hostileStore: ThemeStorage = {
		getItem() {
			throw new Error('blocked');
		},
		setItem() {
			throw new Error('blocked');
		}
	};

	it('round-trips an explicit choice', () => {
		const s = fakeStore();
		writeStored('dark', s);
		expect(readStored(s)).toBe('dark');
	});

	it('falls back to following the OS for absent or foreign values', () => {
		expect(readStored(fakeStore())).toBe('system');
		expect(readStored(fakeStore({ 'uc-theme': 'sepia' }))).toBe('system');
	});

	it('a storage that throws costs the memory of the choice, not the page', () => {
		expect(readStored(hostileStore)).toBe('system');
		expect(() => writeStored('dark', hostileStore)).not.toThrow();
		expect(readStored(undefined)).toBe('system');
		expect(() => writeStored('dark', undefined)).not.toThrow();
	});

	it('survives a browser where reading `localStorage` itself throws', () => {
		// Chrome with all cookies blocked throws a SecurityError on the property
		// access, so `typeof localStorage` was never a guard. init() runs from
		// the root layout, so that one throw took the whole page down.
		const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new Error('SecurityError: access to storage is denied');
			}
		});
		try {
			expect(readStored()).toBe('system');
			expect(() => writeStored('dark')).not.toThrow();
			expect(() => theme.init()).not.toThrow();
		} finally {
			if (original) Object.defineProperty(globalThis, 'localStorage', original);
			else Reflect.deleteProperty(globalThis, 'localStorage');
		}
	});
});
