<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { BirdStrikeRow } from '$lib/types';

	interface Props {
		data: BirdStrikeRow[];
	}

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;

	function draw() {
		const margin = { top: 20, right: 20, bottom: 40, left: 60 };
		const width = svgEl.clientWidth;
		const height = 400;
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		d3.select(svgEl).selectAll('*').remove();

		const svg = d3
			.select(svgEl)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const counts = d3.rollup(
			data,
			(v) => v.length,
			(d) => d.INCIDENT_YEAR
		);

		const chartData = Array.from(counts, ([year, count]) => ({ year, count })).sort(
			(a, b) => a.year - b.year
		);

		const x = d3
			.scaleBand()
			.domain(chartData.map((d) => String(d.year)))
			.range([0, innerWidth])
			.padding(0.2);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(chartData, (d) => d.count) ?? 0])
			.nice()
			.range([innerHeight, 0]);

		svg
			.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)));

		svg.append('g').call(d3.axisLeft(y));

		svg
			.selectAll('rect')
			.data(chartData)
			.join('rect')
			.attr('x', (d) => x(String(d.year)) ?? 0)
			.attr('y', (d) => y(d.count))
			.attr('width', x.bandwidth())
			.attr('height', (d) => innerHeight - y(d.count))
			.attr('fill', 'steelblue');
	}

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => ro.disconnect();
	});
</script>

<figure>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">Bird strikes by year</figcaption>
</figure>
