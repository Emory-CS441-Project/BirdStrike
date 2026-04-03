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

	// Tooltip state
	interface TooltipState { visible: boolean; x: number; y: number; html: string; }
	let tooltip: TooltipState = $state({ visible: false, x: 0, y: 0, html: '' });

	const MARGIN = { top: 20, right: 20, bottom: 40, left: 70 };
	const HEIGHT = 300;
	const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

	const COLOR = { traffic: '#378ADD', rate: '#D85A30' };

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

	function showTooltip(event: MouseEvent, html: string) {
		tooltip = { visible: true, x: event.clientX, y: event.clientY, html };
	}
	function hideTooltip() {
		tooltip = { ...tooltip, visible: false };
	}

	function draw() {
		const innerWidth = svgEl.clientWidth - MARGIN.left - MARGIN.right;
		const values = getValues();
		const color = mode === 'traffic' ? COLOR.traffic : COLOR.rate;

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${svgEl.clientWidth} ${HEIGHT}`);

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
		svg.append('g')
			.attr('stroke', 'currentColor').attr('stroke-opacity', 0.08)
			.selectAll('line').data(y.ticks(6)).join('line')
			.attr('x1', 0).attr('x2', innerWidth)
			.attr('y1', (d) => y(d)).attr('y2', (d) => y(d));

		// Axes
		svg.append('g')
			.attr('transform', `translate(0,${INNER_HEIGHT})`)
			.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(8))
			.selectAll('text').attr('font-size', 11);

		svg.append('g')
			.call(
				d3.axisLeft(y).ticks(6)
					.tickFormat((v) =>
						mode === 'traffic' ? d3.format('~s')(v as number) : (v as number).toFixed(1)
					)
			)
			.selectAll('text').attr('font-size', 11);

		// Area fill
		const area = d3.area<{ year: number; value: number }>()
			.x((d) => x(d.year)).y0(INNER_HEIGHT).y1((d) => y(d.value))
			.curve(d3.curveMonotoneX);

		svg.append('path').datum(values)
			.attr('fill', color).attr('opacity', 0.07).attr('d', area);

		// Line
		svg.append('path').datum(values)
			.attr('fill', 'none').attr('stroke', color)
			.attr('stroke-width', 2).attr('d', line);

		// Crosshair elements
		const crosshairV = svg.append('line')
			.attr('y1', 0).attr('y2', INNER_HEIGHT)
			.attr('stroke', '#94a3b8').attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,3').attr('opacity', 0);

		const hoverDot = svg.append('circle')
			.attr('r', 5).attr('fill', color)
			.attr('stroke', 'white').attr('stroke-width', 2)
			.attr('opacity', 0).style('pointer-events', 'none');

		const bisect = d3.bisector((d: { year: number; value: number }) => d.year).center;

		const formatValue = (v: number) =>
			mode === 'traffic'
				? d3.format(',.0f')(v) + ' flights'
				: v.toFixed(2) + ' per million flights';

		const label = mode === 'traffic' ? 'Total flights' : 'Strike rate';

		// Invisible overlay for mouse events
		svg.append('rect')
			.attr('width', innerWidth).attr('height', INNER_HEIGHT)
			.attr('fill', 'none').style('pointer-events', 'all')
			.style('cursor', 'crosshair')
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const year = x.invert(mx);
				const i = bisect(values, year);
				const d = values[i];
				if (!d) return;

				crosshairV.attr('x1', x(d.year)).attr('x2', x(d.year)).attr('opacity', 1);
				hoverDot.attr('cx', x(d.year)).attr('cy', y(d.value)).attr('opacity', 1);

				showTooltip(event,
					`<strong>${d.year}</strong><br/>` +
					`<span style="color:#6b7280">${label}</span><br/>` +
					`<strong style="color:${color}">${formatValue(d.value)}</strong>`
				);
			})
			.on('mouseleave', () => {
				crosshairV.attr('opacity', 0);
				hoverDot.attr('opacity', 0);
				hideTooltip();
			});

		// Decorative year dots (non-interactive)
		svg.selectAll('circle.year-dot')
			.data(values).join('circle').attr('class', 'year-dot')
			.attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.value))
			.attr('r', 3).attr('fill', color)
			.style('pointer-events', 'none');
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

<!-- Floating tooltip -->
{#if tooltip.visible}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
		style="left:{tooltip.x + 14}px; top:{tooltip.y - 10}px; font-size:12px; line-height:1.6; min-width:160px"
	>
		{@html tooltip.html}
	</div>
{/if}

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
		Air Traffic Data from Bureau of Transportation Statistics. Hover to inspect a year.
	</figcaption>
</figure>