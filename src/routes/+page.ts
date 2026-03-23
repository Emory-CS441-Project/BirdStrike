import type { InteractionData } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	const [yearRes, interactionRes] = await Promise.all([
		fetch('strikes_by_year.json'),
		fetch('InteractionHeatMap.json')
	]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	return { strikesbyYear, interactionData };
}
