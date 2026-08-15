/**
 * The displayed version is a literal so that package.json stays out of the
 * client bundle. That trade needs a guard, or the site can silently claim to be
 * a version it is not.
 */

import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '$lib/version';
import pkg from '../package.json';

describe('APP_VERSION', () => {
	it('matches package.json', () => {
		expect(APP_VERSION).toBe(pkg.version);
	});

	it('is a plain semver string', () => {
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
	});
});
