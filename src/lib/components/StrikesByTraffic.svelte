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
		const lineColor = mode === 'traffic' ? '#378ADD' : '#D85A30';

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
						mode === 'traffic' ? d3.format('~s')(v as number) : (v as number).toFixed(0)
					)
			)
			.selectAll('text')
			.attr('font-size', 11);

		// Line path
		svg
			.append('path')
			.datum(values)
			.attr('fill', 'none')
			.attr('stroke', lineColor)
			.attr('stroke-width', 2)
			.attr('d', line);

		// Dots for each data point
		svg
			.selectAll('circle.dot')
			.data(values)
			.join('circle')
			.attr('class', 'dot')
			.attr('cx', (d) => x(d.year))
			.attr('cy', (d) => y(d.value))
			.attr('r', 3)
			.attr('fill', lineColor)
			.attr('stroke', 'white')
			.attr('stroke-width', 1.5);

		// Tooltip + crosshair elements
		const tooltip = d3
			.select('body')
			.selectAll('.linechart-tooltip')
			.data([null])
			.join('div')
			.attr('class', 'linechart-tooltip')
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

		const crosshair = svg
			.append('line')
			.attr('class', 'crosshair')
			.attr('y1', 0)
			.attr('y2', INNER_HEIGHT)
			.attr('stroke', 'currentColor')
			.attr('stroke-opacity', 0.25)
			.attr('stroke-dasharray', '4,3')
			.attr('pointer-events', 'none')
			.style('opacity', 0);

		const hoverDot = svg
			.append('circle')
			.attr('r', 5)
			.attr('fill', lineColor)
			.attr('stroke', 'white')
			.attr('stroke-width', 2)
			.attr('pointer-events', 'none')
			.style('opacity', 0);

		// Invisible overlay for mouse tracking
		svg
			.append('rect')
			.attr('width', innerWidth)
			.attr('height', INNER_HEIGHT)
			.attr('fill', 'transparent')
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const hoveredYear = Math.round(x.invert(mx));
				const closest = values.reduce((a, b) =>
					Math.abs(b.year - hoveredYear) < Math.abs(a.year - hoveredYear) ? b : a
				);

				const cx = x(closest.year);
				const cy = y(closest.value);

				crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
				hoverDot.attr('cx', cx).attr('cy', cy).style('opacity', 1);

				const formattedValue =
					mode === 'traffic' ? d3.format(',')(Math.round(closest.value)) : closest.value.toFixed(2);
				const label = mode === 'traffic' ? 'Total flights' : 'Incidents per million flights';

				tooltip
					.style('opacity', '1')
					.style('left', `${event.clientX + 14}px`)
					.style('top', `${event.clientY - 10}px`)
					.html(
						`<strong>${closest.year}</strong><br/>${label}: <strong>${formattedValue}</strong>`
					);
			})
			.on('mouseleave', () => {
				crosshair.style('opacity', 0);
				hoverDot.style('opacity', 0);
				tooltip.style('opacity', '0');
			});
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
