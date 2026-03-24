import type { InteractionData } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	const [yearRes, interactionRes, NewCostRes, TrafficRes] = await Promise.all([
		fetch('strikes_by_year.json'),
		fetch('InteractionHeatMap.json'),
		fetch('NewCost.json'),
		fetch('Traffic.json')
	]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	const NewCost = await NewCostRes.json();
	const Traffic = await TrafficRes.json();
	return { strikesbyYear, interactionData, NewCost, Traffic };
}
