<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface YearPhaseRow {
		INCIDENT_YEAR: number;
		PHASE_OF_FLIGHT: string;
		incidents: number;
		est_birds_struck: number;
	}

	interface TrafficRow {
		year: number;
		total: number;
	}

	interface Props {
		data: YearPhaseRow[];
		traffic: TrafficRow[];
	}

	let { data, traffic }: Props = $props();

	let svgEl: SVGSVGElement;
	let mode: 'traffic' | 'rate' = $state('traffic');

	const MARGIN = { top: 20, right: 20, bottom: 40, left: 70 };
	const HEIGHT = 300;
	const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

	const strikesByYear = $derived.by(() => {
		const map = new Map<number, number>();
		for (const row of data) {
			map.set(row.INCIDENT_YEAR, (map.get(row.INCIDENT_YEAR) ?? 0) + row.incidents);
		}
		return map;
	});

	function getValues() {
		if (mode === 'traffic') {
			return traffic.map((t) => ({ year: t.year, value: t.total }));
		}
		return traffic
			.filter((t) => strikesByYear.has(t.year))
			.map((t) => ({
				year: t.year,
				value: (strikesByYear.get(t.year)! / t.total) * 1_000_000
			}));
	}

	function draw() {
		const innerWidth = svgEl.clientWidth - MARGIN.left - MARGIN.right;
		const values = getValues();

		d3.select(svgEl).selectAll('*').remove();

		const x = d3
			.scaleLinear()
			.domain(d3.extent(values, (d) => d.year) as [number, number])
			.range([0, innerWidth]);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(values, (d) => d.value)!])
			.nice()
			.range([INNER_HEIGHT, 0]);

		const line = d3
			.line<{ year: number; value: number }>()
			.x((d) => x(d.year))
			.y((d) => y(d.value))
			.curve(d3.curveMonotoneX);

		const svg = d3
			.select(svgEl)
			.attr('viewBox', `0 0 ${svgEl.clientWidth} ${HEIGHT}`)
			.append('g')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		svg
			.append('g')
			.attr('transform', `translate(0,${INNER_HEIGHT})`)
			.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(8))
			.selectAll('text')
			.attr('font-size', 11);

		svg
			.append('g')
			.call(
				d3
					.axisLeft(y)
					.ticks(6)
					.tickFormat((v) =>
						mode === 'traffic' ? d3.format('~s')(v as number) : (v as number).toFixed(1)
					)
			)
			.selectAll('text')
			.attr('font-size', 11);

		svg
			.append('path')
			.datum(values)
			.attr('fill', 'none')
			.attr('stroke', mode === 'traffic' ? '#378ADD' : '#D85A30')
			.attr('stroke-width', 2)
			.attr('d', line);
	}

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		mode;
		strikesByYear;
		if (svgEl) draw();
	});
</script>

<figure>
	<div class="mb-3 flex items-center justify-between">
		<span class="text-sm text-gray-500">
			{mode === 'traffic'
				? 'Total air traffic by year'
				: 'Bird strike incidents per million flights'}
		</span>
		<div class="flex gap-2">
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{mode === 'traffic' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'traffic')}
			>
				Total traffic
			</button>
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{mode === 'rate' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'rate')}
			>
				Incidents per million flights
			</button>
		</div>
	</div>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">
		Air Traffic Data from Bureau of Transportation Statistics
	</figcaption>
</figure>
