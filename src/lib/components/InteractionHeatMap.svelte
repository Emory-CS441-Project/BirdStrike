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

	// Tooltip state
	interface TooltipState {
		visible: boolean;
		x: number;
		y: number;
		species: string;
		operator: string;
		birds: number;
	}
	let tooltip: TooltipState = $state({
		visible: false, x: 0, y: 0, species: '', operator: '', birds: 0
	});

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

		// cells with hover interactivity
		species.forEach((sp, si) => {
			operators.forEach((op, oi) => {
				const entry = cellMap.get(`${sp}|${op}`);
				const v = entry?.birds ?? 0;

				g.append('rect')
					.attr('x', oi * STEP)
					.attr('y', si * STEP)
					.attr('width', CELL)
					.attr('height', CELL)
					.attr('rx', 2)
					.attr('fill', color(v))
					.style('cursor', 'default')
					.style('transition', 'opacity 0.1s')
					.on('mousemove', (event) => {
						// Highlight: slight brightness via opacity shift on siblings handled via tooltip state
						tooltip = {
							visible: true,
							x: event.clientX,
							y: event.clientY,
							species: sp,
							operator: op,
							birds: v
						};
						// Dim all cells, brighten this one
						g.selectAll('rect').style('opacity', 0.45);
						d3.select(event.currentTarget as SVGRectElement).style('opacity', 1);
					})
					.on('mouseleave', () => {
						tooltip = { ...tooltip, visible: false };
						g.selectAll('rect').style('opacity', 1);
					});
			});
		});

		// gradient legend
		const legendY = species.length * STEP + 16;
		const gradId = 'hm-legend-grad';

		const defs = svg.append('defs');
		const grad = defs
			.append('linearGradient')
			.attr('id', gradId)
			.attr('x1', '0%')
			.attr('x2', '100%');

		['#e0f2fe', '#38bdf8', '#1d6fa4', '#1e3a5f'].forEach((c, i, arr) => {
			grad.append('stop')
				.attr('offset', `${(i / (arr.length - 1)) * 100}%`)
				.attr('stop-color', c);
		});

		g.append('rect')
			.attr('x', 0).attr('y', legendY)
			.attr('width', gridW).attr('height', 7)
			.attr('rx', 2).attr('fill', `url(#${gradId})`);

		g.append('text')
			.attr('x', 0).attr('y', legendY + 17)
			.attr('font-size', 10).attr('font-family', 'monospace')
			.attr('fill', '#64748b').text('0');

		g.append('text')
			.attr('x', gridW).attr('y', legendY + 17)
			.attr('text-anchor', 'end')
			.attr('font-size', 10).attr('font-family', 'monospace')
			.attr('fill', '#64748b').text(maxBirds.toLocaleString());
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

<!-- Floating tooltip -->
{#if tooltip.visible}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
		style="left:{tooltip.x + 14}px; top:{tooltip.y - 10}px; font-size:13px; line-height:1.6; min-width:160px"
	>
		<div class="font-semibold text-gray-800">{tooltip.species}</div>
		<div class="text-gray-500 text-xs">{tooltip.operator}</div>
		<div class="mt-1 text-gray-700">
			{#if tooltip.birds === 0}
				<span class="text-gray-400 italic">No recorded strikes</span>
			{:else}
				<strong>{tooltip.birds.toLocaleString()}</strong> birds struck
			{/if}
		</div>
	</div>
{/if}

<figure class="overflow-visible font-mono">
	<div class="overflow-visible">
		<svg bind:this={svgEl}></svg>
	</div>
	<figcaption class="mt-2 ml-15 text-xs text-slate-500">
		Bird strikes between the most active species and airlines. Hover a cell for details.
	</figcaption>
</figure>