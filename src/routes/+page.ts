import type { InteractionData } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	const [yearRes, interactionRes, CostBoxRes, CostTrendRes, TrafficRes] = await Promise.all([
		fetch('strikes_by_year.json'),
		fetch('InteractionHeatMap.json'),
		fetch('cost_by_damage.json'),
		fetch('cost_trend.json'),
		fetch('Traffic.json')
	]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	const CostBox = await CostBoxRes.json();
	const CostTrend = await CostTrendRes.json();
	const Traffic = await TrafficRes.json();
	return { strikesbyYear, interactionData, CostBox, CostTrend, Traffic };
}
