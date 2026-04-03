<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface DamageGroup {
		category: string;
		values: number[];
	}

	interface TrendRow {
		year: number;
		avg_total_cost: number;
	}

	interface Props {
		boxData: DamageGroup[];
		trendData: TrendRow[];
	}

	let { boxData, trendData }: Props = $props();

	let svgEl: SVGSVGElement;
	let mode: 'box' | 'trend' = $state('box');

	// Tooltip state
	interface TooltipState { visible: boolean; x: number; y: number; html: string; }
	let tooltip: TooltipState = $state({ visible: false, x: 0, y: 0, html: '' });

	const MARGIN = { top: 24, right: 24, bottom: 56, left: 80 };
	const HEIGHT = 420;
	const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;
	const COLORS = ['#378ADD', '#1D9E75', '#D85A30', '#7F77DD'];

	const fmt = (v: number) => d3.format('$~s')(v).replace('G', 'B');

	function boxStats(values: number[]) {
		const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b);
		if (sorted.length < 3) return null;
		const q1 = d3.quantile(sorted, 0.25)!;
		const median = d3.quantile(sorted, 0.5)!;
		const q3 = d3.quantile(sorted, 0.75)!;
		const iqr = q3 - q1;
		const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr);
		const whiskerHigh = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
		const outliers = sorted.filter((v) => v < whiskerLow || v > whiskerHigh);
		return { q1, median, q3, whiskerLow, whiskerHigh, outliers, n: sorted.length };
	}

	function showTooltip(event: MouseEvent, html: string) {
		tooltip = { visible: true, x: event.clientX, y: event.clientY, html };
	}
	function moveTooltip(event: MouseEvent) {
		tooltip = { ...tooltip, x: event.clientX, y: event.clientY };
	}
	function hideTooltip() {
		tooltip = { ...tooltip, visible: false };
	}

	function draw() {
		if (!svgEl || svgEl.clientWidth === 0) return;
		mode === 'box' ? drawBox() : drawTrend();
	}

	function drawBox() {
		const innerWidth = svgEl.clientWidth - MARGIN.left - MARGIN.right;

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${svgEl.clientWidth} ${HEIGHT}`);

		const groups = boxData
			.map((d, i) => ({ ...d, stats: boxStats(d.values), color: COLORS[i % COLORS.length] }))
			.filter((d) => d.stats !== null);

		const allValues = groups.flatMap((g) => [
			g.stats!.whiskerLow,
			g.stats!.whiskerHigh,
			...g.stats!.outliers
		]);
		const y = d3
			.scaleLog()
			.domain([Math.max(1, d3.min(allValues)!), d3.max(allValues)!])
			.nice()
			.range([INNER_H, 0]);

		const x = d3
			.scaleBand()
			.domain(groups.map((g) => g.category))
			.range([0, innerWidth])
			.padding(0.35);

		const root = d3
			.select(svgEl)
			.append('g')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		root
			.append('g')
			.attr('stroke', 'currentColor')
			.attr('stroke-opacity', 0.08)
			.selectAll('line')
			.data(y.ticks(6))
			.join('line')
			.attr('x1', 0).attr('x2', innerWidth)
			.attr('y1', (d) => y(d)).attr('y2', (d) => y(d));

		root
			.append('g')
			.call(
				d3.axisLeft(y).ticks(6)
					.tickFormat((d) => fmt(d as number))
			)
			.call((g) => g.select('.domain').remove())
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '12px'));

		root
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -INNER_H / 2).attr('y', -64)
			.attr('text-anchor', 'middle').attr('font-size', '12px')
			.attr('fill', 'currentColor').attr('opacity', 0.5)
			.text('Inflation adjusted cost (log scale)');

		root
			.append('g')
			.attr('transform', `translate(0,${INNER_H})`)
			.call(d3.axisBottom(x).tickSize(0))
			.call((g) => g.select('.domain').attr('stroke', 'currentColor').attr('opacity', 0.15))
			.call((g) =>
				g.selectAll('text')
					.attr('fill', 'currentColor').attr('font-size', '13px').attr('dy', '1.4em')
			);

		for (const group of groups) {
			const s = group.stats!;
			const c = group.color;
			const bx = x(group.category)!;
			const bw = x.bandwidth();
			const cx = bx + bw / 2;
			const cap = bw * 0.25;
			const g = root.append('g');

			// Whiskers
			g.append('line').attr('x1', cx).attr('x2', cx)
				.attr('y1', y(s.whiskerLow)).attr('y2', y(s.q1))
				.attr('stroke', c).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,3');
			g.append('line').attr('x1', cx).attr('x2', cx)
				.attr('y1', y(s.q3)).attr('y2', y(s.whiskerHigh))
				.attr('stroke', c).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,3');

			// Whisker caps
			g.append('line').attr('x1', cx - cap).attr('x2', cx + cap)
				.attr('y1', y(s.whiskerLow)).attr('y2', y(s.whiskerLow))
				.attr('stroke', c).attr('stroke-width', 1.5);
			g.append('line').attr('x1', cx - cap).attr('x2', cx + cap)
				.attr('y1', y(s.whiskerHigh)).attr('y2', y(s.whiskerHigh))
				.attr('stroke', c).attr('stroke-width', 1.5);

			// IQR box
			g.append('rect')
				.attr('x', bx).attr('y', y(s.q3))
				.attr('width', bw).attr('height', y(s.q1) - y(s.q3))
				.attr('fill', c).attr('opacity', 0.55).attr('rx', 3)
				.style('cursor', 'pointer')
				.on('mouseenter', (event) => {
					d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.85);
					showTooltip(
						event,
						`<strong>${group.category}</strong><br/>` +
						`<table style="border-collapse:collapse;margin-top:4px;width:100%">` +
						`<tr><td style="color:#6b7280;padding-right:8px">Upper whisker</td><td style="text-align:right;font-weight:600">${fmt(s.whiskerHigh)}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">Q3</td><td style="text-align:right;font-weight:600">${fmt(s.q3)}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">Median</td><td style="text-align:right;font-weight:600;color:${c}">${fmt(s.median)}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">Q1</td><td style="text-align:right;font-weight:600">${fmt(s.q1)}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">Lower whisker</td><td style="text-align:right;font-weight:600">${fmt(s.whiskerLow)}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">Outliers</td><td style="text-align:right">${s.outliers.length.toLocaleString()}</td></tr>` +
						`<tr><td style="color:#6b7280;padding-right:8px">n</td><td style="text-align:right">${s.n.toLocaleString()}</td></tr>` +
						`</table>`
					);
				})
				.on('mousemove', (event) => {
					moveTooltip(event);
				})
				.on('mouseleave', (event) => {
					d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.55);
					hideTooltip();
				});

			// Median line
			g.append('line')
				.attr('x1', bx).attr('x2', bx + bw)
				.attr('y1', y(s.median)).attr('y2', y(s.median))
				.attr('stroke', 'white').attr('stroke-width', 2)
				.style('pointer-events', 'none');

			// Median label
			root.append('text')
				.attr('x', cx).attr('y', y(s.median) - 6)
				.attr('text-anchor', 'middle').attr('font-size', '12px')
				.attr('fill', 'currentColor').attr('opacity', 0.7)
				.style('pointer-events', 'none')
				.text(fmt(s.median));

			// Outlier dots w/ tooltip
			g.selectAll('circle')
				.data(s.outliers)
				.join('circle')
				.attr('cx', cx).attr('cy', (d) => y(d))
				.attr('r', 3.5).attr('fill', c).attr('opacity', 0.45)
				.style('cursor', 'pointer')
				.on('mousemove', (event, d) => {
					d3.select(event.currentTarget as SVGCircleElement).attr('opacity', 1).attr('r', 5);
					showTooltip(event,
						`<strong>${group.category}</strong><br/>` +
						`<span style="color:#6b7280">Outlier value</span><br/>` +
						`<strong>${fmt(d)}</strong>`
					);
				})
				.on('mouseleave', (event) => {
					d3.select(event.currentTarget as SVGCircleElement).attr('opacity', 0.45).attr('r', 3.5);
					hideTooltip();
				});

			// n label
			root.append('text')
				.attr('x', cx).attr('y', INNER_H + 42)
				.attr('text-anchor', 'middle').attr('font-size', '11px')
				.attr('fill', 'currentColor').attr('opacity', 0.45)
				.text(`n=${s.n.toLocaleString()}`);
		}
	}

	function drawTrend() {
		const innerWidth = svgEl.clientWidth - MARGIN.left - MARGIN.right;

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${svgEl.clientWidth} ${HEIGHT}`);

		const x = d3
			.scaleLinear()
			.domain(d3.extent(trendData, (d) => d.year) as [number, number])
			.range([0, innerWidth]);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(trendData, (d) => d.avg_total_cost)!])
			.nice()
			.range([INNER_H, 0]);

		const line = d3
			.line<TrendRow>()
			.x((d) => x(d.year))
			.y((d) => y(d.avg_total_cost))
			.curve(d3.curveMonotoneX);

		const root = d3
			.select(svgEl)
			.append('g')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		// Gridlines
		root.append('g')
			.attr('stroke', 'currentColor').attr('stroke-opacity', 0.08)
			.selectAll('line').data(y.ticks(6)).join('line')
			.attr('x1', 0).attr('x2', innerWidth)
			.attr('y1', (d) => y(d)).attr('y2', (d) => y(d));

		// Area fill
		const area = d3.area<TrendRow>()
			.x((d) => x(d.year)).y0(INNER_H).y1((d) => y(d.avg_total_cost))
			.curve(d3.curveMonotoneX);

		root.append('path').datum(trendData)
			.attr('fill', '#378ADD').attr('opacity', 0.08).attr('d', area);

		// Axes
		root.append('g')
			.attr('transform', `translate(0,${INNER_H})`)
			.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(8))
			.call((g) => g.select('.domain').attr('stroke', 'currentColor').attr('opacity', 0.15))
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '11px'));

		root.append('g')
			.call(d3.axisLeft(y).ticks(6).tickFormat((d) => fmt(d as number)))
			.call((g) => g.select('.domain').remove())
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '12px'));

		root.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -INNER_H / 2).attr('y', -64)
			.attr('text-anchor', 'middle').attr('font-size', '12px')
			.attr('fill', 'currentColor').attr('opacity', 0.5)
			.text('Avg inflation adjusted cost');

		// Line
		root.append('path').datum(trendData)
			.attr('fill', 'none').attr('stroke', '#378ADD')
			.attr('stroke-width', 2).attr('d', line);

		// Crosshair elements (hidden until hover)
		const crosshairV = root.append('line')
			.attr('class', 'crosshair-v')
			.attr('y1', 0).attr('y2', INNER_H)
			.attr('stroke', '#94a3b8').attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,3').attr('opacity', 0);

		const hoverDot = root.append('circle')
			.attr('r', 5).attr('fill', '#378ADD')
			.attr('stroke', 'white').attr('stroke-width', 2)
			.attr('opacity', 0).style('pointer-events', 'none');

		// Bisector for finding nearest year
		const bisect = d3.bisector((d: TrendRow) => d.year).center;

		// Invisible overlay for mouse tracking
		root.append('rect')
			.attr('width', innerWidth).attr('height', INNER_H)
			.attr('fill', 'none').style('pointer-events', 'all')
			.style('cursor', 'crosshair')
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const year = x.invert(mx);
				const i = bisect(trendData, year);
				const d = trendData[i];
				if (!d) return;

				const px = x(d.year);
				const py = y(d.avg_total_cost);

				crosshairV.attr('x1', px).attr('x2', px).attr('opacity', 1);
				hoverDot.attr('cx', px).attr('cy', py).attr('opacity', 1);

				// Convert SVG coords to screen coords for tooltip
				const svgRect = svgEl.getBoundingClientRect();
				const scaleX = svgRect.width / svgEl.clientWidth;
				showTooltip(event,
					`<strong>${d.year}</strong><br/>` +
					`<span style="color:#6b7280">Avg cost per incident</span><br/>` +
					`<strong style="color:#378ADD">${fmt(d.avg_total_cost)}</strong>`
				);
			})
			.on('mouseleave', () => {
				crosshairV.attr('opacity', 0);
				hoverDot.attr('opacity', 0);
				hideTooltip();
			});

		// Dots on each data point (decorative)
		root.selectAll('circle.year-dot')
			.data(trendData)
			.join('circle').attr('class', 'year-dot')
			.attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.avg_total_cost))
			.attr('r', 3).attr('fill', '#378ADD')
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
		if (svgEl) draw();
	});
</script>

<!-- Floating tooltip -->
{#if tooltip.visible}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
		style="left:{tooltip.x + 14}px; top:{tooltip.y - 10}px; font-size:12px; line-height:1.5; min-width:190px"
	>
		{@html tooltip.html}
	</div>
{/if}

<figure>
	<div class="mb-3 flex items-center justify-between">
		<span class="text-sm text-gray-500">
			{mode === 'box'
				? 'Repair cost distribution by damage category'
				: 'Average inflation adjusted incident cost per year'}
		</span>
		<div class="flex gap-2">
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{mode === 'box' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'box')}
			>
				By category
			</button>
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
					{mode === 'trend' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'trend')}
			>
				Cost over time
			</button>
		</div>
	</div>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">
		{mode === 'box'
			? 'Boxes show IQR, line shows median, dots are outliers. Hover for full five-number summary. Log scale.'
			: 'Average total inflation adjusted cost per incident over time. Hover to inspect a year.'}
	</figcaption>
</figure>