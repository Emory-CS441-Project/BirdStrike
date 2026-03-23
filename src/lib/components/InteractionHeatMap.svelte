<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { InteractionData, InteractionRow } from '$lib/types';

	let { data }: { data: InteractionData } = $props();

	type Sel = { species?: string; operator?: string } | null;

	let sel = $state<Sel>(null);
	let svgEl = $state<SVGSVGElement>();

	const CELL = 20;
	const ML = 120;
	const MT = 100;
	const MR = 60;
	const CHART_H = 110;

	const MONTH_NAMES = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const TIME_COLORS: Record<string, string> = {
		Dawn: '#f59e0b',
		Day: '#93c5fd',
		Dusk: '#f97316',
		Night: '#818cf8'
	};

	// reactive from props
	const species = $derived([...new Set(data.heatmap.map((d) => d.species))]);
	const operators = $derived([...new Set(data.heatmap.map((d) => d.operator))]);
	const cellMap = $derived(new Map(data.heatmap.map((d) => [`${d.species}|${d.operator}`, d])));

	const color = $derived.by(() => {
		const max = d3.max(data.heatmap, (d) => d.birds) ?? 1;
		const scale = d3.scalePow().exponent(0.4).domain([max, 0]).range([0, 1]);
		const interp = d3.interpolateRgbBasis(['#1e3a5f', '#1d6fa4', '#38bdf8', '#e0f2fe']);
		return (v: number) => (v > 0 ? interp(scale(v)) : '#0f172a');
	});

	// detail data
	function filterRows(rows: InteractionRow[]): InteractionRow[] {
		if (!sel) return [];
		const { species: sp, operator: op } = sel;
		return rows.filter((d) => (sp ? d.species === sp : true) && (op ? d.operator === op : true));
	}

	function rollup<K extends keyof InteractionRow>(rows: InteractionRow[], key: K) {
		return d3
			.rollups(
				rows,
				(v) => d3.sum(v, (d) => d.birds),
				(d) => d[key] as string | number
			)
			.sort((a, b) => b[1] - a[1]);
	}

	const phaseData = $derived(rollup(filterRows(data.phase), 'phase').slice(0, 4));
	const timeData = $derived(rollup(filterRows(data.time), 'time'));
	const maxP = $derived(phaseData[0]?.[1] ?? 1);
	const maxT = $derived(timeData[0]?.[1] ?? 1);

	const monthData = $derived(
		d3
			.rollups(
				filterRows(data.monthly),
				(v) => d3.sum(v, (d) => d.birds),
				(d) => d.month as number
			)
			.sort((a, b) => a[0] - b[0])
	);

	const monthPath = $derived.by(() => {
		const H = CHART_H - 4;
		const W = 200;
		const maxV = sel ? (d3.max(monthData, (d) => d[1]) ?? 1) : 1;
		const points = MONTH_NAMES.map((_, i) => {
			const v = sel ? (monthData.find((d) => d[0] === i + 1)?.[1] ?? 0) : 0;
			return [i * (W / 11), H - (v / maxV) * H] as [number, number];
		});
		const line = d3
			.line<[number, number]>()
			.x((d) => d[0])
			.y((d) => d[1])
			.curve(d3.curveCatmullRom);
		const area = d3
			.area<[number, number]>()
			.x((d) => d[0])
			.y0(H)
			.y1((d) => d[1])
			.curve(d3.curveCatmullRom);
		return { line: line(points) ?? '', area: area(points) ?? '', points, hasData: !!sel };
	});

	// selection
	function clickCell(sp: string, op: string) {
		sel = sel?.species === sp && sel?.operator === op ? null : { species: sp, operator: op };
	}
	function clickRow(sp: string) {
		sel = sel?.species === sp && !sel?.operator ? null : { species: sp };
	}
	function clickCol(op: string) {
		sel = sel?.operator === op && !sel?.species ? null : { operator: op };
	}

	function isActive(sp: string, op: string) {
		if (!sel) return false;
		if (sel.species && sel.operator) return sel.species === sp && sel.operator === op;
		if (sel.species) return sel.species === sp;
		if (sel.operator) return sel.operator === op;
		return false;
	}

	// draw
	function draw() {
		if (!svgEl) return;
		const W = ML + operators.length * CELL + MR;
		const H = MT + species.length * CELL + 8;

		const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
		svg.selectAll('*').remove();
		const g = svg.append('g').attr('transform', `translate(${ML},${MT})`);

		const x = d3
			.scaleBand()
			.domain(operators)
			.range([0, operators.length * CELL])
			.padding(0.06);
		const y = d3
			.scaleBand()
			.domain(species)
			.range([0, species.length * CELL])
			.padding(0.06);

		species.forEach((sp) => {
			g.append('text')
				.attr('x', -6)
				.attr('y', (y(sp) ?? 0) + y.bandwidth() / 2)
				.attr('dy', '0.35em')
				.attr('text-anchor', 'end')
				.attr('font-size', 7)
				.attr('font-family', 'monospace')
				.attr('fill', sel?.species === sp && !sel?.operator ? '#38bdf8' : '#64748b')
				.attr('cursor', 'pointer')
				.text(sp)
				.on('click', () => {
					clickRow(sp);
					draw();
				});
		});

		operators.forEach((op) => {
			const cx = (x(op) ?? 0) + x.bandwidth() / 2;
			g.append('text')
				.attr('x', cx)
				.attr('y', -8)
				.attr('text-anchor', 'start')
				.attr('font-size', 7)
				.attr('font-family', 'monospace')
				.attr('fill', sel?.operator === op && !sel?.species ? '#38bdf8' : '#64748b')
				.attr('cursor', 'pointer')
				.attr('transform', `rotate(-45, ${cx}, -8)`)
				.text(op)
				.on('click', () => {
					clickCol(op);
					draw();
				});
		});

		species.forEach((sp) => {
			operators.forEach((op) => {
				const d = cellMap.get(`${sp}|${op}`);
				const v = d?.birds ?? 0;
				g.append('rect')
					.attr('x', x(op) ?? 0)
					.attr('y', y(sp) ?? 0)
					.attr('width', x.bandwidth())
					.attr('height', y.bandwidth())
					.attr('rx', 2)
					.attr('fill', color(v))
					.attr('stroke', isActive(sp, op) ? '#38bdf8' : 'none')
					.attr('stroke-width', 1.5)
					.attr('cursor', v > 0 ? 'pointer' : 'default')
					.on('click', () => {
						if (v) {
							clickCell(sp, op);
							draw();
						}
					});
			});
		});
	}

	$effect(() => {
		sel;
		draw();
	});

	onMount(() => {
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(svgEl!);
		return () => ro.disconnect();
	});

	const selLabel = $derived(
		!sel
			? null
			: sel.species && sel.operator
				? `${sel.species} · ${sel.operator}`
				: sel.species
					? sel.species
					: sel.operator
	);

	const pct = (v: number, max: number) => `${max > 0 ? (v / max) * 100 : 0}%`;
