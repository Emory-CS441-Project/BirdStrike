<script lang="ts">
	import InteractionHeatMap from '$lib/components/InteractionHeatMap.svelte';
	import StrikesByYear from '$lib/components/StrikesByYear.svelte';
	import StrikesMap from '$lib/components/StrikesMap.svelte';
	import type { PageData } from './$types';
	import CostPlot from '$lib/components/CostPlot.svelte';
	import StrikesByTraffic from '$lib/components/StrikesByTraffic.svelte';
	import SpeciesBreakdown from '$lib/components/SpeciesBreakdown.svelte';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-5xl px-6 py-16 [&>section]:mx-auto [&>section]:max-w-4xl">
	<section class="prose prose-lg mb-16">
		<h1>Acceptable Collateral</h1>
		<p>
			Thousands of collisions between birds and aircraft occur in the United States every year.
			These are seen as rare, with airline companies doing their best to decrease occurrences.
			However, the data tells a different story: one of a worsening root problem, systemic neglect
			of wildlife, and progress measured only in decreasing costs. This is a visual analysis of the
			FAA Wildlife Strike <a href="https://wildlife.faa.gov/home">Database</a>.<br />
		</p>
		<p class="-mt-4 text-gray-500">Authors: Shane Berhoff, Max Roberts, and Blake Grudzien</p>
	</section>

	<section class="prose prose-lg mb-8">
		<h2>The Scale of the Problem</h2>
		<p>
			The FAA has recorded over 300,000 strike reports since 1990, and the trend is clear: incidents
			have risen steadily year over year. The chart below breaks this down annually by phase of
			flight. Toggle "Estimated Strikes" to shift from incident counts to estimated number of
			individual birds involved. Additionally toggle "Split" to see the comparative trends within
			each group.
		</p>
	</section>

	<div class="mb-8">
		<StrikesByYear data={data.strikesbyYear} />
	</div>

	<section class="prose prose-lg mb-8">
		<p>
			The data has a couple of interesting features. The first is that in the peak year of 2024, it
			is estimated around 35,000 birds were killed in incidents, and the number continues to grow
			every year. This begs the question, is any of this avoidable? Looking at the phases of flight,
			a large majority of those incidents were on the runway or on approach. This surprised us and
			means a large majority of the incidents were not en route but at an airport.
		</p>
		<p>
			The next interesting feature is the significant dip in 2020 that breaks the overall trend.
			This is due to Covid where less frequent flights naturally led to less incidents. However,
			this brings up an important idea: the data can be influenced by total air traffic. So this
			trend of the problem "worsening" may only be demonstrating an increase in flights.
		</p>
		<p>
			The graph below shows that this is not the case. According to <a
				href="https://www.transtats.bts.gov/traffic/">data</a
			> from the Bureau of Transportation Statistics the general trend has been almost flat with the one
			dip in 2020 as expected. This can then be used to scale the incident data with "Incidents per million
			flights". This remarkably smooths out the 2020 drop and shows a clear trend of a worsening problem.
		</p>
	</section>

	<div class="mb-16">
		<StrikesByTraffic data={data.strikesbyYear} traffic={data.Traffic} />
	</div>

	<section class="prose prose-lg mb-8">
		<h2>Airport Responsibility / Migration</h2>
		<p>
			The FAA requires airports to manage wildlife around their operations with a recommended zone
			of 5 miles with the intended goal to minimize problems for aircraft and to protect the
			surrounding environment. However, airport expansion leads to ecosystem disruption, and perhaps
			confusion for the birds who may not realize their previous home is no longer safe. This is one
			possible explanation for a third of all incidents happen on the runway itself, as investigated
			earlier.
		</p>
		<p>
			Incidents tend to cluster tightly around major hub airports and the migratory corridors that
			connect them. The map below displays this with density bubbles. Use the month filter below the
			map to watch the geography shift through the calendar year: strikes are relatively sparse in
			winter, build through spring, and surge dramatically from <strong>July through October</strong
			>
			as hundreds of millions of birds funnel southward through the same airspace used by commercial aviation.
		</p>
	</section>

	<div class="mb-8">
		<StrikesMap data={data.latlonData} />
	</div>

	<section class="prose prose-lg mb-16">
		<p>
			The autumn concentration is especially strong around the Great Lakes and along the Eastern
			Seaboard, where geography funnels migrating birds into narrow corridors directly overlapping
			with the approach and departure paths of the nation's busiest airports. Airports like JFK, and
			O'Hare (ORD) sit squarely in these corridors, making the collision risk less a matter of bad
			luck and more a matter of structural inevitability. Given that airports are supposed to be
			managing wildlife in their area and have full knowledge of migration seasons it seems that
			better systems should be put into place to decrease problems for both parties.
		</p>
	</section>

	<section class="prose prose-lg mb-8">
		<h2>Species Analysis</h2>
		<p>
			With strikes spanning the entire country, the question becomes: which birds are bearing the
			brunt? In most cases, the answer is unknown since species go unidentified in the majority of
			reports. When identification is possible though, the data spans 946 unique species and reveals
			a clear pattern. Ground dwellers like mourning doves, killdeer, and horned larks are struck
			most frequently (birds that are actively attracted to the short grass and open terrain of
			airport environments). Switching to <strong>Estimated Strikes</strong> shows a really interesting
			shift where European starlings and gulls surge to the top; this is a consequence of traveling in
			flocks where a single incident can mean dozens of birds.
		</p>
	</section>

	<div class="mb-16">
		<SpeciesBreakdown data={data.speciesStrikes} />
	</div>

	<div class="mb-16 flex">
		<section class="prose prose-lg -mt-4 flex-1/2">
			<h3>Species x Airline Interaction</h3>
			<p>
				Breaking the data down by both species and airline reveals another layer. The heatmap to the
				right cross-references the most frequently struck species against the airlines reporting the
				most incidents. It should be noted that this is a subset of the data as both pieces of
				information needed to be present.
			</p>
			<p></p>
			<p>
				The patterns that emerge reflect both geography and more minute relationships. European
				starlings and gulls show the darkest cells across the board, consistent with their flock
				behavior. American, Delta, Southwest, and United the big passenger carriers seem to have
				high density across nearly every species which reflects their route volume and hub
				footprint. Barn swallows are a larger problem for American and Delta, Horned lark for
				Southwest and United, and Rock Pigeon for American and Southwest. These difference point to
				the fact that different airlines operate heavily out of different airports, and those
				airports sit in very different ecosystems.
			</p>
		</section>
		<div class="flex-1/2">
			<InteractionHeatMap data={data.interactionData} />
		</div>
	</div>

	<section class="prose prose-lg mb-8">
		<h2>Acceptable Collateral</h2>
		<p>
			With how bad the problem is getting it would seem to benefit the airlines to reduce the number
			of collisions. A single incident can come with a hefty repair cost depending on what was
			broken. This can be seen in the bar charts below which show inflation adjusted cost to repair
			different parts of the plane after an incident. Note: this is a subset of the data as not all
			reports came with damage cost.
		</p>
		<p>
			These collisions can also lead to delayed flights, diversions, emergency landings, injuries,
			and even death. So it would seem that the airlines should be incentivize to solve the problem
			and share the airspace with birds in a safer way. However, looking at the data a different way
			reveals the solution they have chosen. <strong>Cost over time</strong> shows that the inflation
			adjusted damage cost is decreasing. This means that by focusing on making planes more bird resistant,
			and repairs cheaper, they can worry less about the effects of strikes. While this is great for airlines
			and passengers it is terrible for birds which get treated as acceptable collateral.
		</p>
	</section>

	<div class="mb-16">
		<CostPlot boxData={data.CostBox} trendData={data.CostTrend} />
	</div>

	<section class="prose prose-lg mb-16">
		<h2>Conclusion</h2>
		<p>
			The FAA Wildlife Strike Database tells a story that the industry would prefer to frame as a
			safety issue. Looking at the full picture: rising incident rate, geographic distraction,
			species distribution, and cost trends, a different narrative emerges. Bird strikes are not a
			random and unavoidable hazard. They are a predictable consequence of expanding airports into
			ecosystems, concentrating flight operations along the same corridors that hundreds of millions
			of birds have used for centuries, and treating the resulting collisions as an engineering
			problem rather than an ecological one.
		</p>
		<p>
			The industry's response has been to make planes more resilient and repairs cheaper not to
			meaningfully reduce the number of birds killed. As long as the cost per strike keeps falling,
			there is little financial incentive to do otherwise. The birds, the 946 species caught in the
			crosshairs of commercial aviation, have no seat at the table where those decisions are made.
			That is what makes them acceptable collateral.
		</p>
	</section>
</main>
