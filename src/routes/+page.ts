import type { InteractionData } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	const [yearRes, interactionRes, NewCostRes] = await Promise.all([
		fetch('strikes_by_year.json'),
		fetch('InteractionHeatMap.json'),
		fetch('NewCost.json')
	]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	const NewCost = await NewCostRes.json();
	return { strikesbyYear, interactionData, NewCost };
}
