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

<main class="mx-auto max-w-6xl px-6 py-16">
	<header class="mb-16">
		<h1 class="mb-4 text-4xl font-bold">Article Title</h1>
		<p class="text-lg text-gray-500">
			A sentence or two about what this is about. Talk about some other things too.
		</p>
	</header>

	<section class="prose prose-lg mb-4 max-w-none">
		<h2>Introduction</h2>
		<p>
			Exploration of strikes increasing over time. Incidents is total number of reports in the
			year. Estimated Strikes accounts for how many birds were involved in each incident. Then to
			better understand the different phase of flight categories there is the ability to split by
			group.
		</p>
	</section>

	<div class="mb-16">
		<StrikesByYear data={data.strikesbyYear} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Paragraph here.</p>
	</section>

	<div class="mb-16">
		<StrikesByTraffic data={data.strikesbyYear} traffic={data.Traffic} />
	</div>

	<div class="mb-16">
		<SpeciesBreakdown data={data.speciesStrikes} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Paragraph here.</p>
	</section>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>
			Airports are legally required to manage wildlife within a five-mile radius, and yet this
			five-mile radius is actually where birds are most in danger, accounting for the vast majority
			of collisions. In this “Responsibility zone” the most deadly airports are killing birds of
			over 200 unique species. That's an entire ecosystem that has been placed in the crosshair of
			the commercial airline industry. This ecosystem is only destroyed further by continuous
			expansions, leaving the birds without a habitat (the leading reason for decline in bird
			population). Then due to poor restructuring of the area the birds end up waiting on the tarmac
			for their turn.
		</p>
	</section>

	<section class="prose prose-lg mb-4 max-w-none">
		<h2>Whee and When Bird Strikes Happen</h2>
		<p>
			Bird strikes are not distributed evenly across the country. Incidents cluster tightly around
			major hub airports and the migratory corridors that connect them. Switch to <strong>Bubbles</strong>
			view to see density hotspots emerge along the Atlantic and Mississippi flyways — the two
			busiest highways in the avian world. Then use the month filter below the map to watch the
			geography shift through the calendar year: strikes are relatively sparse in winter, build
			through spring, and surge dramatically from <strong>July through October</strong> as
			hundreds of millions of birds funnel southward through the same airspace used by commercial
			aviation.
		</p>
	</section>

	<div class="mb-16">
		<StrikesMap data={data.latlonData} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>
			The autumn concentration is especially strong around the Great Lakes and along the Eastern
			Seaboard, where geography funnels migrating birds into narrow corridors directly overlapping
			with the approach and departure paths of the nation's busiest airports. Airports like JFK,
			and O'Hare (ORD) sit squarely in these corridors, making the
			collision risk less a matter of bad luck and more a matter of structural inevitability.
		</p>
	</section>

	<section class="prose prose-lg mb-4 max-w-none">
		<h2>Granular Interaction Data</h2>
		<p>Exploration of the data grouped by top species and top airlines.</p>
	</section>

	<div class="flex">
		<div class="flex-1/2">
			<InteractionHeatMap data={data.interactionData} />
		</div>
		<section class="flex-1/2 pt-40 pl-10">Test</section>
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
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

	<section class="prose prose-lg mb-16 max-w-none">
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
</main>