/**
 * Learn topics registry (spec §11). Metadata for the 14 required topics: slug,
 * title, one-line summary, an optional live example query to embed, related
 * unit/fuel/source links, and which units/dimensions the topic is relevant to
 * (so unit/fuel detail pages can surface the right Learn links).
 *
 * The prose bodies live in `learn/[slug]/+page.svelte` blocks keyed by slug — see
 * `LEARN_BODY` there. This module is the index + cross-linking source of truth.
 * All numbers referenced in bodies come from the rulebook / units.json only.
 */

export interface LearnTopic {
	slug: string;
	title: string;
	summary: string;
	/** A query to render as a live example on the page (optional). */
	example?: string;
	/** Related unit ids (link to /units/[id]). */
	relatedUnits?: string[];
	/** Related fuel ids (link to /fuels/[id] when present). */
	relatedFuels?: string[];
	/** Source ids to cite (link to /sources#id). */
	sources?: string[];
	/** Dimensions/units this topic explains — used to attach it to detail pages. */
	appliesToUnits?: string[];
}

export const LEARN_TOPICS: LearnTopic[] = [
	{
		slug: 'what-is-energy',
		title: 'What is energy?',
		summary:
			'Energy is the capacity to do work — one quantity, many units (joules, watt-hours, calories, BTU).',
		example: '1 kWh',
		relatedUnits: ['joule', 'kilowatt_hour', 'kilocalorie', 'btu'],
		sources: ['nist-sp811'],
		appliesToUnits: ['joule', 'kilojoule', 'megajoule', 'gigajoule']
	},
	{
		slug: 'kwh-vs-kw',
		title: 'kW vs kWh',
		summary:
			'kW is power (a rate); kWh is energy (a rate over time). You cannot convert one to the other without a duration.',
		relatedUnits: ['kilowatt', 'kilowatt_hour', 'watt', 'megawatt'],
		appliesToUnits: ['watt', 'kilowatt', 'megawatt', 'gigawatt', 'terawatt']
	},
	{
		slug: 'joule-vs-wh',
		title: 'Joule vs watt-hour',
		summary:
			'Both measure energy. 1 Wh = 3600 J exactly, so 1 kWh = 3.6 MJ — a pure, exact identity.',
		example: '1 kWh',
		relatedUnits: ['joule', 'watt_hour', 'kilowatt_hour', 'megajoule'],
		sources: ['nist-sp811'],
		appliesToUnits: ['watt_hour', 'kilowatt_hour', 'megawatt_hour']
	},
	{
		slug: 'btu-and-mmbtu',
		title: 'BTU and MMBTU',
		summary:
			'The British thermal unit and its million-fold multiple, common in US energy and gas markets.',
		example: '1 MMBTU',
		relatedUnits: ['btu', 'kilobtu', 'mmbtu'],
		sources: ['nist-sp811', 'spec-conversion-rules'],
		appliesToUnits: ['btu', 'kilobtu', 'mmbtu']
	},
	{
		slug: 'what-is-a-therm',
		title: 'What is a therm?',
		summary: 'A therm is 100,000 BTU — a billing unit for natural gas, defined by convention.',
		example: '1 therm',
		relatedUnits: ['therm', 'btu', 'mmbtu'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: ['therm']
	},
	{
		slug: 'what-is-a-barrel',
		title: 'What is a barrel?',
		summary:
			'The oil barrel is a volume unit: exactly 42 US gallons. Its energy content is a separate, estimated quantity.',
		example: '1 barrel',
		relatedUnits: ['barrel', 'us_gallon', 'liter'],
		sources: ['nist-sp811'],
		appliesToUnits: ['barrel']
	},
	{
		slug: 'barrel-vs-boe',
		title: 'Barrel vs boe',
		summary:
			'A physical barrel is a volume; a “barrel of oil equivalent” (boe) is a fixed energy convention. They are not the same thing.',
		example: '1 boe',
		relatedUnits: ['barrel', 'boe'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: ['boe', 'barrel']
	},
	{
		slug: 'toe-and-oil-equivalents',
		title: 'toe and oil-equivalent units',
		summary:
			'toe, tce and boe are energy-equivalence conventions, exact by fiat — not measurements of any real oil or coal.',
		example: '1 toe',
		relatedUnits: ['toe', 'tce', 'boe'],
		sources: ['iea-unit-conventions', 'spec-conversion-rules'],
		appliesToUnits: ['toe', 'ktoe', 'mtoe', 'tce', 'boe']
	},
	{
		slug: 'hhv-vs-lhv',
		title: 'HHV/GCV vs LHV/NCV',
		summary:
			'Higher heating value counts the heat of condensing water vapour; lower heating value does not. The gap can be 5–20%.',
		relatedFuels: ['natural-gas', 'hydrogen', 'wood-pellets'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: ['mj_per_kg', 'kwh_per_kg', 'mj_per_m3', 'kwh_per_m3']
	},
	{
		slug: 'natural-gas-m3-to-kwh',
		title: 'Natural gas: m³ to kWh',
		summary:
			'Converting a cubic metre of gas to energy is never exact — it depends on composition and reference conditions.',
		example: '1 m³ natural gas',
		relatedFuels: ['natural-gas'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: ['cubic_meter']
	},
	{
		slug: 'co2-vs-co2e',
		title: 'CO₂ vs CO₂e',
		summary:
			'CO₂ is only carbon dioxide; CO₂e bundles other greenhouse gases by their warming potential. There is no conversion between them.',
		relatedUnits: ['kilogram_co2', 'kilogram_co2e'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: [
			'gram_co2',
			'kilogram_co2',
			'tonne_co2',
			'gram_co2e',
			'kilogram_co2e',
			'tonne_co2e'
		]
	},
	{
		slug: 'why-fuel-conversions-are-approximate',
		title: 'Why fuel conversions are approximate',
		summary:
			'Density, calorific value and emission factors are material properties that vary — so fuel results are sourced estimates, not constants.',
		relatedFuels: ['diesel', 'natural-gas', 'wood-pellets'],
		sources: ['spec-conversion-rules']
	},
	{
		slug: 'electricity-emissions-region-year',
		title: 'Why electricity emissions depend on region and year',
		summary:
			'A kWh of grid electricity has no single carbon factor — it depends on the country, the year and even the time of day.',
		relatedUnits: ['kilowatt_hour', 'g_co2e_per_kwh'],
		sources: ['spec-conversion-rules']
	},
	{
		slug: 'food-calories',
		title: 'Food calories vs technical calories',
		summary:
			'A dietary “Calorie” is a kilocalorie — 1000 small calories. Confusing them is a factor-1000 error.',
		example: '1000 kcal',
		relatedUnits: ['calorie', 'kilocalorie', 'food_calorie'],
		sources: ['spec-conversion-rules'],
		appliesToUnits: ['calorie', 'kilocalorie', 'food_calorie']
	}
];

export const LEARN_BY_SLUG = new Map(LEARN_TOPICS.map((t) => [t.slug, t]));

/** Learn topics relevant to a given unit id (for unit detail pages). */
export function learnForUnit(unitId: string): LearnTopic[] {
	return LEARN_TOPICS.filter((t) => t.appliesToUnits?.includes(unitId));
}

/** Learn topics relevant to a given fuel id (for fuel detail pages). */
export function learnForFuel(fuelId: string): LearnTopic[] {
	return LEARN_TOPICS.filter((t) => t.relatedFuels?.includes(fuelId));
}
