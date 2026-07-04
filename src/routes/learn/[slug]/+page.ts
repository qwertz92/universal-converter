import { error } from '@sveltejs/kit';
import { LEARN_TOPICS, LEARN_BY_SLUG } from '$lib/content/learn';
import { LEARN_BODIES } from '$lib/content/learn-bodies';
import { resolveSources } from '$lib/ui/engine';
import type { EntryGenerator } from './$types';

export const prerender = true;

/** One page per learn topic. */
export const entries: EntryGenerator = () => LEARN_TOPICS.map((t) => ({ slug: t.slug }));

export function load({ params }: { params: { slug: string } }) {
	const topic = LEARN_BY_SLUG.get(params.slug);
	if (!topic) throw error(404, `Unknown learn topic: ${params.slug}`);
	return {
		topic,
		body: LEARN_BODIES[topic.slug] ?? '',
		sources: resolveSources(topic.sources)
	};
}
