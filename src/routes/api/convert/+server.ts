/**
 * GET /api/convert — public conversion API (DRAFT, roadmap 0.2). Thin wrapper:
 * all behavior lives in the framework-independent handler so it can be tested
 * without SvelteKit. Runs as a Cloudflare Pages Function (Web APIs only).
 */
import type { RequestHandler } from './$types';
import { handleConvertRequest } from '$lib/api/convert-endpoint';

// The one dynamic route in an otherwise fully prerendered app.
export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const { status, body, headers } = handleConvertRequest(url);
	return new Response(JSON.stringify(body, null, 2), { status, headers });
};
