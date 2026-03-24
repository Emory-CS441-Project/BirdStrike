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

	const MARGIN = { top: 24, right: 24, bottom: 56, left: 80 };
	const HEIGHT = 420;
	const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;
	const COLORS = ['#378ADD', '#1D9E75', '#D85A30', '#7F77DD'];

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
			.attr('x1', 0)
			.attr('x2', innerWidth)
			.attr('y1', (d) => y(d))
			.attr('y2', (d) => y(d));

		root
			.append('g')
			.call(
				d3
					.axisLeft(y)
					.ticks(6)
					.tickFormat((d) =>
						d3
							.format('$~s')(d as number)
							.replace('G', 'B')
					)
			)
			.call((g) => g.select('.domain').remove())
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '12px'));

		root
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -INNER_H / 2)
			.attr('y', -64)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', 'currentColor')
			.attr('opacity', 0.5)
			.text('Inflation adjusted cost (log scale)');

		root
			.append('g')
			.attr('transform', `translate(0,${INNER_H})`)
			.call(d3.axisBottom(x).tickSize(0))
			.call((g) => g.select('.domain').attr('stroke', 'currentColor').attr('opacity', 0.15))
			.call((g) =>
				g
					.selectAll('text')
					.attr('fill', 'currentColor')
					.attr('font-size', '13px')
					.attr('dy', '1.4em')
			);

		for (const group of groups) {
			const s = group.stats!;
			const c = group.color;
			const bx = x(group.category)!;
			const bw = x.bandwidth();
			const cx = bx + bw / 2;
			const cap = bw * 0.25;
			const g = root.append('g');

			g.append('line')
				.attr('x1', cx)
				.attr('x2', cx)
				.attr('y1', y(s.whiskerLow))
				.attr('y2', y(s.q1))
				.attr('stroke', c)
				.attr('stroke-width', 1.5)
				.attr('stroke-dasharray', '3,3');
			g.append('line')
				.attr('x1', cx)
				.attr('x2', cx)
				.attr('y1', y(s.q3))
				.attr('y2', y(s.whiskerHigh))
				.attr('stroke', c)
				.attr('stroke-width', 1.5)
				.attr('stroke-dasharray', '3,3');
			g.append('line')
				.attr('x1', cx - cap)
				.attr('x2', cx + cap)
				.attr('y1', y(s.whiskerLow))
				.attr('y2', y(s.whiskerLow))
				.attr('stroke', c)
				.attr('stroke-width', 1.5);
			g.append('line')
				.attr('x1', cx - cap)
				.attr('x2', cx + cap)
				.attr('y1', y(s.whiskerHigh))
				.attr('y2', y(s.whiskerHigh))
				.attr('stroke', c)
				.attr('stroke-width', 1.5);
			g.append('rect')
				.attr('x', bx)
				.attr('y', y(s.q3))
				.attr('width', bw)
				.attr('height', y(s.q1) - y(s.q3))
				.attr('fill', c)
				.attr('opacity', 0.55)
				.attr('rx', 3);
			g.append('line')
				.attr('x1', bx)
				.attr('x2', bx + bw)
				.attr('y1', y(s.median))
				.attr('y2', y(s.median))
				.attr('stroke', 'white')
				.attr('stroke-width', 2);
			root
				.append('text')
				.attr('x', cx)
				.attr('y', y(s.median) - 6)
				.attr('text-anchor', 'middle')
				.attr('font-size', '12px')
				.attr('fill', 'currentColor')
				.attr('opacity', 0.7)
				.text(d3.format('$~s')(s.median).replace('G', 'B'));
			g.selectAll('circle')
				.data(s.outliers)
				.join('circle')
				.attr('cx', cx)
				.attr('cy', (d) => y(d))
				.attr('r', 2.5)
				.attr('fill', c)
				.attr('opacity', 0.35);
			root
				.append('text')
				.attr('x', cx)
				.attr('y', INNER_H + 42)
				.attr('text-anchor', 'middle')
				.attr('font-size', '11px')
				.attr('fill', 'currentColor')
				.attr('opacity', 0.45)
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
		root
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

		// Area fill under line
		const area = d3
			.area<TrendRow>()
			.x((d) => x(d.year))
			.y0(INNER_H)
			.y1((d) => y(d.avg_total_cost))
			.curve(d3.curveMonotoneX);

		root
			.append('path')
			.datum(trendData)
			.attr('fill', '#378ADD')
			.attr('opacity', 0.08)
			.attr('d', area);

		root
			.append('g')
			.attr('transform', `translate(0,${INNER_H})`)
			.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(8))
			.call((g) => g.select('.domain').attr('stroke', 'currentColor').attr('opacity', 0.15))
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '11px'));

		root
			.append('g')
			.call(
				d3
					.axisLeft(y)
					.ticks(6)
					.tickFormat((d) =>
						d3
							.format('$~s')(d as number)
							.replace('G', 'B')
					)
			)
			.call((g) => g.select('.domain').remove())
			.call((g) => g.selectAll('text').attr('fill', 'currentColor').attr('font-size', '12px'));

		root
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -INNER_H / 2)
			.attr('y', -64)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', 'currentColor')
			.attr('opacity', 0.5)
			.text('Avg inflation adjusted cost');

		root
			.append('path')
			.datum(trendData)
			.attr('fill', 'none')
			.attr('stroke', '#378ADD')
			.attr('stroke-width', 2)
			.attr('d', line);

		// Dots on each year
		root
			.selectAll('circle')
			.data(trendData)
			.join('circle')
			.attr('cx', (d) => x(d.year))
			.attr('cy', (d) => y(d.avg_total_cost))
			.attr('r', 3)
			.attr('fill', '#378ADD');
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
          {mode === 'box'
					? 'bg-gray-700 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'box')}
			>
				By category
			</button>
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
          {mode === 'trend'
					? 'bg-gray-700 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (mode = 'trend')}
			>
				Cost over time
			</button>
		</div>
	</div>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">
		{mode === 'box'
			? 'Boxes show IQR, line shows median, dots are outliers. Log scale for visibility.'
			: 'Average total inflation adjusted cost per incident over time. Linear Scale.'}
	</figcaption>
</figure>
