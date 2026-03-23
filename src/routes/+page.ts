import { csvParse, autoType } from 'd3';
import type { BirdStrikeRow } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	const res = await fetch('BirdStrikeData.csv');
	const text = await res.text();
	const data = csvParse(text, autoType) as unknown as BirdStrikeRow[];
	return { data };
}
