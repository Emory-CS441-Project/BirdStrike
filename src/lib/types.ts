export interface BirdStrikeRow {
	INCIDENT_MONTH: number;
	INCIDENT_YEAR: number;
	TIME_OF_DAY: string;
	AIRPORT: string;
	LATITUDE: number;
	LONGITUDE: number;
	STATE: string;
	OPERATOR: string;
	AIRCRAFT: string;
	PHASE_OF_FLIGHT: string;
	HEIGHT: number;
	COST_REPAIRS: number;
	COST_OTHER: number;
	SPECIES_ID: string;
	SPECIES: string;
	WARNED: string;
	NUM_SEEN: string;
	NUM_STRUCK: string;
	NR_INJURIES: number;
	NR_FATALITIES: number;
}
