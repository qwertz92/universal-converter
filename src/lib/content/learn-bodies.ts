/**
 * Learn article bodies (spec §11). HTML fragments, hand-written from
 * docs/conversion-rules.md + docs/accuracy-and-limitations.md ONLY. Every number
 * here is a definitional constant from those documents. Rendered via {@html} from
 * this trusted in-repo source (not user input).
 */
export const LEARN_BODIES: Record<string, string> = {
	'what-is-energy': `<p>Energy is the capacity to do work. Lifting a weight, heating a room, driving a motor, powering a laptop — physically these are all the same quantity being moved around and transformed. Because it is <em>one</em> quantity, it can be expressed in many interchangeable units: joules, watt-hours, calories, British thermal units, and larger industrial units built on top of those.</p>
<h2>One quantity, many units</h2>
<p>The SI unit of energy is the <strong>joule</strong> (J). Every other energy unit is defined against it by a fixed factor. A watt-hour is exactly <code>3600 J</code>; a kilowatt-hour is exactly <code>3.6 MJ</code>. These are not measurements or approximations — they are <em>definitions</em>, so converting between them is <strong>exact</strong>. See <a href="/learn/joule-vs-wh">joule vs watt-hour</a> for why that particular identity is exact rather than merely close.</p>
<p>Because the conversions are definitional, the tool marks pure energy-unit conversions as <em>exact</em>. No source is needed beyond the definition itself, and no material assumption enters the calculation. You can move a value freely between <a href="/units/joule">joule</a>, <a href="/units/kilowatt_hour">kilowatt-hour</a>, <a href="/units/megajoule">megajoule</a> and the rest without losing anything.</p>
<h2>Energy units are exact; fuel content is not</h2>
<p>There is a crucial distinction the tool never blurs. Converting between energy <em>units</em> is exact. But asking how much energy is <em>in</em> a physical thing — a litre of diesel, a cubic metre of natural gas, a kilogram of wood — is a different question entirely. That answer depends on a material property (a heating value) that genuinely varies with blend, composition, moisture and temperature. Those results are sourced estimates, not exact identities.</p>
<p>So <code>1 kWh = 3.6 MJ</code> is exact forever, but "1 litre of diesel = X kWh" is a representative, sourced figure with its assumptions on display. Keeping these two kinds of answer visibly separate is a core design rule; read <a href="/learn/why-fuel-conversions-are-approximate">why fuel conversions are approximate</a> for the reasoning.</p>
<h2>What the tool does with this</h2>
<p>Every result carries an <em>exactness</em> label so you always know which kind of answer you are looking at: an exact unit identity, a value fixed by convention, a sourced estimate, or a figure that needs more context before it can be computed at all. When a number comes from data rather than a definition, its provenance is one click away on the <a href="/sources">sources</a> panel. The goal is never to hide uncertainty behind a confident-looking number — an energy converter that conceals its assumptions is worse than useless.</p>`,

	'kwh-vs-kw': `<p>The single most common mistake in energy arithmetic is treating power as if it were energy — reading <code>1 kW</code> as though it meant <code>1 kWh</code>. They are different physical quantities, and the tool will not silently convert one to the other.</p>
<h2>Power is a rate; energy is an amount</h2>
<p><strong>Power</strong> (watts, kilowatts, megawatts) is a <em>rate</em> — how fast energy is delivered or consumed at an instant. <strong>Energy</strong> (joules, watt-hours, kilowatt-hours) is an <em>amount</em> — the total moved over some span of time. A 2 kW heater running for 3 hours consumes 6 kWh; the same heater tells you nothing about total energy until you also say <em>for how long</em>.</p>
<p>The relationship is simply energy = power × time (<code>E = P · t</code>). Given any two of the three you can find the third, but you genuinely need two. See <a href="/learn/joule-vs-wh">joule vs watt-hour</a> for how the energy side of that equation is built.</p>
<h2>Why the tool refuses kW → kWh without a duration</h2>
<p>Converting <a href="/units/kilowatt">kilowatts</a> to <a href="/units/kilowatt_hour">kilowatt-hours</a> is a cross-dimension bridge from power to energy, and that bridge <em>requires a time input</em>. Without one, the tool does not guess and does not fail — it returns a <em>context required</em> result and offers you a time field. This is deliberate: "1 kW → kWh with no time" is a well-defined question the moment you add a duration, so the honest response is to ask for it rather than fabricate a number.</p>
<p>Once you supply a time, the arithmetic itself is exact: <code>2 kW × 3 h = 6 kWh</code>. The displayed precision is still bounded by how precise your inputs were, but the multiplication introduces no material assumption.</p>
<h2>Defining "year" for time arithmetic</h2>
<p>Time arithmetic hides an ambiguity: how long is a "year"? Silently using 365, 365.25 or 360 days would make results irreproducible. The tool fixes the <strong>Julian year</strong> = <code>365.25 days</code> = <code>31,557,600 s</code> and labels it, so a conversion like average power over a year is documented and repeatable. An hour is likewise exactly <code>3600 s</code>. These time definitions are exact; it is only the crossing between power and energy that needs your duration.</p>`,

	'joule-vs-wh': `<p>The joule and the watt-hour both measure <a href="/learn/what-is-energy">energy</a> — they are the same physical quantity in two different units. Converting between them is one of the cleanest, most exact conversions the tool performs.</p>
<h2>The exact identity</h2>
<p>A watt is one joule per second. An hour is exactly <code>3600 seconds</code>. So a watt-hour — one watt sustained for one hour — is exactly:</p>
<ul>
<li><code>1 Wh = 3600 J</code></li>
<li><code>1 kWh = 3.6 MJ</code></li>
</ul>
<p>Follow the chain: <code>1 kWh = 1000 Wh = 1000 × 3600 J = 3,600,000 J = 3.6 MJ</code>. Every step multiplies by a defined integer, so there is no rounding and no measurement anywhere.</p>
<h2>Why this is exact, not approximate</h2>
<p>This identity is <strong>exact</strong> because it follows entirely from definitions. The second is an SI base unit, the joule is defined from SI base units, the watt is one joule per second by definition, and the hour is exactly 3600 seconds by definition. Nothing here is measured or blended, so nothing varies. The tool labels this kind of result <em>exact</em> and shows it to full precision (capped only by the display setting), with no <code>~</code> marker — adding a tilde would imply a false doubt that does not exist.</p>
<p>Contrast that with a fuel question. "How much energy is in a cubic metre of natural gas?" also produces a number in joules or kilowatt-hours, but that number depends on the gas composition and is a sourced estimate, not an exact identity. The arithmetic joule↔watt-hour is exact; the <em>content</em> of a physical fuel is not.</p>
<h2>Practical consequences</h2>
<p>Because the factor is exact, you can round-trip freely: convert <a href="/units/kilowatt_hour">kWh</a> to <a href="/units/joule">joules</a> to <a href="/units/megajoule">megajoules</a> and back with no drift. This is also why an electricity meter reading in kWh maps cleanly onto scientific energy units — the units differ, the energy does not. Just remember that a kilowatt-<em>hour</em> is energy, while a kilowatt is power; if you find yourself trying to convert a plain kilowatt into a kilowatt-hour, see <a href="/learn/kwh-vs-kw">kW vs kWh</a>, because that step needs a duration and is not a unit conversion at all.</p>`,

	'btu-and-mmbtu': `<p>The British thermal unit (BTU) is an energy unit rooted in the heat needed to warm water. It is small and old-fashioned by SI standards, but it remains deeply embedded in US energy and natural-gas markets, so the tool supports it and its common multiples.</p>
<h2>The definitions the tool uses</h2>
<p>There is more than one BTU in circulation, differing slightly in how the underlying calorie is defined. The tool fixes the <strong>International Table (IT) BTU</strong>:</p>
<ul>
<li><code>1 BTU_IT = 1055.05585262 J</code></li>
<li><code>1 MMBTU = 10^6 BTU_IT</code> (one million BTU)</li>
</ul>
<p>These are treated as fixed by convention: the number is exact <em>by fiat</em>, and the tool labels the BTU basis on the unit's detail page so there is no ambiguity about which BTU is meant.</p>
<h2>What "MM" means</h2>
<p>The "MM" in <a href="/units/mmbtu">MMBTU</a> is a frequent source of confusion. It does <strong>not</strong> mean "milli-milli" or anything metric. It is the Roman-numeral convention where <code>M</code> is one thousand, so <code>MM</code> is a thousand thousands — one million. An MMBTU is therefore <code>1,000,000</code> BTU, the standard wholesale trading unit for natural gas and other fuels in the United States. The <a href="/units/kilobtu">kBTU</a> (a thousand BTU) is common in building-energy contexts.</p>
<h2>IT versus thermochemical BTU</h2>
<p>The main alternative is the <em>thermochemical</em> BTU, which is very slightly smaller than the IT BTU. The tool deliberately does not mix the two: it uses the IT BTU throughout so that the BTU, the <a href="/learn/what-is-a-therm">therm</a> and the quad all cohere and chained conversions never pick up incoherent factors. The difference between the two BTU definitions is tiny — comparable to the roughly 0.07% gap between the IT and thermochemical calorie — but silently mixing them would still produce subtly wrong results, so a single labeled convention is chosen instead.</p>
<h2>Bigger multiples</h2>
<p>Built on the IT BTU are the larger units used in gas billing and national energy statistics: the <a href="/learn/what-is-a-therm">therm</a> (100,000 BTU), the MMBTU (a million BTU, = 10 therms), and the quad (<code>10^15 BTU_IT</code>) used for whole-country energy budgets. Because all of these share the same BTU definition, converting among them is exact and consistent.</p>`,

	'what-is-a-therm': `<p>The therm is a unit of energy you will meet mainly on natural-gas bills. It exists for convenience in billing, not because it corresponds to anything fundamental in physics — it is a convention layered on top of the <a href="/learn/btu-and-mmbtu">British thermal unit</a>.</p>
<h2>The definition</h2>
<p>The tool uses the <strong>US therm</strong>, defined as:</p>
<ul>
<li><code>1 therm = 100,000 BTU_IT</code></li>
<li><code>≈ 1.0550559 × 10^8 J</code> (that is <code>10^5 × 1055.05585262 J</code>)</li>
<li><code>= 0.1 MMBTU</code> (one tenth of a million BTU)</li>
</ul>
<p>Because the therm is built directly on the IT BTU, converting a therm to <a href="/units/btu">BTU</a>, <a href="/units/mmbtu">MMBTU</a> or joules is <strong>exact</strong> — the number is fixed by convention, not measured.</p>
<h2>A billing unit, not a physical constant</h2>
<p>The therm rounds off to a tidy hundred-thousand BTU precisely because it was designed as a billing unit. That tidiness is a matter of convention, not physics: there is nothing in nature that prefers 100,000 BTU. The tool labels the therm as a defined convention (it also notes that a European therm exists and differs only at about the <code>10^-5</code> level; the US therm is used as the default and labeled on the unit page).</p>
<h2>Why a therm is not the same as "a therm of gas"</h2>
<p>A therm is an amount of <em>energy</em>. Your gas meter, however, measures <em>volume</em> (cubic metres or cubic feet), and the supplier multiplies that volume by a calorific value to arrive at the energy you are billed for. So converting the gas volume on your meter into therms is not the exact operation that converting therms to BTU is — it depends on the gas composition and on reference conditions, and it can never reproduce your bill exactly. See <a href="/learn/natural-gas-m3-to-kwh">natural gas: m³ to kWh</a> for why that volume-to-energy step is always an estimate, and <a href="/units/therm">the therm unit page</a> for the exact energy-unit conversions.</p>`,

	'what-is-a-barrel': `<p>The oil barrel is a <strong>volume</strong> unit — nothing more. It is a common source of confusion precisely because people slide from "a barrel of oil" (a volume) to "the energy in a barrel of oil" (a completely different, estimated quantity). The tool keeps these strictly apart.</p>
<h2>The exact definition</h2>
<p>The oil barrel is defined as exactly:</p>
<ul>
<li><code>1 barrel = 42 US gallons = 158.987294928 L</code></li>
</ul>
<p>This is a pure, <strong>exact</strong> volume identity. You can convert a barrel to <a href="/units/us_gallon">US gallons</a>, <a href="/units/cubic_meter">cubic metres</a> or litres with no assumptions at all, just as you would any other volume.</p>
<h2>US gallon, not imperial gallon</h2>
<p>The "42 gallons" in the definition means <strong>US</strong> gallons specifically. This matters, because the US gallon and the imperial (UK) gallon are noticeably different:</p>
<ul>
<li>US gallon ≈ <code>3.785 L</code></li>
<li>Imperial gallon ≈ <code>4.546 L</code></li>
</ul>
<p>Using one gallon where the other is meant is roughly a 20% error, which would then poison every barrel and fuel-volume result downstream. The tool therefore keeps <a href="/units/us_gallon">us_gallon</a> and <a href="/units/imperial_gallon">imperial_gallon</a> as separate units, and defines the barrel via US gallons explicitly. A bare "gallon" is treated as ambiguous and disambiguated (defaulting to US, always labeled) rather than silently guessed.</p>
<p>Because the barrel is defined via US gallons, the tool converts freely within the volume dimension but never assumes the barrel "contains" any particular energy. That step needs a fuel, a density and a heating value, and it is treated as a separate calculation with its own, non-exact answer.</p>
<h2>Volume is not energy</h2>
<p>A barrel is a container size; how much <em>energy</em> that volume holds depends on what is in it. The energy content of one physical barrel of crude oil is a <em>separate, estimated</em> quantity that varies with the crude grade — it is not baked into the volume definition. A light, high-value crude and a heavy one occupy the same 42-gallon barrel but carry different amounts of energy, which is why the tool reports a physical barrel's energy as a range with a leading <code>~</code> rather than a single exact number.</p>
<p>Do not confuse the volume "barrel" with the energy-equivalence unit "barrel of oil equivalent" (boe): they live in different dimensions. The barrel is a volume; the boe is a fixed energy convention. See <a href="/learn/barrel-vs-boe">barrel vs boe</a> for that distinction, which is one of the classic pitfalls in energy reporting, and <a href="/sources">sources</a> for the provenance behind any estimated crude-energy figure.</p>`,

	'barrel-vs-boe': `<p>"Barrel" and "barrel of oil equivalent" (boe) sound almost identical, but they are fundamentally different kinds of quantity. Treating one as the other is a well-known error in oil-and-gas reporting, and the tool is built to prevent it.</p>
<h2>Two different dimensions</h2>
<ul>
<li>A <strong><a href="/learn/what-is-a-barrel">barrel</a></strong> is a unit of <em>volume</em>: exactly <code>42 US gallons = 158.987294928 L</code>. It measures how much space a liquid occupies.</li>
<li>A <strong>boe</strong> is a unit of <em>energy</em>, fixed by convention. It exists to express quantities of gas, coal or other fuels "in oil terms" for reporting.</li>
</ul>
<p>Because one is a volume and the other is an energy, there is no direct conversion between them. Turning a physical barrel into an energy figure requires a fuel and a heating value — it is not a unit conversion.</p>
<h2>The boe convention this tool uses</h2>
<p>The tool adopts the widely-cited US convention:</p>
<ul>
<li><code>1 boe = 5.8 MMBTU ≈ 6.1 GJ</code> (the "5.8 MMBTU convention")</li>
</ul>
<p>This is a <em>standard definition</em>: the number is exact by fiat. Every boe result states "boe (5.8 MMBTU convention)" and notes that other conventions exist, so a boe figure taken from a different source may differ by a few percent. It is a bookkeeping unit, not a measurement of any real barrel.</p>
<h2>The physical barrel of crude is a separate, estimated quantity</h2>
<p>Critically, the <em>actual</em> energy content of one physical barrel of crude oil is <strong>not</strong> the same as boe. It depends on the crude's grade and API gravity, and working it out needs a density — which this catalog does not have for crude oil, because no primary source for one was found. So a barrel of crude answers <em>not available</em> for mass and energy rather than borrowing the boe number or quoting a range nobody published. The fixed <code>~6.1 GJ</code> boe convention remains what it always was: a definition, not a measurement of any particular oil.</p>
<p>So the tool never presents a specific crude's energy as exactly "boe", and never presents boe as the measured energy of the particular oil in question. For the family of oil-equivalent energy conventions (boe, toe, tce) and how they relate, see <a href="/learn/toe-and-oil-equivalents">toe and oil-equivalent units</a>.</p>`,

	'toe-and-oil-equivalents': `<p>Energy statistics often express everything "in oil terms" or "in coal terms" so that gas, electricity, coal and oil can be added up on one scale. The units that do this — <strong>toe</strong>, <strong>tce</strong> and <strong>boe</strong> — are energy-equivalence conventions. They are exact by definition, but they are <em>not</em> properties of any real barrel, tonne of oil, or tonne of coal.</p>
<h2>The definitions</h2>
<ul>
<li><strong>toe</strong> (tonne of oil equivalent): <code>1 toe = 41.868 GJ</code> — the IEA/OECD convention.</li>
<li><strong>tce</strong> (tonne of coal equivalent): <code>1 tce = 29.3076 GJ</code>.</li>
<li><strong>boe</strong> (barrel of oil equivalent): <code>1 boe = 5.8 MMBTU ≈ 6.1 GJ</code> (the US "5.8 MMBTU convention"; see <a href="/learn/barrel-vs-boe">barrel vs boe</a>).</li>
</ul>
<p>From the first two you get the exact relation <code>1 toe = 1.428571… tce</code>. The tool marks all of these as <em>standard definition</em>: the arithmetic is exact, but each unit stands for a <em>convention</em>, not a measured property.</p>
<h2>Exact by fiat, not by nature</h2>
<p>The toe was fixed historically from a net calorific value of about ten million kilocalories, but that origin is now just a round number in a definition. No real tonne of oil is guaranteed to hold exactly 41.868 GJ, and no real tonne of coal exactly 29.3076 GJ — actual fuels vary. The convention deliberately freezes a single figure so that international energy balances are consistent and comparable. That is its purpose and also its limitation.</p>
<h2>Equivalence units versus real fuel</h2>
<p>Because these are conventions, the tool treats them very differently from the energy content of a <em>physical</em> fuel. Converting <a href="/units/toe">toe</a>, <a href="/units/tce">tce</a> or <a href="/units/boe">boe</a> to <a href="/units/gigajoule">gigajoules</a> is exact. But asking how much energy is in an actual tonne of a specific coal, or an actual barrel of a specific crude, is a sourced estimate that varies with grade and moisture — a different question with a different, hedged answer. The tool never presents the energy-equivalence convention as if it were a measurement of the real fuel, and always labels which convention a result uses.</p>`,

	'hhv-vs-lhv': `<p>Almost every fuel-energy figure comes in two flavours that differ by several percent, and confusing them is one of the most consequential errors in this domain. The two flavours are the <strong>higher heating value</strong> and the <strong>lower heating value</strong>.</p>
<h2>The two bases</h2>
<ul>
<li><strong>Higher / gross heating value</strong> — HHV, also GCV; in German, <em>Brennwert</em>. It <em>includes</em> the latent heat released when the water vapour produced by combustion condenses back to liquid.</li>
<li><strong>Lower / net heating value</strong> — LHV, also NCV; in German, <em>Heizwert</em>. It <em>excludes</em> that latent heat, assuming the water leaves as vapour and its heat is not recovered.</li>
</ul>
<p>The higher value is always the larger of the two, because it counts extra heat the lower value ignores. The size of the gap depends on how much hydrogen and moisture the fuel contains — the more water vapour combustion produces, the wider the gap.</p>
<h2>How big is the gap?</h2>
<ul>
<li>For natural gas, HHV exceeds LHV by roughly <code>~5–6%</code>.</li>
<li>For hydrogen and wet biomass, the gap can reach <code>~10–20%</code>.</li>
</ul>
<p>These are not rounding errors — a 5–20% swing changes a result meaningfully. Quoting a value on one basis while the reader assumes the other is a real mistake, not a nuance.</p>
<h2>How the tool handles it</h2>
<p>The tool <strong>defaults to LHV/NCV</strong>, the dominant convention in international energy statistics (the IEA/OECD balances and the <a href="/learn/toe-and-oil-equivalents">toe definition</a> itself are on a net basis). Beyond that:</p>
<ol>
<li>Every fuel-energy result <strong>labels its basis</strong> — the basis is never omitted.</li>
<li>Where the data has an HHV/GCV value too, it is shown alongside as a labeled secondary figure, never mixed in silently.</li>
<li>The tool <strong>never derives one basis from the other</strong> by a generic factor, because the LHV→HHV gap depends on the specific fuel. If only one basis is in the data, the other is shown as "not available".</li>
</ol>
<h2>Why it matters for bills</h2>
<p>Conventions clash in the real world. UK gas billing and DESNZ/DEFRA guidance default to the <em>gross</em> (GCV/HHV) basis, so the energy on a UK gas bill is gross even though many emission factors are published per gigajoule on a net basis. That kind of mismatch is exactly what the tool surfaces rather than hides. See <a href="/learn/natural-gas-m3-to-kwh">natural gas: m³ to kWh</a> and <a href="/learn/why-fuel-conversions-are-approximate">why fuel conversions are approximate</a> for how basis interacts with the rest of the fuel calculation.</p>`,

	'natural-gas-m3-to-kwh': `<p>"How many kilowatt-hours are in a cubic metre of natural gas?" feels like it should have one clean answer. It does not — and the tool will never present it as an exact identity. Two independent problems make it fundamentally an estimate.</p>
<h2>Problem one: composition varies</h2>
<p>Natural gas is a mixture, and its makeup — the methane fraction, heavier hydrocarbons, and inert gases like CO₂ and nitrogen — varies by field, by network, and over time. Since the energy content follows the composition, the calorific value moves across a band. For typical pipeline gas that band sits roughly in the <code>~10–11 kWh/m³</code> range (roughly, per the data), but no single figure is correct for all gas. This is the core reason a cubic metre of gas has no exact energy value.</p>
<h2>Problem two: volume needs reference conditions</h2>
<p>A cubic metre of gas is not a fixed amount of gas — gas expands and contracts with temperature and pressure. So a volume is meaningless without stated <em>reference conditions</em>:</p>
<ul>
<li><strong>Normal cubic metre</strong> (Nm³) — measured at 0 °C.</li>
<li><strong>Standard cubic metre</strong> (Sm³) — measured at 15 °C or 25 °C, depending on the standard.</li>
<li>The gas in your meter is at <em>operating</em> conditions, different again.</li>
</ul>
<p>The tool interprets "m³ natural gas" as a normal cubic metre at a stated, displayed reference condition, and labels which condition is used. It never assumes Nm³ and Sm³ are interchangeable.</p>
<h2>How a real bill is computed — and why the tool cannot reproduce it</h2>
<p>Your supplier does not use a generic figure. They multiply your metered volume by the local calorific value (the <em>Brennwert</em>) and by a <em>Zustandszahl</em> (a state/correction factor) that maps your operating-condition cubic metres to reference-condition energy. The tool knows neither your local Brennwert nor your meter's Zustandszahl.</p>
<p>So every gas volume-to-energy result carries a mandatory warning: it uses a single displayed volumetric-energy assumption at a stated reference condition and on a labeled <a href="/learn/hhv-vs-lhv">heating-value basis</a>, and it <strong>cannot reproduce your gas bill</strong>. Use it to build intuition, never for a billing dispute. The result is marked <em>source based</em>, never exact — closely related to the <a href="/learn/what-is-a-therm">therm</a>, which is the energy unit these gas bills are often expressed in.</p>`,

	'co2-vs-co2e': `<p>Two greenhouse-gas metrics look nearly identical on the page but mean different things: <strong>CO₂</strong> and <strong>CO₂e</strong>. The tool treats them as separate quantities with <em>no</em> conversion path between them, and this is one of its firmest rules.</p>
<h2>What each one means</h2>
<ul>
<li><strong>CO₂</strong> is carbon dioxide only — the mass of that one gas.</li>
<li><strong>CO₂e</strong> ("carbon dioxide equivalent") bundles multiple greenhouse gases — CO₂ plus methane (CH₄), nitrous oxide (N₂O) and others — each converted to a CO₂-equivalent mass using its global warming potential (GWP).</li>
</ul>
<p>CO₂e is therefore <em>not</em> "more CO₂". It is a different metric that happens to be denominated in CO₂-equivalent units. There is no factor that turns one into the other in general, because the uplift depends entirely on the mix of other gases involved.</p>
<h2>No conversion, ever</h2>
<p>The tool keeps <a href="/units/kilogram_co2">CO₂</a> and <a href="/units/kilogram_co2e">CO₂e</a> as separate pseudo-dimensions with no path between them. If a source provides only CO₂, the result shows CO₂ and marks CO₂e "not available" — it never invents an uplift. It will refuse to convert a CO₂ figure to CO₂e or vice versa, explaining why. And because CO₂e depends on which GWP set was used (for example IPCC AR5 versus AR6, or 100-year versus 20-year horizons), comparing CO₂e figures from sources with different GWP sets is not apples-to-apples; the tool reports the source's stated GWP set where it is known.</p>
<h2>Scope matters as much as the number</h2>
<p>An emission figure is meaningless without its <em>system boundary</em>. The same fuel can be reported as direct combustion only, or as Scope 1 / 2 / 3, or well-to-tank, tank-to-wheel, or full well-to-wheel. Every emission result therefore states its metric, scope, energy <a href="/learn/hhv-vs-lhv">basis</a>, region and year together — a bare "kg CO₂" with none of that context is not something the tool will emit.</p>
<h2>Two special cases</h2>
<ul>
<li><strong>Biogenic CO₂</strong> (from wood, ethanol, biodiesel, biogas) is reported on its own labeled line, outside the main scopes — never silently zeroed inside a fossil total. The carbon really is emitted at the stack; the separate accounting reflects the biological carbon cycle, not zero physical emission.</li>
<li><strong>Hydrogen combustion</strong> produces <code>CO₂ = 0</code>, a genuine physical fact (there is no carbon in H₂), shown with a "combustion only" label. But upstream emissions from producing that hydrogen are <em>not</em> zero — they depend on the production pathway and are context-required, never silently attached.</li>
</ul>
<p>For grid electricity, the emission factor also depends on where and when the power was made; see <a href="/learn/electricity-emissions-region-year">why electricity emissions depend on region and year</a>.</p>`,

	'why-fuel-conversions-are-approximate': `<p>When the tool converts between energy <em>units</em>, the answer is exact. When it tells you the energy or emissions of an actual <em>fuel</em>, the answer is a sourced estimate. This is not sloppiness — it reflects the fact that fuels are real materials whose properties genuinely vary.</p>
<h2>Three properties that vary</h2>
<p>Every fuel calculation rests on one or more material properties, none of which is a natural constant:</p>
<ul>
<li><strong>Density</strong> (for volume ↔ mass). Refinery blend, additives, seasonal grade and especially <em>temperature</em> move a fuel's density by a few percent — density falls as temperature rises, so a "kg per litre" figure is only right near the reference temperature the source used.</li>
<li><strong>Calorific value</strong> (for mass or volume → energy). This depends on composition and moisture, and it comes in two <a href="/learn/hhv-vs-lhv">bases (HHV vs LHV)</a> that themselves differ by several percent.</li>
<li><strong>Emission factors</strong> (for fuel → <a href="/learn/co2-vs-co2e">CO₂ / CO₂e</a>). These depend on the fuel, the energy basis, the scope, the region and the year.</li>
</ul>
<h2>Where the spread comes from</h2>
<ul>
<li><strong>Diesel and gasoline:</strong> blend, additives, seasonal grade and temperature shift density and heating value.</li>
<li><strong>Natural gas:</strong> composition varies by field, network and time, spreading the calorific value across a band — the reason <a href="/learn/natural-gas-m3-to-kwh">m³ → kWh is never exact</a>.</li>
<li><strong>Coal:</strong> "coal" spans anthracite, hard coal, sub-bituminous and lignite, whose heating values differ by a factor of two or more; the tool treats named grades as separate fuels rather than one "coal".</li>
<li><strong>Wood and pellets:</strong> energy content is dominated by moisture — oven-dry wood carries substantially more usable energy per kilogram than freshly felled "green" wood, because the water must be evaporated first.</li>
</ul>
<h2>What the tool gives you instead</h2>
<p>For these fuels the tool provides a <strong>well-sourced representative value with its assumptions on display</strong> — not a measurement of the specific fuel in your tank, pipe or pile. Concretely, that means it prefers ranges over false precision (showing <code>~A–B</code> where a property genuinely spans a range), caps significant figures so an estimate never looks more certain than it is, marks estimates with a leading <code>~</code>, and never silently averages two sources that disagree — it shows the chosen source's value with provenance, or the range across sources, with the divergence visible. Every non-exact factor resolves to a citation on the <a href="/sources">sources</a> panel. The point is honesty about spread, not the illusion of a single perfect number.</p>`,

	'electricity-emissions-region-year': `<p>Ask "how much CO₂e does a kilowatt-hour of electricity cause?" and there is no single correct answer. Unlike a fuel with a physical carbon content, grid electricity's emissions depend on <em>how the power was generated</em> — which changes with place and time.</p>
<h2>Three things the answer depends on</h2>
<ul>
<li><strong>Region.</strong> A kWh from a hydro- or nuclear-heavy grid carries a fraction of the emissions of a kWh from a coal-heavy grid. There is no global factor.</li>
<li><strong>Year.</strong> Grids decarbonise (or occasionally re-carbonise) over time, so last decade's factor is not this year's.</li>
<li><strong>Time of day.</strong> Even within a region and year, the mix shifts hour to hour as demand and renewable output change.</li>
</ul>
<p>Because of this, a single "electricity → CO₂e" number with no context would be confidently wrong for almost everyone.</p>
<h2>What the tool does: context required</h2>
<p>With no region and year supplied, converting <a href="/units/kilowatt_hour">kWh electricity</a> to <a href="/units/kilogram_co2e">CO₂e</a> returns <strong>context required</strong> — not a number, and not "unsupported". The result:</p>
<ol>
<li>explains that grid carbon intensity depends on region, year and even time of day;</li>
<li>surfaces a <strong>region + year picker</strong> so you can pin down the context;</li>
<li>where illustrative factors exist in the data, shows one or more <em>clearly-labeled example</em> outputs — each tagged as an illustrative example, not a default, with its region, year and source, visually separated from computed results.</li>
</ol>
<p>Once you supply a region and year and a cited factor exists, the tool returns a normal <em>region- and year-specific</em> value carrying that label and its source.</p>
<h2>No default — only cited combinations</h2>
<p>The tool never assumes a country for you, and that does not change as the catalog grows: without a region and year, a kWh → CO₂e query stays <em>context required</em>, because baking in a single national number would invite exactly the false-precision error the tool exists to avoid. What grows instead is the <strong>picker</strong> — it lists every region/year combination that has a cited factor, and only those combinations return a real <em>region- and year-specific</em> result. Today that means <strong>UK 2025</strong> (CO₂e, DESNZ) and <strong>EU-27 2023</strong> and <strong>EU-27 2022</strong> (CO₂, EEA) — two EU years shown side by side precisely so the year-dependence of grid intensity is visible, not just claimed. Ask for a region or year the catalog has no source for, and it still says so plainly rather than estimating one. For the deeper distinction between the metrics involved here, see <a href="/learn/co2-vs-co2e">CO₂ vs CO₂e</a>.</p>`,

	'food-calories': `<p>The word "calorie" hides a thousandfold ambiguity that regularly turns up in nutrition, cooking and casual science. Getting it wrong is not a rounding error — it is a factor-1000 mistake.</p>
<h2>Big-C Calorie versus small-c calorie</h2>
<ul>
<li>The dietary <strong>"Calorie"</strong> (capital C), the one on food labels, is actually a <em>kilocalorie</em>: <code>1 Cal = 1 kcal = 4186.8 J</code>.</li>
<li>The scientific small <strong>"calorie"</strong> (lower-case c) is a thousand times smaller: <code>1 cal_IT = 4.1868 J</code>.</li>
</ul>
<p>So a "300-Calorie" snack contains 300 kilocalories — not 300 small calories. Reading the label's Calorie as a small calorie (or vice versa) is off by a factor of 1000, which is why the tool is careful to confirm which one you mean.</p>
<h2>The definitions the tool uses</h2>
<p>The tool fixes the <strong>International Table (IT)</strong> calorie throughout:</p>
<ul>
<li><code>1 cal_IT = 4.1868 J</code></li>
<li><code>1 kcal = 4186.8 J</code></li>
<li><code>1 Cal (food) = 1 kcal = 4186.8 J</code></li>
</ul>
<p>These are treated as a <em>standard definition</em> — exact by convention. (There is also a slightly different <em>thermochemical</em> calorie of <code>4.184 J</code>, about 0.07% smaller; the tool uses the IT calorie consistently and labels it, so it stays coherent with the <a href="/learn/btu-and-mmbtu">IT BTU</a> and the therm rather than mixing incompatible factors.)</p>
<h2>How the tool prevents the mistake</h2>
<p>Any nutritional token — "food calorie", "Calorie" (capital C), "dietary calorie", "nutritional calorie" — is aliased to <a href="/units/kilocalorie">kcal</a>. The parser records that an alias was used and the interface gently confirms the interpretation ("interpreting 'Calorie' as kcal"), so you are never silently handed a result that is off by three orders of magnitude. Under the hood a calorie is still just a unit of <a href="/learn/what-is-energy">energy</a> like the joule or watt-hour — the only trap is the capital letter, and the tool defuses it by asking rather than guessing.</p>`
};
