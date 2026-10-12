/**
 * Arrow-key movement inside a `role="radiogroup"` (WAI-ARIA radio group
 * pattern): Right/Down move on, Left/Up move back, both wrap; Home and End
 * jump to the ends. Returns undefined for any other key, so the caller lets
 * the browser handle it.
 */
export function nextRadioIndex(key: string, current: number, count: number): number | undefined {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return (current + 1) % count;
		case 'ArrowLeft':
		case 'ArrowUp':
			return (current - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return undefined;
	}
}
