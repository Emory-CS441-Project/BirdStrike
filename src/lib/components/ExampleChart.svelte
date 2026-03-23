<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface YearCount {
		INCIDENT_YEAR: number;
		count: number;
	}

	interface Props {
		data: YearCount[];
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

		const x = d3
			.scaleBand()
			.domain(data.map((d) => String(d.INCIDENT_YEAR)))
			.range([0, innerWidth])
			.padding(0.2);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(data, (d) => d.count) ?? 0])
			.nice()
			.range([innerHeight, 0]);

		svg
			.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)));

		svg.append('g').call(d3.axisLeft(y));

		svg
			.selectAll('rect')
			.data(data)
			.join('rect')
			.attr('x', (d) => x(String(d.INCIDENT_YEAR)) ?? 0)
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
