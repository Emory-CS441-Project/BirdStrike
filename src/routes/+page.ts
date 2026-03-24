import type { InteractionData } from '$lib/types';
import * as d3 from 'd3';

export const prerender = true;

export async function load({ fetch }) {
	const [yearRes, interactionRes, latlonRes] = await Promise.all([
		fetch('strikes_by_year.json'),
		fetch('InteractionHeatMap.json'),
		fetch('strikes_latlon.csv')
	]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	const csvText = await latlonRes.text();
	const latlonData = d3.csvParse(csvText, (row) => ({
        LATITUDE: +row.LATITUDE,
        LONGITUDE: +row.LONGITUDE,
        INCIDENT_MONTH: row.INCIDENT_MONTH ? +row.INCIDENT_MONTH : null
    }));

	return { strikesbyYear, interactionData, latlonData };
}
