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
	const [yearRes, interactionRes, CostBoxRes, CostTrendRes, TrafficRes, SpeciesRes] =
		await Promise.all([
			fetch('strikes_by_year.json'),
			fetch('InteractionHeatMap.json'),
			fetch('cost_by_damage.json'),
			fetch('cost_trend.json'),
			fetch('Traffic.json'),
			fetch('species_strikes.json')
		]);
	const strikesbyYear = await yearRes.json();
	const interactionData: InteractionData = await interactionRes.json();
	const CostBox = await CostBoxRes.json();
	const CostTrend = await CostTrendRes.json();
	const Traffic = await TrafficRes.json();
	const speciesStrikes = await SpeciesRes.json();
	return { strikesbyYear, interactionData, CostBox, CostTrend, Traffic, speciesStrikes };
}
