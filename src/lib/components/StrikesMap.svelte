<script lang="ts">
	/**
	 * StrikesMap.svelte  —  Vis 2 + Vis 2.5
	 *
	 * Performance: TopoJSON fetched once, base map drawn once on mount,
	 * only the data layer redraws on filter/mode changes.
	 */

	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	// @ts-ignore
	import * as topojson from 'topojson-client';

	// ── Types ──────────────────────────────────────────────────────────────────

	interface StrikePoint {
		LATITUDE: number;
		LONGITUDE: number;
		INCIDENT_MONTH?: number | null;
	}

	interface Airport {
		name: string;
		code: string;
		lat: number;
		lon: number;
	}

	interface Props {
		data: StrikePoint[];
	}

	// ── Top US airports by bird-strike exposure (hardcoded — stable data) ──────

	const TOP_AIRPORTS: Airport[] = [
		{ name: 'Denver Intl', code: 'DEN', lat: 39.856, lon: -104.674 },
		{ name: 'Dallas/Fort Worth', code: 'DFW', lat: 32.897, lon: -97.038 },
		{ name: "Chicago O'Hare", code: 'ORD', lat: 41.978, lon: -87.905 },
		{ name: 'Atlanta Hartsfield', code: 'ATL', lat: 33.641, lon: -84.427 },
		{ name: 'Los Angeles Intl', code: 'LAX', lat: 33.943, lon: -118.408 },
		{ name: 'John F. Kennedy', code: 'JFK', lat: 40.641, lon: -73.779 },
		{ name: 'Sacramento Intl', code: 'SMF', lat: 38.696, lon: -121.591 },
		{ name: 'Minneapolis–Saint Paul', code: 'MSP', lat: 44.882, lon: -93.222 },
		{ name: 'Seattle-Tacoma', code: 'SEA', lat: 47.45, lon: -122.309 },
		{ name: 'Miami Intl', code: 'MIA', lat: 25.796, lon: -80.287 }
	];

	// ── Props & state ──────────────────────────────────────────────────────────

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;
	let selectedMonth: number | null = $state(null);
	let playing = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	// Cached across draws
	let cachedUs: any = null;
	let cachedProjection: d3.GeoProjection | null = null;
	let cachedWidth = 0;

	const MONTH_LABELS = [
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
	const GRID_DEG = 1.5;
	const BUBBLE_COLOR = d3.scaleSequential(d3.interpolateYlOrRd);

	// ── Legend state (HTML, not SVG) ───────────────────────────────────────────
	interface LegendItem {
		color: string;
		label: string;
	}
	let legendItems: LegendItem[] = $state([]);

	// ── Derived ────────────────────────────────────────────────────────────────

	let filteredData = $derived(
		selectedMonth === null ? data : data.filter((d) => d.INCIDENT_MONTH === selectedMonth)
	);

	const monthTotals = $derived(() => {
		const totals: number[] = Array(12).fill(0);
		for (const d of data) {
			if (d.INCIDENT_MONTH != null && d.INCIDENT_MONTH >= 1 && d.INCIDENT_MONTH <= 12) {
				totals[d.INCIDENT_MONTH - 1]++;
			}
		}
		return totals;
	});

	const maxMonthTotal = $derived(Math.max(...monthTotals()));

	// ── Base map (drawn once, or on resize) ────────────────────────────────────

	async function drawBase() {
		if (!svgEl) return;

		const width = svgEl.clientWidth || 960;
		const height = Math.round(width * 0.6);
		cachedWidth = width;

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${width} ${height}`);

		// Build and cache projection
		cachedProjection = d3.geoAlbersUsa().fitSize([width, height], { type: 'Sphere' } as any);
		const path = d3.geoPath().projection(cachedProjection);

		// Fetch TopoJSON once
		if (!cachedUs) {
			try {
				const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
				cachedUs = await res.json();
			} catch {
				console.warn('Could not load US topojson.');
			}
		}

		const svg = d3.select(svgEl);

		// Layer order: nation fill → state borders → nation border → airports → data
		if (cachedUs) {
			svg
				.append('g')
				.attr('class', 'base-nation')
				.append('path')
				.datum(topojson.feature(cachedUs, cachedUs.objects.nation))
				.attr('d', path as any)
				.attr('fill', '#e8edf2')
				.attr('stroke', 'none');

			svg
				.append('g')
				.attr('class', 'base-states')
				.append('path')
				.datum(topojson.mesh(cachedUs, cachedUs.objects.states, (a: any, b: any) => a !== b))
				.attr('d', path as any)
				.attr('fill', 'none')
				.attr('stroke', '#b0bec5')
				.attr('stroke-width', 0.5);

			svg
				.append('g')
				.attr('class', 'base-border')
				.append('path')
				.datum(topojson.feature(cachedUs, cachedUs.objects.nation))
				.attr('d', path as any)
				.attr('fill', 'none')
				.attr('stroke', '#78909c')
				.attr('stroke-width', 1);
		}

		// Data layer sits above the base map
		svg.append('g').attr('class', 'data-layer');

		// Airports appended last so they always render above strike data
		drawAirports(svg, width, height);

		// Populate the data layer
		drawData();
	}

	// ── Airport markers ────────────────────────────────────────────────────────

	function drawAirports(
		svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		height: number
	) {
		if (!cachedProjection) return;

		const airports = TOP_AIRPORTS.map((a) => {
			const px = cachedProjection!([a.lon, a.lat]);
			return px ? { ...a, x: px[0], y: px[1] } : null;
		}).filter(Boolean) as (Airport & { x: number; y: number })[];

		const g = svg.append('g').attr('class', 'airports');

		// Outer ring
		g.selectAll('circle.ring')
			.data(airports)
			.join('circle')
			.attr('class', 'ring')
			.attr('cx', (d) => d.x)
			.attr('cy', (d) => d.y)
			.attr('r', 7)
			.attr('fill', 'none')
			.attr('stroke', '#1a237e')
			.attr('stroke-width', 1.5)
			.attr('opacity', 0.8);

		// Inner dot
		g.selectAll('circle.dot')
			.data(airports)
			.join('circle')
			.attr('class', 'dot')
			.attr('cx', (d) => d.x)
			.attr('cy', (d) => d.y)
			.attr('r', 2.5)
			.attr('fill', '#1a237e')
			.attr('opacity', 0.9);

		// Labels — nudge away from edges
		g.selectAll('text')
			.data(airports)
			.join('text')
			.attr('x', (d) => d.x)
			.attr('y', (d) => d.y - 11)
			.attr('text-anchor', 'middle')
			.attr('font-size', Math.max(9, width * 0.009))
			.attr('font-weight', '600')
			.attr('fill', '#1a237e')
			.attr('opacity', 0.85)
			.text((d) => d.code)
			.append('title')
			.text((d) => d.name);
	}

	// ── Data layer only (fast redraw) ──────────────────────────────────────────
	function drawData() {
		if (!svgEl || !cachedProjection) return;

		const svg = d3.select(svgEl);
		const layer = svg.select<SVGGElement>('g.data-layer');

		if (layer.empty()) return;

		layer.selectAll('*').remove();

		type ProjectedPoint = {
			x: number;
			y: number;
			month: number | null | undefined;
			col: number;
			row: number;
		};

		const projected: ProjectedPoint[] = filteredData
			.map((d) => {
				const lon = Number(d.LONGITUDE);
				const lat = Number(d.LATITUDE);

				if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

				const px = cachedProjection!([lon, lat]);
				if (!px) return null;

				const col = Math.floor((lon + 180) / GRID_DEG);
				const row = Math.floor((lat + 90) / GRID_DEG);

				return {
					x: px[0],
					y: px[1],
					month: d.INCIDENT_MONTH,
					col,
					row
				};
			})
			.filter((d): d is ProjectedPoint => d !== null);

		type CellBucket = {
			key: string;
			count: number;
			sumX: number;
			sumY: number;
		};

		const buckets = new Map<string, CellBucket>();

		for (const pt of projected) {
			const key = `${pt.col},${pt.row}`;
			const existing = buckets.get(key);

			if (existing) {
				existing.count += 1;
				existing.sumX += pt.x;
				existing.sumY += pt.y;
			} else {
				buckets.set(key, {
					key,
					count: 1,
					sumX: pt.x,
					sumY: pt.y
				});
			}
		}

		const cells = Array.from(buckets.values()).map((cell) => ({
			x: cell.sumX / cell.count,
			y: cell.sumY / cell.count,
			count: cell.count
		}));

		const maxCount = d3.max(cells, (d) => d.count) ?? 1;

		const r = d3
			.scaleSqrt()
			.domain([0, maxCount])
			.range([0, cachedWidth * 0.07]);

		BUBBLE_COLOR.domain([0, maxCount]);

		legendItems = [
			{ color: BUBBLE_COLOR(maxCount * 0.2), label: 'Lower density' },
			{ color: BUBBLE_COLOR(maxCount * 0.6), label: 'Medium density' },
			{ color: BUBBLE_COLOR(maxCount), label: 'Higher density' }
		];

		layer
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
			.append('title')
			.text((d) => `${d.count.toLocaleString()} strikes`);
	}

	// ── Playback ───────────────────────────────────────────────────────────────

	function togglePlay() {
		if (playing) {
			stopPlay();
		} else {
			playing = true;
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

	// ── Reactivity ─────────────────────────────────────────────────────────────

	// Only redraw data layer when filter/mode changes
	$effect(() => {
		filteredData;
		drawData();
	});

	onMount(() => {
		drawBase(); // also calls drawData() at the end

		let resizeTimer: ReturnType<typeof setTimeout>;
		const ro = new ResizeObserver(() => {
			// Debounce resize — redraw base (and data) only after resize settles
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => drawBase(), 150);
		});
		ro.observe(svgEl);
		return () => {
			ro.disconnect();
			stopPlay();
		};
	});
</script>

<figure class="space-y-3">
	<!-- ── Toolbar ────────────────────────────────────────────────────────────── -->
	<div class="flex flex-wrap">
		<span class="text-lg font-medium">Geographic Distribution of Bird Strikes</span>
	</div>

	<!-- ── Mode explanation ───────────────────────────────────────────────────── -->
	<p class="text-sm text-gray-500">
		<strong>Size and color</strong> both encode strike density: larger and darker means more strikes
		in that area.
		<span class="font-medium text-[#1a237e]">⊙ Blue markers</span> show the ten airports with the highest
		reported strike totals.
	</p>

	<!-- ── Month filter strip ─────────────────────────────────────────────────── -->
	<div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
				Filter by month
				{#if selectedMonth !== null}
					— <span class="text-amber-600">{MONTH_LABELS[selectedMonth - 1]}</span>
				{/if}
			</span>
			<div class="flex gap-2">
				<button
					class="cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors
						{playing ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={togglePlay}
				>
					{playing ? '⏹ Stop' : '▶ Animate'}
				</button>
				{#if selectedMonth !== null}
					<button
						class="cursor-pointer rounded bg-gray-100 px-3 py-1 text-xs font-medium
							text-gray-700 transition-colors hover:bg-gray-200"
						onclick={() => {
							selectedMonth = null;
							stopPlay();
						}}
					>
						Show all
					</button>
				{/if}
			</div>
		</div>

		<div class="flex gap-1">
			{#each MONTH_LABELS as label, i}
				{@const monthNum = i + 1}
				{@const pct = maxMonthTotal > 0 ? (monthTotals()[i] / maxMonthTotal) * 100 : 0}
				{@const active = selectedMonth === monthNum}
				<button
					class="relative flex flex-1 cursor-pointer flex-col items-center rounded pt-1 pb-0.5
						transition-colors
						{active
						? 'bg-amber-500 text-white'
						: 'border border-gray-200 bg-white text-gray-600 hover:bg-amber-50'}"
					onclick={() => {
						stopPlay();
						selectedMonth = active ? null : monthNum;
					}}
					title="{label}: {monthTotals()[i].toLocaleString()} strikes"
				>
					<div class="mb-0.5 w-full px-0.5" style="height:24px;display:flex;align-items:flex-end;">
						<div
							class="w-full rounded-sm transition-all {active ? 'bg-amber-200' : 'bg-amber-400'}"
							style="height:{pct}%"
						></div>
					</div>
					<span class="text-[10px] leading-tight font-medium">{label}</span>
				</button>
			{/each}
		</div>

		<p class="mt-2 text-[11px] text-gray-400">
			Bar height = relative strike frequency that month. Notice how autumn dominates (peak migration
			season).
		</p>
	</div>

	<!-- ── Map ────────────────────────────────────────────────────────────────── -->
	<svg bind:this={svgEl} class="block w-full rounded-lg bg-[#cfe8f3]"></svg>

	<!-- ── Bubble legend (HTML, lives outside SVG) ───────────────────────────── -->
	{#if legendItems.length > 0}
		<div class="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
			<span class="shrink-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
				Strike density
			</span>

			<div class="flex items-center gap-3">
				{#each legendItems as item}
					<div class="flex items-center gap-2">
						<div
							class="h-4 w-8 rounded-sm border border-white/60"
							style="background-color: {item.color}"
						></div>
						<span class="text-xs text-gray-600">{item.label}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</figure>
