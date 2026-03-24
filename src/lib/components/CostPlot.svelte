<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let svgEl: SVGSVGElement;
	let data: any[] = [];

	const PART_GROUPS = [
    {
        key: 'ENGINES',
        label: 'Engines',
        parts: ['ENG1', 'ENG2', 'ENG3', 'ENG4']
    },
    {
        key: 'STRUCTURE',
        label: 'Fuselage & Structure',
        parts: ['FUSE', 'TAIL', 'WING_ROT', 'LG']
    },
    {
        key: 'COCKPIT',
        label: 'Cockpit & Sensors',
        parts: ['WINDSHLD', 'NOSE', 'RAD']
    },
    {
        key: 'OTHER',
        label: 'Other',
        parts: ['PROP', 'LGHTS', 'OTHER']
    },
];

function isGroupHit(row: any, parts: string[]): boolean {
    return parts.some(
        (part) => row[`STR_${part}`] === '1' && row[`DAM_${part}`] === '1'
    );
}

	function totalCost(row: any): number {
		return (row.COST_REPAIRS ?? 0) + (row.COST_OTHER ?? 0);
	}

	function boxStats(values: number[]) {
		const sorted = [...values].sort((a, b) => a - b);
		const q1 = d3.quantile(sorted, 0.25)!;
		const median = d3.quantile(sorted, 0.5)!;
		const q3 = d3.quantile(sorted, 0.75)!;
		const iqr = q3 - q1;
		const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr);
		const whiskerHigh = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
		const outliers = sorted.filter((v) => v < whiskerLow || v > whiskerHigh);
		return { q1, median, q3, whiskerLow, whiskerHigh, outliers };
	}

	function draw() {
		if (!data.length) return;

		const margin = { top: 20, right: 20, bottom: 60, left: 80 };
		const width = svgEl.clientWidth;
		const height = 400;
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		d3.select(svgEl).selectAll('*').remove();

		// --- Data prep ---
		const groups = new Map<string, { label: string; costs: number[] }>();
for (const { key, label } of PART_GROUPS) {
    groups.set(key, { label, costs: [] });
}

for (const row of data) {
    const cost = totalCost(row);
    if (cost <= 0) continue;

    for (const { key, parts } of PART_GROUPS) {
        if (isGroupHit(row, parts)) {
            groups.get(key)!.costs.push(cost);
            break; // assign to first matching group only
        }
    }
}

		const activeGroups = [...groups.entries()]
			.filter(([, g]) => g.costs.length >= 3)
			.map(([key, g]) => ({ key, ...g, stats: boxStats(g.costs) }))
			.sort((a, b) => b.stats.median - a.stats.median);

		if (activeGroups.length === 0) return;

		const allLabels = activeGroups.map((g) => g.label);

		// --- Scales ---
		const x = d3
			.scaleBand()
			.domain(allLabels)
			.range([0, innerWidth])
			.padding(0.3);

		const allValues = activeGroups.flatMap((g) => [
			g.stats.whiskerLow,
			g.stats.whiskerHigh,
			...g.stats.outliers,
		]);

		const y = d3
			.scaleLog()
			.domain([Math.max(1, d3.min(allValues)!), d3.max(allValues)!])
			.nice()
			.range([innerHeight, 0]);

		const color = d3
			.scaleOrdinal<string>()
			.domain(allLabels)
			.range(d3.schemeTableau10);

		// --- Legend ---
		const legendItemHeight = 20;
		const legendCols = Math.floor(innerWidth / 160);
		const legendRows = Math.ceil(allLabels.length / legendCols);
		const legendHeight = legendRows * legendItemHeight + 12;
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
			.call(d3.axisBottom(x))
			.selectAll('text')
			.attr('transform', 'rotate(-30)')
			.attr('text-anchor', 'end')
			.attr('dx', '-0.5em')
			.attr('dy', '0.15em');

		svg.append('g').call(
    d3.axisLeft(y)
        .ticks(6)
        .tickFormat((d) =>
            d3.format('$~s')(d as number).replace('G', 'B')
        )
);

		svg.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -innerHeight / 2)
			.attr('y', -60)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', 'currentColor')
			.text('Total Cost (log scale)');

		// --- Box plots ---
		for (const group of activeGroups) {
			const { label, stats } = group;
			const cx = x(label)! + x.bandwidth() / 2;
			const bw = x.bandwidth();
			const c = color(label);

			const g = svg.append('g');

			g.append('line')
				.attr('x1', cx).attr('x2', cx)
				.attr('y1', y(stats.whiskerLow)).attr('y2', y(stats.q1))
				.attr('stroke', c).attr('stroke-dasharray', '3,3');

			g.append('line')
				.attr('x1', cx).attr('x2', cx)
				.attr('y1', y(stats.q3)).attr('y2', y(stats.whiskerHigh))
				.attr('stroke', c).attr('stroke-dasharray', '3,3');

			g.append('line')
				.attr('x1', cx - bw * 0.2).attr('x2', cx + bw * 0.2)
				.attr('y1', y(stats.whiskerLow)).attr('y2', y(stats.whiskerLow))
				.attr('stroke', c);

			g.append('line')
				.attr('x1', cx - bw * 0.2).attr('x2', cx + bw * 0.2)
				.attr('y1', y(stats.whiskerHigh)).attr('y2', y(stats.whiskerHigh))
				.attr('stroke', c);

			g.append('rect')
				.attr('x', x(label)!)
				.attr('y', y(stats.q3))
				.attr('width', bw)
				.attr('height', y(stats.q1) - y(stats.q3))
				.attr('fill', c)
				.attr('opacity', 0.6)
				.attr('rx', 2);

			g.append('line')
				.attr('x1', x(label)!).attr('x2', x(label)! + bw)
				.attr('y1', y(stats.median)).attr('y2', y(stats.median))
				.attr('stroke', 'white')
				.attr('stroke-width', 2);

			g.selectAll('circle')
				.data(stats.outliers)
				.join('circle')
				.attr('cx', cx)
				.attr('cy', (d) => y(d))
				.attr('r', 3)
				.attr('fill', c)
				.attr('opacity', 0.4);
		}

		// --- Legend (above chart) ---
		const legend = d3
			.select(svgEl)
			.append('g')
			.attr('transform', `translate(${margin.left}, ${margin.top})`);

		allLabels.forEach((label, i) => {
			const col = i % legendCols;
			const row = Math.floor(i / legendCols);
			const g = legend
				.append('g')
				.attr('transform', `translate(${col * 160}, ${row * legendItemHeight})`);

			g.append('rect')
				.attr('width', 12)
				.attr('height', 12)
				.attr('rx', 2)
				.attr('fill', color(label));

			g.append('text')
				.attr('x', 18)
				.attr('y', 10)
				.attr('font-size', '12px')
				.attr('fill', 'currentColor')
				.text(label);
		});
	}

	onMount(async () => {
		const res = await fetch('/NewCost.json');
		data = await res.json();
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => ro.disconnect();
	});
</script>

<figure>
	<svg bind:this={svgEl} class="block w-full"></svg>
	<figcaption class="mt-2 text-sm text-gray-500">
		Repair cost distribution by aircraft part struck and damaged (log scale)
	</figcaption>
</figure>