<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { BirdStrikeRow } from '$lib/types';

	interface Props {
		data: BirdStrikeRow[];
	}

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;

	const THRESHOLD = 0.02; // phases < 2% of total incidents → "Other"

	function draw() {
		const margin = { top: 20, right: 20, bottom: 40, left: 60 };
		const width = svgEl.clientWidth;
		const height = 400;
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		d3.select(svgEl).selectAll('*').remove();

		// --- Data prep ---
		// Count total per phase to determine which get grouped into "Other"
		const phaseTotals = d3.rollup(
			data,
			(v) => v.length,
			(d) => d.PHASE_OF_FLIGHT
		);
		const totalIncidents = data.length;
		const majorPhases = new Set(
			Array.from(phaseTotals.entries())
				.filter(([, count]) => count / totalIncidents >= THRESHOLD)
				.map(([phase]) => phase)
		);

		const PHASE_GROUPS: Record<string, string> = {
			'Take-off Run': 'Takeoff',
			Departure: 'Takeoff',
			Approach: 'Landing Phase',
			Descent: 'Landing Phase',
			'Landing Roll': 'Landing Phase',
			Taxi: 'Landing Phase',
			Parked: 'Landing Phase',
			Arrival: 'Landing Phase',
			Climb: 'In Flight',
			'En Route': 'In Flight'
		};

		const allPhases = ['Takeoff', 'In Flight', 'Landing Phase'];

		const normalized = data
			.filter((d) => d.PHASE_OF_FLIGHT != null)
			.map((d) => ({
				...d,
				phase: PHASE_GROUPS[d.PHASE_OF_FLIGHT] ?? 'Other'
			}));

		const otherRawValues = new Set(
			data
				.filter((d) => d.PHASE_OF_FLIGHT !== 'Unknown')
				.filter((d) => !PHASE_GROUPS[d.PHASE_OF_FLIGHT])
				.map((d) => d.PHASE_OF_FLIGHT)
		);

		console.log('Raw phases mapping to Other:', [...otherRawValues]);

		const unaccounted = new Set(
			data.map((d) => d.PHASE_OF_FLIGHT).filter((p) => p && !PHASE_GROUPS[p])
		);

		if (unaccounted.size > 0) {
			console.warn('Unaccounted PHASE_OF_FLIGHT values:', [...unaccounted]);
		}

		// Build { year → { phase → count } } structure
		const nested = d3.rollup(
			normalized,
			(v) => v.length,
			(d) => d.INCIDENT_YEAR,
			(d) => d.phase
		);

		const years = Array.from(nested.keys()).sort((a, b) => a - b);

		// Stack-friendly array: one object per year with a key per phase
		const chartData = years.map((year) => {
			const phaseCounts = nested.get(year)!;
			const row: Record<string, number | string> = { year: String(year) };
			for (const phase of allPhases) {
				row[phase] = phaseCounts.get(phase) ?? 0;
			}
			return row;
		});

		// --- Scales ---
		const x = d3.scaleBand().domain(years.map(String)).range([0, innerWidth]).padding(0.2);

		const stack = d3.stack<Record<string, number | string>>().keys(allPhases);
		const series = stack(chartData as any);

		const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 0;

		const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

		const color = d3.scaleOrdinal<string>().domain(allPhases).range(d3.schemeTableau10);

		// --- Legend height (above chart) ---
		const legendItemHeight = 20;
		const legendCols = Math.floor(innerWidth / 160);
		const legendRows = Math.ceil(allPhases.length / legendCols);
		const legendHeight = legendRows * legendItemHeight + 12;

		// Re-derive total SVG height to accommodate legend
		const totalHeight = height + legendHeight;

		d3.select(svgEl).attr('viewBox', `0 0 ${width} ${totalHeight}`);

		const svg = d3
			.select(svgEl)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top + legendHeight})`);

		// --- Axes ---
		svg
			.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)));

		svg.append('g').call(d3.axisLeft(y));

		// --- Stacked bars ---
		svg
			.selectAll('g.series')
			.data(series)
			.join('g')
			.attr('class', 'series')
			.attr('fill', (d) => color(d.key))
			.selectAll('rect')
			.data((d) => d)
			.join('rect')
			.attr('x', (d) => x(String((d.data as any).year)) ?? 0)
			.attr('y', (d) => y(d[1]))
			.attr('height', (d) => y(d[0]) - y(d[1]))
			.attr('width', x.bandwidth());

		// --- Legend (above chart) ---
		const legend = d3
			.select(svgEl)
			.append('g')
			.attr('transform', `translate(${margin.left}, ${margin.top})`);

		allPhases.forEach((phase, i) => {
			const col = i % legendCols;
			const row = Math.floor(i / legendCols);
			const g = legend
				.append('g')
				.attr('transform', `translate(${col * 160}, ${row * legendItemHeight})`);

			g.append('rect')
				.attr('width', 12)
				.attr('height', 12)
				.attr('rx', 2)
				.attr('fill', color(phase));

			g.append('text')
				.attr('x', 18)
				.attr('y', 10)
				.attr('font-size', '12px')
				.attr('fill', 'currentColor')
				.text(phase);
		});
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
	<figcaption class="mt-2 text-sm text-gray-500">
		Bird strikes by year, stacked by phase of flight
	</figcaption>
</figure>
