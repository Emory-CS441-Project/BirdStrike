<script lang="ts">
	import ExampleChart from '$lib/components/ExampleChart.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<main class="max-w-2xl mx-auto px-6 py-16">

  <header class="mb-16">
    <h1 class="text-4xl font-bold mb-4">Article Title</h1>
    <p class="text-lg text-gray-500">A sentance or two about what this is about. Talk about some other things too.</p>
  </header>

  <section class="prose prose-lg max-w-none mb-16">
    <p>Example paragraph here.</p>
  </section>

  <div class="mb-16">
    <ExampleChart data={data.data} />
  </div>

  <section class="prose prose-lg max-w-none mb-16">
    <p>Example paragraph here.</p>
  </section>

  <div class="mb-16">
    <ExampleChart data={data.data} />
  </div>

  <section class="prose prose-lg max-w-none mb-16">
    <p>Closing section</p>
  </section>

</main>