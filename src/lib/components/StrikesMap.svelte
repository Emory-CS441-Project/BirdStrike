<script lang="ts">
	/**
	 * StrikesMap.svelte  —  Vis 2 + Vis 2.5
	 *
	 * Props
	 *   data  Array of { LATITUDE, LONGITUDE, INCIDENT_MONTH? } loaded from
	 *         strikes_latlon.csv (produced by extract_latlon.py).
	 *
	 * Features
	 *   • US map rendered with D3 AlbersUSA projection + topojson states.
	 *   • View toggle: "Dots" (raw scatter) vs "Bubbles" (aggregated grid cells).
	 *   • Month filter strip (Vis 2.5): click any month to show only that month's
	 *     strikes, highlighting the fall migration spike.
	 *   • "Play" button animates through the months automatically.
	 */

	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	// @ts-ignore — install with: npm i topojson-client @types/topojson-client
	import * as topojson from 'topojson-client';

	// ── Types ──────────────────────────────────────────────────────────────────

	interface StrikePoint {
		LATITUDE: number;
		LONGITUDE: number;
		INCIDENT_MONTH?: number | null;
	}

	interface Props {
		data: StrikePoint[];
	}

	// ── Props & state ──────────────────────────────────────────────────────────

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;
	let viewMode: 'dots' | 'bubbles' = $state('dots');
	let selectedMonth: number | null = $state(null); // null = all months
	let playing = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	// ── Constants ──────────────────────────────────────────────────────────────

	const MONTH_LABELS = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	// Colour ramp: pale → deep amber/orange to echo "migration heat"
	const BUBBLE_COLOR = d3.scaleSequential(d3.interpolateYlOrRd);

	// Grid cell size in degrees for bubble aggregation
	const GRID_DEG = 1.5;

	// ── Derived: filtered data ─────────────────────────────────────────────────

	let filteredData = $derived(
		selectedMonth === null
			? data
			: data.filter((d) => d.INCIDENT_MONTH === selectedMonth)
	);

	// ── Monthly totals for the sparkbar under month labels ────────────────────

	const monthTotals = $derived.by(() => {
		const totals: number[] = Array(12).fill(0);
		for (const d of data) {
			if (d.INCIDENT_MONTH != null && d.INCIDENT_MONTH >= 1 && d.INCIDENT_MONTH <= 12) {
				totals[d.INCIDENT_MONTH - 1]++;
			}
		}
		return totals;
	});

	const maxMonthTotal = $derived(Math.max(...monthTotals));

	// ── Draw ───────────────────────────────────────────────────────────────────

	async function draw() {
		if (!svgEl) return;

		const width = svgEl.clientWidth || 960;
		const height = Math.round(width * 0.6);

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${width} ${height}`);

		// Projection
		const projection = d3.geoAlbersUsa().fitSize([width, height], {
			type: 'Sphere'
		} as any);

		const path = d3.geoPath().projection(projection);

		// Fetch US topojson (CDN — works in browser; for SSR pre-render see note)
		let us: any;
		try {
			const res = await fetch(
				'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
			);
			us = await res.json();
		} catch {
			// Graceful degradation: draw points without base map
			console.warn('Could not load US topojson; rendering points only.');
		}

		const svg = d3.select(svgEl);

		// ── Base map ──────────────────────────────────────────────────────
		if (us) {
			// Nation fill
			svg
				.append('path')
				.datum(topojson.feature(us, us.objects.nation))
				.attr('d', path as any)
				.attr('fill', '#e8edf2')
				.attr('stroke', 'none');

			// State borders
			svg
				.append('path')
				.datum(topojson.mesh(us, us.objects.states, (a: any, b: any) => a !== b))
				.attr('d', path as any)
				.attr('fill', 'none')
				.attr('stroke', '#b0bec5')
				.attr('stroke-width', 0.5);

			// Outer border
			svg
				.append('path')
				.datum(topojson.feature(us, us.objects.nation))
				.attr('d', path as any)
				.attr('fill', 'none')
				.attr('stroke', '#78909c')
				.attr('stroke-width', 1);
		}

		// ── Project points ────────────────────────────────────────────────
		const projected = filteredData
			.map((d) => {
				const px = projection([d.LONGITUDE, d.LATITUDE]);
				return px ? { x: px[0], y: px[1], month: d.INCIDENT_MONTH } : null;
			})
			.filter(Boolean) as { x: number; y: number; month: number | null | undefined }[];

		// ── Dots mode ─────────────────────────────────────────────────────
		if (viewMode === 'dots') {
			svg
				.append('g')
				.attr('class', 'dots')
				.selectAll('circle')
				.data(projected)
				.join('circle')
				.attr('cx', (d) => d.x)
				.attr('cy', (d) => d.y)
				.attr('r', 2)
				.attr('fill', '#e53935')
				.attr('fill-opacity', 0.35)
				.attr('stroke', 'none');
		}

		// ── Bubbles mode ──────────────────────────────────────────────────
		if (viewMode === 'bubbles') {
			// Aggregate into grid cells
			const cellMap = new Map<string, number>();
			const cellCentroid = new Map<string, { x: number; y: number }>();

			for (const pt of projected) {
				// Back-project to geographic coords for grid binning
				const geo = projection.invert!([pt.x, pt.y]);
				if (!geo) continue;
				const col = Math.floor(geo[0] / GRID_DEG);
				const row = Math.floor(geo[1] / GRID_DEG);
				const key = `${col},${row}`;
				cellMap.set(key, (cellMap.get(key) ?? 0) + 1);
				if (!cellCentroid.has(key)) cellCentroid.set(key, { x: pt.x, y: pt.y });
			}

			const cells = Array.from(cellMap.entries()).map(([key, count]) => ({
				count,
				...cellCentroid.get(key)!
			}));

			const maxCount = d3.max(cells, (d) => d.count) ?? 1;
			const r = d3.scaleSqrt().domain([0, maxCount]).range([0, width * 0.07]);
			BUBBLE_COLOR.domain([0, maxCount]);

			svg
				.append('g')
				.attr('class', 'bubbles')
				.selectAll('circle')
				.data(cells)
				.join('circle')
				.attr('cx', (d) => d.x)
				.attr('cy', (d) => d.y)
				.attr('r', (d) => r(d.count))
				.attr('fill', (d) => BUBBLE_COLOR(d.count))
				.attr('fill-opacity', 0.75)
				.attr('stroke', '#fff')
				.attr('stroke-width', 0.5)
				// Simple tooltip via <title>
				.append('title')
				.text((d) => `${d.count.toLocaleString()} strike${d.count === 1 ? '' : 's'}`);
		}
	}

	// ── Playback controls ──────────────────────────────────────────────────────

	function togglePlay() {
		if (playing) {
			stopPlay();
		} else {
			playing = true;
			// Start from month 1 if nothing selected
			if (selectedMonth === null) selectedMonth = 1;
			playInterval = setInterval(() => {
				selectedMonth = selectedMonth === null ? 1 : (selectedMonth % 12) + 1;
			}, 900);
		}
	}

	function stopPlay() {
		playing = false;
		if (playInterval) clearInterval(playInterval);
		playInterval = null;
	}

	// ── Reactive redraw ────────────────────────────────────────────────────────

	$effect(() => {
		viewMode;
		filteredData;
		if (svgEl) draw();
	});

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		ro.observe(svgEl);
		return () => {
			ro.disconnect();
			stopPlay();
		};
	});
</script>

<!-- ── Toolbar ─────────────────────────────────────────────────────────────── -->
<figure class="space-y-3">
	<div class="flex flex-wrap items-center gap-3">
		<!-- Title -->
		<span class="mr-auto text-lg font-medium">Geographic Distribution of Bird Strikes</span>

		<!-- View toggle -->
		<div class="flex gap-2">
			{#each (['dots', 'bubbles'] as const) as mode}
				<button
					class="cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors
						{viewMode === mode
						? 'bg-gray-700 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={() => (viewMode = mode)}
				>
					{mode === 'dots' ? 'Dots' : 'Bubbles'}
				</button>
			{/each}
		</div>
	</div>

	<!-- ── Month filter strip (Vis 2.5) ─────────────────────────────────────── -->
	<div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">
				Filter by month
				{#if selectedMonth !== null}
					— <span class="text-amber-600">{MONTH_LABELS[selectedMonth - 1]}</span>
				{/if}
			</span>
			<div class="flex gap-2">
				<!-- Play button -->
				<button
					class="cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors
						{playing
						? 'bg-amber-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={togglePlay}
				>
					{playing ? '⏹ Stop' : '▶ Animate'}
				</button>
				<!-- Reset -->
				{#if selectedMonth !== null}
					<button
						class="cursor-pointer rounded px-3 py-1 text-xs font-medium
							bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
						onclick={() => { selectedMonth = null; stopPlay(); }}
					>
						Show all
					</button>
				{/if}
			</div>
		</div>

		<!-- Month buttons with mini spark-bar indicating relative volume -->
		<div class="flex gap-1">
			{#each MONTH_LABELS as label, i}
				{@const monthNum = i + 1}
				{@const pct = maxMonthTotal > 0 ? (monthTotals[i] / maxMonthTotal) * 100 : 0}
				{@const active = selectedMonth === monthNum}
				<button
					class="relative flex flex-1 cursor-pointer flex-col items-center rounded pt-1 pb-0.5
						transition-colors
						{active
						? 'bg-amber-500 text-white'
						: 'bg-white text-gray-600 hover:bg-amber-50 border border-gray-200'}"
					onclick={() => {
						stopPlay();
						selectedMonth = active ? null : monthNum;
					}}
					title="{label}: {monthTotals[i].toLocaleString()} strikes"
				>
					<!-- Spark bar -->
					<div class="w-full px-0.5 mb-0.5" style="height: 24px; display:flex; align-items:flex-end;">
						<div
							class="w-full rounded-sm transition-all {active ? 'bg-amber-200' : 'bg-amber-400'}"
							style="height: {pct}%"
						></div>
					</div>
					<span class="text-[10px] font-medium leading-tight">{label}</span>
				</button>
			{/each}
		</div>

		<p class="mt-2 text-[11px] text-gray-400">
			Bar height shows relative strike frequency. Notice the autumn spike — peak migration season.
		</p>
	</div>

	<!-- ── Map SVG ───────────────────────────────────────────────────────────── -->
	<svg bind:this={svgEl} class="block w-full rounded-lg bg-[#cfe8f3]"></svg>

	<figcaption class="text-sm text-gray-500">
		Bird strike locations across the United States.
		{#if viewMode === 'bubbles'}
			Bubble size and colour reflect incident density per ~{GRID_DEG}° grid cell.
		{:else}
			Each dot represents one recorded strike.
		{/if}
	</figcaption>
</figure>