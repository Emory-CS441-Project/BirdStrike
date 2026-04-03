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

	type CachedPoint = { x: number; y: number; col: number; row: number };

	// ── Top US airports by bird-strike exposure ────────────────────────────────

	const TOP_AIRPORTS: Airport[] = [
		{ name: 'Denver Intl',            code: 'DEN', lat: 39.856, lon: -104.674 },
		{ name: 'Dallas/Fort Worth',      code: 'DFW', lat: 32.897, lon: -97.038  },
		{ name: "Chicago O'Hare",         code: 'ORD', lat: 41.978, lon: -87.905  },
		{ name: 'Atlanta Hartsfield',     code: 'ATL', lat: 33.641, lon: -84.427  },
		{ name: 'Los Angeles Intl',       code: 'LAX', lat: 33.943, lon: -118.408 },
		{ name: 'John F. Kennedy',        code: 'JFK', lat: 40.641, lon: -73.779  },
		{ name: 'Sacramento Intl',        code: 'SMF', lat: 38.696, lon: -121.591 },
		{ name: 'Minneapolis–Saint Paul', code: 'MSP', lat: 44.882, lon: -93.222  },
		{ name: 'Seattle-Tacoma',         code: 'SEA', lat: 47.45,  lon: -122.309 },
		{ name: 'Miami Intl',             code: 'MIA', lat: 25.796, lon: -80.287  },
	];

	// ── Props & state ──────────────────────────────────────────────────────────

	let { data }: Props = $props();

	let svgEl: SVGSVGElement;
	let selectedMonth: number | null = $state(null);
	let playing = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	// Tooltip state
	interface TooltipState {
		visible: boolean;
		x: number;
		y: number;
		html: string;
	}
	let tooltip: TooltipState = $state({ visible: false, x: 0, y: 0, html: '' });

	// Cached across draws
	let cachedUs: any = null;
	let cachedProjection: d3.GeoProjection | null = null;
	let cachedWidth = 0;
	let projectionCache = new Map<number, CachedPoint[]>();

	const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const GRID_DEG = 1.5;
	const BUBBLE_COLOR = d3.scaleSequential(d3.interpolateYlOrRd);

	// ── Legend state ───────────────────────────────────────────────────────────
	interface LegendItem { color: string; label: string; }
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

	// ── Tooltip helpers ────────────────────────────────────────────────────────

	function showTooltip(event: MouseEvent, html: string) {
		tooltip = { visible: true, x: event.clientX, y: event.clientY, html };
	}

	function moveTooltip(event: MouseEvent) {
		tooltip = { ...tooltip, x: event.clientX, y: event.clientY };
	}

	function hideTooltip() {
		tooltip = { ...tooltip, visible: false };
	}

	// ── Base map (drawn once, or on resize) ────────────────────────────────────

	async function drawBase() {
		if (!svgEl) return;

		const width = svgEl.clientWidth || 960;
		const height = Math.round(width * 0.6);
		cachedWidth = width;

		d3.select(svgEl).selectAll('*').remove();
		d3.select(svgEl).attr('viewBox', `0 0 ${width} ${height}`);

		cachedProjection = d3.geoAlbersUsa().fitSize([width, height], { type: 'Sphere' } as any);
		const path = d3.geoPath().projection(cachedProjection);

		// Pre-project all points and cache by month
		projectionCache = new Map();
		const allPoints: CachedPoint[] = [];
		for (const d of data) {
			const lon = Number(d.LONGITUDE);
			const lat = Number(d.LATITUDE);
			if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
			const px = cachedProjection([lon, lat]);
			if (!px) continue;
			allPoints.push({
				x: px[0],
				y: px[1],
				col: Math.floor((lon + 180) / GRID_DEG),
				row: Math.floor((lat + 90) / GRID_DEG)
			});
		}
		projectionCache.set(0, allPoints);
		for (let m = 1; m <= 12; m++) {
			projectionCache.set(m, allPoints.filter((_, i) => (data[i]?.INCIDENT_MONTH ?? 0) === m));
		}

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

		if (cachedUs) {
			svg.append('g').attr('class', 'base-nation')
				.append('path')
				.datum(topojson.feature(cachedUs, cachedUs.objects.nation))
				.attr('d', path as any)
				.attr('fill', '#e8edf2').attr('stroke', 'none');

			svg.append('g').attr('class', 'base-states')
				.append('path')
				.datum(topojson.mesh(cachedUs, cachedUs.objects.states, (a: any, b: any) => a !== b))
				.attr('d', path as any)
				.attr('fill', 'none').attr('stroke', '#b0bec5').attr('stroke-width', 0.5);

			svg.append('g').attr('class', 'base-border')
				.append('path')
				.datum(topojson.feature(cachedUs, cachedUs.objects.nation))
				.attr('d', path as any)
				.attr('fill', 'none').attr('stroke', '#78909c').attr('stroke-width', 1);
		}

		svg.append('g').attr('class', 'data-layer');
		drawAirports(svg, width, height);
		drawData();
	}

	// ── Airport markers ────────────────────────────────────────────────────────

	function drawAirports(
		svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		width: number,
		_height: number
	) {
		if (!cachedProjection) return;

		const airports = TOP_AIRPORTS.map((a) => {
			const px = cachedProjection!([a.lon, a.lat]);
			return px ? { ...a, x: px[0], y: px[1] } : null;
		}).filter(Boolean) as (Airport & { x: number; y: number })[];

		const g = svg.append('g').attr('class', 'airports').style('cursor', 'pointer');

		// Invisible hit area for easier hover targeting
		g.selectAll('circle.hit')
			.data(airports).join('circle').attr('class', 'hit')
			.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
			.attr('r', 14).attr('fill', 'transparent').attr('stroke', 'none')
			.on('mousemove', (event, d) => {
				showTooltip(event,
					`<strong>${d.name}</strong><br/>` +
					`<span style="color:#6b7280">IATA: ${d.code}</span><br/>` +
					`<span style="color:#6b7280">One of the top 10 airports<br/>by bird strike frequency</span>`
				);
			})
			.on('mouseleave', hideTooltip);

		// Outer ring — brightens on hover via the group
		g.selectAll('circle.ring')
			.data(airports).join('circle').attr('class', 'ring')
			.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
			.attr('r', 7).attr('fill', 'none')
			.attr('stroke', '#1a237e').attr('stroke-width', 1.5).attr('opacity', 0.8)
			.on('mousemove', (event, d) => {
				showTooltip(event,
					`<strong>${d.name}</strong><br/>` +
					`<span style="color:#6b7280">IATA: ${d.code}</span><br/>` +
					`<span style="color:#6b7280">One of the top 10 airports<br/>by bird strike frequency</span>`
				);
				d3.select(event.currentTarget as SVGCircleElement)
					.attr('stroke', '#3f51b5').attr('stroke-width', 2.5).attr('opacity', 1);
			})
			.on('mouseleave', (event) => {
				hideTooltip();
				d3.select(event.currentTarget as SVGCircleElement)
					.attr('stroke', '#1a237e').attr('stroke-width', 1.5).attr('opacity', 0.8);
			});

		// Inner dot
		g.selectAll('circle.dot')
			.data(airports).join('circle').attr('class', 'dot')
			.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
			.attr('r', 2.5).attr('fill', '#1a237e').attr('opacity', 0.9)
			.style('pointer-events', 'none');

		// Labels
		g.selectAll('text')
			.data(airports).join('text')
			.attr('x', (d) => d.x).attr('y', (d) => d.y - 11)
			.attr('text-anchor', 'middle')
			.attr('font-size', Math.max(9, width * 0.009))
			.attr('font-weight', '600')
			.attr('fill', '#1a237e').attr('opacity', 0.85)
			.style('pointer-events', 'none')
			.text((d) => d.code);
	}

	// ── Data layer ─────────────────────────────────────────────────────────────

	function drawData() {
		if (!svgEl || !cachedProjection) return;

		const svg = d3.select(svgEl);
		const layer = svg.select<SVGGElement>('g.data-layer');
		if (layer.empty()) return;
		layer.selectAll('*').remove();

		const cacheKey = selectedMonth ?? 0;
		const projected = projectionCache.get(cacheKey) ?? [];

		const buckets = new Map<string, { count: number; sumX: number; sumY: number }>();
		for (const pt of projected) {
			const key = `${pt.col},${pt.row}`;
			const b = buckets.get(key);
			if (b) { b.count++; b.sumX += pt.x; b.sumY += pt.y; }
			else buckets.set(key, { count: 1, sumX: pt.x, sumY: pt.y });
		}

		const cells = Array.from(buckets.values()).map((b) => ({
			x: b.sumX / b.count,
			y: b.sumY / b.count,
			count: b.count
		}));

		const maxCount = d3.max(cells, (d) => d.count) ?? 1;
		const r = d3.scaleSqrt().domain([0, maxCount]).range([0, cachedWidth * 0.07]);
		BUBBLE_COLOR.domain([0, maxCount]);

		legendItems = [
			{ color: BUBBLE_COLOR(maxCount * 0.2), label: 'Lower density' },
			{ color: BUBBLE_COLOR(maxCount * 0.6), label: 'Medium density' },
			{ color: BUBBLE_COLOR(maxCount),       label: 'Higher density' },
		];

		const monthLabel = selectedMonth !== null
			? ` in ${MONTH_LABELS[selectedMonth - 1]}`
			: ' (all months)';

		layer.selectAll('circle')
			.data(cells)
			.join('circle')
			.attr('cx', (d) => d.x)
			.attr('cy', (d) => d.y)
			.attr('r', (d) => r(d.count))
			.attr('fill', (d) => BUBBLE_COLOR(d.count))
			.attr('fill-opacity', 0.75)
			.attr('stroke', '#fff')
			.attr('stroke-width', 0.5)
			.style('cursor', 'pointer')
			.on('mousemove', function(event, d) {
				d3.select(this)
					.attr('stroke', '#333')
					.attr('stroke-width', 1.5)
					.attr('fill-opacity', 0.95);
				showTooltip(event,
					`<strong>${d.count.toLocaleString()} strikes</strong>${monthLabel}<br/>` +
					`<span style="color:#6b7280;font-size:11px">` +
					`~${GRID_DEG}° grid cell (~${Math.round(GRID_DEG * 111)} km)</span>`
				);
			})
			.on('mousemove', function(event, d) {
				moveTooltip(event);
				d3.select(this).attr('stroke', '#333').attr('stroke-width', 1.5).attr('fill-opacity', 0.95);
				showTooltip(event,
					`<strong>${d.count.toLocaleString()} strikes</strong>${monthLabel}<br/>` +
					`<span style="color:#6b7280;font-size:11px">` +
					`~${GRID_DEG}° grid cell (~${Math.round(GRID_DEG * 111)} km)</span>`
				);
			})
			.on('mouseleave', function() {
				d3.select(this)
					.attr('stroke', '#fff')
					.attr('stroke-width', 0.5)
					.attr('fill-opacity', 0.75);
				hideTooltip();
			});
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

	$effect(() => {
		filteredData;
		drawData();
	});

	onMount(() => {
		drawBase();
		let resizeTimer: ReturnType<typeof setTimeout>;
		const ro = new ResizeObserver(() => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => drawBase(), 150);
		});
		ro.observe(svgEl);
		return () => { ro.disconnect(); stopPlay(); };
	});
</script>

<!-- Floating tooltip (fixed position, follows mouse) -->
{#if tooltip.visible}
	<div
		class="pointer-events-none fixed z-50 max-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg"
		style="left:{tooltip.x + 14}px; top:{tooltip.y - 10}px; line-height:1.5"
	>
		{@html tooltip.html}
	</div>
{/if}

<figure class="space-y-3">
	<div class="flex flex-wrap">
		<span class="text-lg font-medium">Geographic Distribution of Bird Strikes</span>
	</div>

	<p class="text-sm text-gray-500">
		<strong>Size and color</strong> both encode strike density: larger and darker means more strikes
		in that area.
		<span class="font-medium text-[#1a237e]">⊙ Blue markers</span> show the ten airports with the
		highest reported strike totals.
	</p>

	<!-- Month filter strip -->
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
						onclick={() => { selectedMonth = null; stopPlay(); }}
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
						{active ? 'bg-amber-500 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-amber-50'}"
					onclick={() => { stopPlay(); selectedMonth = active ? null : monthNum; }}
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
			Bar height = relative strike frequency that month. Notice how autumn dominates (peak migration season).
		</p>
	</div>

	<svg bind:this={svgEl} class="block w-full rounded-lg bg-[#cfe8f3]"></svg>

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