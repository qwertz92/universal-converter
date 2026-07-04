/**
 * Static-site generation (spec §10): prerender every route. The converter runs
 * client-side on the prerendered shell, so no server runtime is needed and the
 * whole app deploys to Cloudflare Pages as static assets.
 */
export const prerender = true;

/** Trailing-slash-free canonical URLs. */
export const trailingSlash = 'never';
