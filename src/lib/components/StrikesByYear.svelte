<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface YearPhaseRow {
		INCIDENT_YEAR: number;
		PHASE_OF_FLIGHT: string;
		incidents: number;
		est_birds_struck: number;
	}

	interface Props {
		data: YearPhaseRow[];
	}

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;
	let metric: 'incidents' | 'est_birds_struck' = $state('incidents');
	let viewMode: 'stacked' | 'split' = $state('stacked');

	type Margin = { top: number; right: number; bottom: number; left: number };

	const MARGIN: Margin = { top: 20, right: 100, bottom: 40, left: 70 };
	const STACKED_HEIGHT = 400;
	const STACKED_INNER_HEIGHT = STACKED_HEIGHT - MARGIN.top - MARGIN.bottom;

	const metricLabel = (m: string) => (m === 'incidents' ? 'Incidents' : 'Est. Birds Struck');

	function getTooltip() {
		return d3
			.select('body')
			.selectAll('.strikes-tooltip')
			.data([null])
			.join('div')
			.attr('class', 'strikes-tooltip')
			.style('position', 'fixed')
			.style('pointer-events', 'none')
			.style('background', 'var(--color-background-primary, #fff)')
			.style('border', '1px solid var(--color-border-tertiary, #ddd)')
			.style('border-radius', '6px')
			.style('padding', '8px 12px')
			.style('font-size', '12px')
			.style('line-height', '1.5')
			.style('max-width', '220px')
			.style('box-shadow', '0 2px 8px rgba(0,0,0,0.12)')
			.style('opacity', '0')
			.style('z-index', '9999');
	}

	function getSharedScales(innerWidth: number) {
		const years = Array.from(new Set(data.map((d) => d.INCIDENT_YEAR))).sort((a, b) => a - b);
		const phases = Array.from(new Set(data.map((d) => d.PHASE_OF_FLIGHT))).sort();

		const byYear = new Map<number, Record<string, number>>();
		for (const year of years) {
			byYear.set(year, Object.fromEntries(phases.map((p) => [p, 0])));
		}
		for (const row of data) {
			byYear.get(row.INCIDENT_YEAR)![row.PHASE_OF_FLIGHT] = row[metric];
		}

		const stackData = years.map((year) => ({ year, ...byYear.get(year)! }));
		const series = d3.stack<(typeof stackData)[0]>().keys(phases)(stackData);

		const x = d3.scaleBand().domain(years.map(String)).range([0, innerWidth]).padding(0.2);
		const maxVal = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 0;
		const y = d3.scaleLinear().domain([0, maxVal]).nice().range([STACKED_INNER_HEIGHT, 0]);
		const color = d3.scaleOrdinal<string>().domain(phases).range(d3.schemeTableau10);

		return { years, phases, series, x, y, maxVal, color, byYear, stackData };
	}

	function appendLegend(
		svg: d3.Selection<SVGGElement, unknown, null, undefined>,
		phases: string[],
		color: d3.ScaleOrdinal<string, string>,
		innerWidth: number
	) {
		const legend = svg.append('g').attr('transform', `translate(${innerWidth + 12}, 0)`);
		phases
			.slice()
			.reverse()
			.forEach((phase, i) => {
				const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
				g.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(phase));
				g.append('text')
					.attr('x', 16)
					.attr('y', 10)
					.attr('font-size', 11)
					.attr('fill', 'currentColor')
					.text(phase);
			});
	}

	function appendXAxis(
		g: d3.Selection<SVGGElement, unknown, null, undefined>,
		x: d3.ScaleBand<string>,
		offsetY: number
	) {
		g.append('g')
			.attr('transform', `translate(0, ${offsetY})`)
			.call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)))
			.selectAll('text')
			.attr('font-size', 11);
	}

	function draw() {
		const innerWidth = svgEl.clientWidth - MARGIN.left - MARGIN.right;
		const { years, phases, series, x, y, color, byYear } = getSharedScales(innerWidth);

		d3.select(svgEl).selectAll('*').remove();

		const totalWidth = svgEl.clientWidth;
		const tooltip = getTooltip();

		if (viewMode === 'stacked') {
			const svg = d3
				.select(svgEl)
				.attr('viewBox', `0 0 ${totalWidth} ${STACKED_HEIGHT}`)
				.append('g')
				.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

			appendXAxis(svg, x, STACKED_INNER_HEIGHT);
			svg.append('g').call(d3.axisLeft(y).ticks(6)).selectAll('text').attr('font-size', 11);

			// Grid lines
			svg
				.append('g')
				.attr('stroke', 'currentColor')
				.attr('stroke-opacity', 0.08)
				.selectAll('line')
				.data(y.ticks(6))
				.join('line')
				.attr('x1', 0)
				.attr('x2', innerWidth)
				.attr('y1', (d) => y(d))
				.attr('y2', (d) => y(d));

			// Stacked bars with tooltips
			svg
				.selectAll('.series')
				.data(series)
				.join('g')
				.attr('class', 'series')
				.attr('fill', (d) => color(d.key))
				.selectAll('rect')
				.data((d) => d.map((pt) => ({ ...pt, phase: d.key })))
				.join('rect')
				.attr('x', (d) => x(String((d.data as any).year)) ?? 0)
				.attr('y', (d) => y(d[1]))
				.attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
				.attr('width', x.bandwidth())
				.style('cursor', 'default')
				.on('mousemove', (event, d: any) => {
					const year = (d.data as any).year;
					const phaseCounts = byYear.get(year)!;
					const total = phases.reduce((sum, p) => sum + phaseCounts[p], 0);
					const rows = phases
						.filter((p) => phaseCounts[p] > 0)
						.sort((a, b) => phaseCounts[b] - phaseCounts[a])
						.map(
							(p) =>
								`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color(p)};margin-right:4px;"></span>${p}: <strong>${phaseCounts[p].toLocaleString()}</strong>`
						)
						.join('<br/>');
					tooltip
						.style('opacity', '1')
						.style('left', `${event.clientX + 12}px`)
						.style('top', `${event.clientY - 10}px`)
						.html(
							`<strong>${year}</strong> — ${metricLabel(metric)}<br/><strong>Total: ${total.toLocaleString()}</strong><br/><br/>${rows}`
						);
				})
				.on('mouseleave', () => tooltip.style('opacity', '0'));

			appendLegend(svg, phases, color, innerWidth);
		} else {
			// Split view
			const facetGap = 16;
			const orderedPhases = phases.slice().reverse();
			const phaseMaxBarPx = orderedPhases.map((phase) => {
				const s = series.find((s) => s.key === phase)!;
				return d3.max(s, (d) => Math.max(0, y(d[0]) - y(d[1]))) ?? 0;
			});

			const totalInnerHeight = d3.sum(phaseMaxBarPx) + (orderedPhases.length - 1) * facetGap;
			const totalHeight = MARGIN.top + totalInnerHeight + MARGIN.bottom;

			const svg = d3
				.select(svgEl)
				.attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
				.append('g')
				.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

			let cursor = 0;
			orderedPhases.forEach((phase, i) => {
				const facetHeight = phaseMaxBarPx[i];
				const g = svg.append('g').attr('transform', `translate(0, ${cursor})`);
				const s = series.find((s) => s.key === phase)!;

				g.append('line')
					.attr('x1', 0)
					.attr('x2', innerWidth)
					.attr('y1', facetHeight)
					.attr('y2', facetHeight)
					.attr('stroke', 'currentColor')
					.attr('stroke-opacity', 0.2);

				// Phase label
				g.append('text')
					.attr('x', 4)
					.attr('y', 12)
					.attr('font-size', 10)
					.attr('fill', color(phase))
					.attr('font-weight', 600)
					.text(phase);

				g.selectAll('rect')
					.data(s)
					.join('rect')
					.attr('x', (d) => x(String((d.data as any).year)) ?? 0)
					.attr('y', (d) => facetHeight - Math.max(0, y(d[0]) - y(d[1])))
					.attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
					.attr('width', x.bandwidth())
					.attr('fill', color(phase))
					.style('cursor', 'default')
					.on('mousemove', (event, d: any) => {
						const year = (d.data as any).year;
						const val = (d.data as any)[phase] ?? 0;
						tooltip
							.style('opacity', '1')
							.style('left', `${event.clientX + 12}px`)
							.style('top', `${event.clientY - 10}px`)
							.html(
								`<strong>${year}</strong><br/>${phase}<br/>${metricLabel(metric)}: <strong>${val.toLocaleString()}</strong>`
							);
					})
					.on('mouseleave', () => tooltip.style('opacity', '0'));

				if (i === orderedPhases.length - 1) appendXAxis(g, x, facetHeight);

				cursor += facetHeight + facetGap;
			});

			appendLegend(svg, phases, color, innerWidth);
		}
	}

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		metric;
		viewMode;
		if (svgEl) draw();
	});
</script>

<figure>
	<div class="mb-3 flex items-center gap-2">
		<div class="mr-auto flex gap-2">
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{metric === 'incidents' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (metric = 'incidents')}
			>
				Incidents
			</button>
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{metric === 'est_birds_struck'
					? 'bg-gray-700 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (metric = 'est_birds_struck')}
			>
				Estimated Strikes
			</button>
		</div>
		<div class="mr-auto flex text-lg">Bird Strikes Over Time By Phase Of Flight</div>
		<div class="ml-auto flex gap-2">
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{viewMode === 'stacked' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (viewMode = 'stacked')}
			>
				Stacked
			</button>
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{viewMode === 'split' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (viewMode = 'split')}
			>
				Split
			</button>
		</div>
	</div>
	<svg bind:this={svgEl} class="block w-full"></svg>
</figure>
