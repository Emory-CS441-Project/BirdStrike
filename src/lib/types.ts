export interface InteractionRow {
	species: string;
	operator: string;
	birds: number;
	phase?: string;
	time?: string;
	month?: number;
}

export interface InteractionData {
	heatmap: InteractionRow[];
	phase: InteractionRow[];
	time: InteractionRow[];
	monthly: InteractionRow[];
}