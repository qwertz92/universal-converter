import { describe, expect, it } from 'vitest';
import { PROJECT_NAME } from '$lib';

describe('smoke test', () => {
	it('performs basic arithmetic', () => {
		expect(1 + 1).toBe(2);
	});

	it('resolves the $lib path alias', () => {
		expect(PROJECT_NAME).toBe('Universal Converter');
	});
});