</script>

<div class="relative rounded-lg bg-slate-900 p-4 font-mono text-slate-300">
	<svg bind:this={svgEl}></svg>

	<div class="absolute top-0 left-0 p-4">
		<p class="mb-1 tracking-widest text-slate-200 uppercase">Species x Airline</p>
		<p class="mb-2 max-w-xl text-sm text-slate-400">
			Estimated bird strikes between the most active species and airlines. Click on a cell, row, or
			col to see specific interaction data.
		</p>
	</div>

	<div class="mt-3 border-t border-slate-800 pt-3">
		<div class="mb-3 flex min-h-5 items-center justify-between">
			{#if sel}
				<span class="text-sm text-sky-400">{selLabel}</span>
				<button
					onclick={() => {
						sel = null;
						draw();
					}}
					class="cursor-pointer text-sm text-slate-600 hover:text-slate-400">clear</button
				>
			{:else}
				<span class="text-xs text-slate-600">Click a cell, row, or column to filter</span>
			{/if}
		</div>

		<div class="grid grid-cols-3 gap-5 pb-4">
			<div>
				<p class="mb-2 text-sm text-slate-300 uppercase">Phase of flight</p>
				<div style="height:{CHART_H}px" class="flex flex-col justify-between">
					{#each sel ? phaseData : [] as [phase, birds]}
						<div>
							<div class="mb-1 flex justify-between text-xs">
								<span class="text-slate-300">{phase}</span>
								<span class="text-slate-500">{birds.toLocaleString()}</span>
							</div>
							<div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
								<div class="h-full rounded-full bg-sky-500" style="width:{pct(birds, maxP)}"></div>
							</div>
						</div>
					{:else}
						<p class="self-start text-xs text-slate-700">—</p>
					{/each}
				</div>
			</div>

			<div>
				<p class="mb-2 text-sm text-slate-300 uppercase">Time of day</p>
				<div style="height:{CHART_H}px" class="flex flex-col justify-between">
					{#each sel ? timeData : [] as [time, birds]}
						<div>
							<div class="mb-1 flex justify-between text-xs">
								<span class="text-slate-300">{time}</span>
								<span class="text-slate-500">{birds.toLocaleString()}</span>
							</div>
							<div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
								<div
									class="h-full rounded-full"
									style="width:{pct(birds, maxT)};background:{TIME_COLORS[time as string] ??
										'#38bdf8'}"
								></div>
							</div>
						</div>
					{:else}
						<p class="self-start text-xs text-slate-700">—</p>
					{/each}
				</div>
			</div>

			<div>
				<p class="mb-2 text-sm text-slate-300 uppercase">Monthly</p>
				<div style="height:{CHART_H}px" class="relative">
					<svg
						width="100%"
						height="100%"
						viewBox="0 0 200 {CHART_H - 4}"
						preserveAspectRatio="none"
					>
						{#if monthPath.hasData}
							<path d={monthPath.area} fill="#38bdf8" fill-opacity="0.08" />
							<path d={monthPath.line} fill="none" stroke="#38bdf8" stroke-width="1.5" />
							{#each monthPath.points as [px, py], i}
								{#if monthData.find((d) => d[0] === i + 1)}
									<circle cx={px} cy={py} r="2" fill="#38bdf8" />
								{/if}
							{/each}
						{/if}
					</svg>
					<div class="mt-0.5 flex justify-between text-xs text-slate-400">
						<span>Jan</span><span>Jun</span><span>Dec</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
