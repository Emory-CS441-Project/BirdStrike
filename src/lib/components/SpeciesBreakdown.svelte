<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface SpeciesRow {
		species: string;
		incidents: number;
		est_birds_struck: number;
	}

	interface Props {
		data: SpeciesRow[];
	}

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;
	let metric: 'incidents' | 'est_birds_struck' = $state('incidents');
	let minThreshold = $state(3000);

	const MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };
	const HEIGHT = 600;

	const color = d3.scaleOrdinal(d3.schemeTableau10);

	function draw() {
		const width = svgEl.clientWidth;
		const innerWidth = width - MARGIN.left - MARGIN.right;
		const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

		d3.select(svgEl).selectAll('*').remove();

		const filtered = data.filter((d) => d[metric] >= minThreshold);

		const root = d3
			.hierarchy({ children: filtered } as any)
			.sum((d: any) => d[metric])
			.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

		d3.treemap<any>().size([innerWidth, innerHeight]).paddingOuter(3).paddingInner(2).round(true)(
			root
		);

		const svg = d3
			.select(svgEl)
			.attr('viewBox', `0 0 ${width} ${HEIGHT}`)
			.append('g')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		const tooltip = d3
			.select('body')
			.selectAll('.treemap-tooltip')
			.data([null])
			.join('div')
			.attr('class', 'treemap-tooltip')
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

		const leaves = root.leaves();

		const cell = svg
			.selectAll('g')
			.data(leaves)
			.join('g')
			.attr('transform', (d: any) => `translate(${d.x0},${d.y0})`)
			.style('cursor', 'default')
			.on('mousemove', (event, d: any) => {
				tooltip
					.style('opacity', '1')
					.style('left', `${event.clientX + 12}px`)
					.style('top', `${event.clientY - 10}px`)
					.html(
						`<strong>${d.data.species}</strong><br/>` +
							`Incidents: ${d.data.incidents.toLocaleString()}<br/>` +
							`Est. birds struck: ${d.data.est_birds_struck.toLocaleString()}`
					);
			})
			.on('mouseleave', () => tooltip.style('opacity', '0'));

		cell
			.append('rect')
			.attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
			.attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
			.attr('rx', 3)
			.attr('fill', (d: any) => color(d.data.species))
			.attr('opacity', 0.85);

		cell
			.append('clipPath')
			.attr('id', (_: any, i: number) => `clip-${i}`)
			.append('rect')
			.attr('width', (d: any) => Math.max(0, d.x1 - d.x0 - 4))
			.attr('height', (d: any) => Math.max(0, d.y1 - d.y0 - 4));

		cell
			.append('text')
			.attr('clip-path', (_: any, i: number) => `url(#clip-${i})`)
			.attr('x', 5)
			.attr('y', 14)
			.attr('font-size', (d: any) => {
				const w = d.x1 - d.x0;
				const h = d.y1 - d.y0;
				return Math.min(13, Math.max(9, Math.sqrt(w * h) / 10)) + 'px';
			})
			.attr('fill', '#fff')
			.attr('font-weight', 500)
			.style('pointer-events', 'none')
			.each(function (d: any) {
				const w = d.x1 - d.x0;
				const h = d.y1 - d.y0;
				if (w < 40 || h < 18) return;
				const el = d3.select(this);
				el.text(d.data.species);
				if (h > 30) {
					el.append('tspan')
						.attr('x', 5)
						.attr('dy', '1.3em')
						.attr('font-weight', 400)
						.attr('font-size', '10px')
						.text(d.data[metric].toLocaleString());
				}
			});
	}

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		metric;
		minThreshold;
		if (svgEl) draw();
	});
</script>

<figure>
	<div class="mb-3 flex items-center gap-2">
		<div class="mr-auto flex gap-2">
			<button
				class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
          {metric === 'incidents'
					? 'bg-gray-700 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
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
		<div class="m-auto flex text-lg">Bird Strikes by Species</div>
		<div class="ml-auto flex items-center gap-2 text-sm text-gray-600">
			<label for="threshold">Min. incidents:</label>
			<select
				id="threshold"
				class="rounded border border-gray-300 px-2 py-1 text-sm"
				bind:value={minThreshold}
			>
				<option value={0}>0+</option>
				<option value={50}>50+</option>
				<option value={500}>500+</option>
				<option value={3000}>3000+</option>
			</select>
		</div>
	</div>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">
		Area proportional to selected metric. Hover for details.
	</figcaption>
</figure>
