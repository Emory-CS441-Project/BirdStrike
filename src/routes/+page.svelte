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
			These are seen as rare occurrences with airline companies doing their best to decrease the
			scope of the problem. However, the data tells a different story: one of a worsening root
			problem, systemic neglect of wildlife, and progress measured only in decreasing costs. This is
			a visual analysis of the FAA Wildlife Strike <a href="https://wildlife.faa.gov/home"
				>Database</a
			>.<br />
		</p>
		<p class="-mt-4 text-gray-500">Authors: Shane Berhoff, Max Roberts, and Blake Grudzian</p>
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
			The data has a couple of interesting features. The first is that in the peak year of 2024 it
			is estimated around 35,000 birds were killed in incidents with the problem clearly worsening.
			So it brings into question is any of this avoidable? Well, looking at the phase of flight a
			large majority of those incidents were on the runway or on approach. This surprised us and
			means a large majority of the incidents were not en route but at an airport.
		</p>
		<p>
			The next interesting feature is the significant dip in 2020 that breaks the overall trend.
			This is due to covid where with less planes flying obviously there will be less incidents.
			However, this brings up an important idea, the data can be influenced by air traffic itself.
			So this trend of the problem "worsening" may only be demonstrating an increase in flights.
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
			Given that a majority of incidents seem to occur right at airports we decided to look into
			this. It turns out that the FAA requires airports to manage wildlife in and around their
			operations with a recommendation of a 5 mile zone. The goal of this is to minimize problems
			for aircraft and to protect the surrounding environment. It seems though that this has just
			lead to ecosystem disruption and habitat fragmentation: the birds then have no where to go and
			end up flocking to the runway causing a third of incidents.
		</p>
		<p>
			This then brings into question where geographically do these incidents take place? It turns
			out they are not distributed evenly across the country. Incidents cluster tightly around major
			hub airports and the migratory corridors that connect them. The map below displays this with
			density bubbles. Use the month filter below the map to watch the geography shift through the
			calendar year: strikes are relatively sparse in winter, build through spring, and surge
			dramatically from <strong>July through October</strong> as hundreds of millions of birds funnel
			southward through the same airspace used by commercial aviation.
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

	<section class="prose prose-lg mb-4">
		<h2>Species Analysis</h2>
		<p>Exploration of the data grouped by top species and top airlines.</p>
	</section>

	<div class="mb-16">
		<SpeciesBreakdown data={data.speciesStrikes} />
	</div>

	<section class="prose prose-lg mb-16">
		<p>Paragraph</p>
	</section>

	<div class="flex">
		<div class="flex-1/2">
			<InteractionHeatMap data={data.interactionData} />
		</div>
		<section class="flex-1/2 pt-40 pl-10">Test</section>
	</div>

	<section class="prose prose-lg mb-4">
		<h2>Acceptable Collateral</h2>
		<p>
			It would also benefit the airlines to reduce the number of collisions. The repairs alone are a
			great cost for the airlines and have even increased in recent years, with struck engines
			rising above 100,000$ on average to fix. These collisions can also lead to delayed flights, or
			diversions, in the worst case there can even be forced emergency landings, injuries and even
			death. Airlines have an incentive to avoid these collisions however they have decided to make
			their planes more bird resistant, as opposed to reducing collisions in general. The inflation
			adjusted cost of repairs due to a strike has been steadily decreasing since 2010. This has
			obvious benefits for humans on vacation, but now airlines have less reason to care and birds
			are more at risk than ever.
		</p>
	</section>

	<div class="mb-16">
		<CostPlot boxData={data.CostBox} trendData={data.CostTrend} />
	</div>

	<section class="prose prose-lg mb-16">
		<p>
			As technology improves and planes become more bird resistant, airlines will no longer have to
			weigh human safety vs. flight delays and can just plow through birds, treating them as
			acceptable collateral. This problem isn't unsolvable, but the airline industry as a whole has
			been deciding not to solve it, as seen by the widespread increase in collisions across the
			entire country. Delaying flights out of cautiousness and investing in better migration
			monitoring systems cost the airports money, while expanding runways into an already damaged
			ecosystem makes money.
		</p>
	</section>

	<section class="prose prose-lg mb-16">
		<h2>Conclusion</h2>
		<p>Paragraph</p>
	</section>
</main>
