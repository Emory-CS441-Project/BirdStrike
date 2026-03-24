<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { InteractionData } from '$lib/types';

	let { data }: { data: InteractionData } = $props();

	let svgEl = $state<SVGSVGElement>();

	const CELL = 18;
	const GAP = 2;
	const STEP = CELL + GAP;
	const ML = 130;
	const MT = 90;
	const MB = 44;

	const species = $derived([...new Set(data.heatmap.map((d) => d.species))]);
	const operators = $derived([...new Set(data.heatmap.map((d) => d.operator))]);
	const cellMap = $derived(new Map(data.heatmap.map((d) => [`${d.species}|${d.operator}`, d])));

	const color = $derived.by(() => {
		const max = d3.max(data.heatmap, (d) => d.birds) ?? 1;
		const scale = d3.scalePow().exponent(0.4).domain([0, max]).range([0, 1]);
		const interp = d3.interpolateRgbBasis(['#e0f2fe', '#38bdf8', '#1d6fa4', '#1e3a5f']);
		return (v: number) => (v > 0 ? interp(scale(v)) : '#0f172a');
	});

	const maxBirds = $derived(d3.max(data.heatmap, (d) => d.birds) ?? 1);

	function draw() {
		if (!svgEl) return;

		const gridW = operators.length * STEP - GAP;
		const W = ML + gridW + 4;
		const H = MT + species.length * STEP + MB;

		const svg = d3
			.select(svgEl)
			.attr('viewBox', `0 0 ${W} ${H}`)
			.attr('width', '100%')
			.attr('overflow', 'visible');

		svg.selectAll('*').remove();

		const g = svg.append('g').attr('transform', `translate(${ML}, ${MT})`);

		// column labels
		operators.forEach((op, i) => {
			const cx = i * STEP + CELL / 2;
			g.append('text')
				.attr('x', cx)
				.attr('y', -6)
				.attr('text-anchor', 'start')
				.attr('font-size', 10)
				.attr('font-family', 'monospace')
				.attr('fill', '#64748b')
				.attr('transform', `rotate(-45, ${cx}, -6)`)
				.text(op);
		});

		// row labels
		species.forEach((sp, i) => {
			g.append('text')
				.attr('x', -6)
				.attr('y', i * STEP + CELL / 2)
				.attr('dy', '0.35em')
				.attr('text-anchor', 'end')
				.attr('font-size', 10)
				.attr('font-family', 'monospace')
				.attr('fill', '#64748b')
				.text(sp);
		});

		// cells
		species.forEach((sp, si) => {
			operators.forEach((op, oi) => {
				const v = cellMap.get(`${sp}|${op}`)?.birds ?? 0;
				g.append('rect')
					.attr('x', oi * STEP)
					.attr('y', si * STEP)
					.attr('width', CELL)
					.attr('height', CELL)
					.attr('rx', 2)
					.attr('fill', color(v));
			});
		});

		// gradient legend — spans exact width of cell grid
		const legendY = species.length * STEP + 16;
		const gradId = 'hm-legend-grad';

		const defs = svg.append('defs');
		const grad = defs
			.append('linearGradient')
			.attr('id', gradId)
			.attr('x1', '0%')
			.attr('x2', '100%');

		['#e0f2fe', '#38bdf8', '#1d6fa4', '#1e3a5f'].forEach((c, i, arr) => {
			grad
				.append('stop')
				.attr('offset', `${(i / (arr.length - 1)) * 100}%`)
				.attr('stop-color', c);
		});

		g.append('rect')
			.attr('x', 0)
			.attr('y', legendY)
			.attr('width', gridW)
			.attr('height', 7)
			.attr('rx', 2)
			.attr('fill', `url(#${gradId})`);

		g.append('text')
			.attr('x', 0)
			.attr('y', legendY + 17)
			.attr('font-size', 10)
			.attr('font-family', 'monospace')
			.attr('fill', '#64748b')
			.text('0');

		g.append('text')
			.attr('x', gridW)
			.attr('y', legendY + 17)
			.attr('text-anchor', 'end')
			.attr('font-size', 10)
			.attr('font-family', 'monospace')
			.attr('fill', '#64748b')
			.text(maxBirds.toLocaleString());
	}

	$effect(() => {
		species;
		operators;
		draw();
	});

	onMount(() => {
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(svgEl!);
		return () => ro.disconnect();
	});
</script>

<figure class="overflow-visible font-mono">
	<p class="mb-1 text-xs tracking-widest text-slate-400 uppercase">Species × Airline</p>
	<p class="mb-3 text-xs text-slate-500">Estimated bird strikes</p>
	<div class="overflow-visible">
		<svg bind:this={svgEl}></svg>
	</div>
	<figcaption class="mt-2 text-xs text-slate-500">
		Bird strikes between the most active species and airlines
	</figcaption>
</figure>
