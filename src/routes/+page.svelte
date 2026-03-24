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

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Example paragraph here.</p>
	</section>

	<div class="mb-16">
		<StrikesByYear data={data.strikesbyYear} />
	</div>

	<section class="prose prose-lg mb-16 max-w-none">
		<p>Example paragraph here.</p>
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
