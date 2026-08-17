/**
 * The app version, for display.
 *
 * Deliberately a literal rather than `import pkg from 'package.json'`: that
 * import put the ENTIRE package.json — every script and all 22 devDependencies
 * with their exact ranges — into the client bundle of a public site, to render
 * one string. Kept in step with package.json by a test.
 */
export const APP_VERSION = '0.3.10';
