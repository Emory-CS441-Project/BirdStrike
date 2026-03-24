<script lang="ts">
	import InteractionHeatMap from '$lib/components/InteractionHeatMap.svelte';
	import StrikesByYear from '$lib/components/StrikesByYear.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-6xl px-6 py-16">
	<header class="mb-16">
		<h1 class="mb-4 text-4xl font-bold">Article Title</h1>
		<p class="text-lg text-gray-500">
			A sentance or two about what this is about. Talk about some other things too.
		</p>
	</header>

	<section class="prose prose-lg mb-4 max-w-none">
		<h2>Introduction</h2>
		<p>
			Expoloration of strikes increasing over time. Incidents is total number of reports in the
			year. Estimated Strikes accounts for how many birds were involved in each incident. Then to
			better understand the different phase of flight categories there is the ability to split by
			group.
		</p>
	</section>

	<div class="mb-16">
		<StrikesByYear data={data.strikesbyYear} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Vis1 paragraph here.</p>
	</section>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>
			Airports are legally required to manage wildlife within a five-mile radius, and yet this
			five-mile radius is actually where birds are most in danger accounting for the vast majority
			of colisions. In fact, over 95% of bird strikes fall into what the FAA calls the
			“responsibility zone”. In this “Responsibility zone” the most deadly airports are killing
			birds of over 200 unique species. That's an entire ecosystem that has been placed in the
			crosshair of the commercial airline industry. This ecosystem is only destroyed further by
			continuous expansions, leaving the birds without a habitat (the leading reason for decline in
			bird population). Then due to poor restructuring of the area the birds end up waiting on the
			tarmac for their turn.
		</p>
	</section>

	<section class="prose prose-lg mb-4 max-w-none">
		<h2>Granular Interaction Data</h2>
		<p>Exploration of the data grouped by top species and top airlines.</p>
	</section>

	<div class="mb-16">
		<InteractionHeatMap data={data.interactionData} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Closing section</p>
	</section>
</main>
