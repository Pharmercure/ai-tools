// Formato dello snapshot servito da /api/primo-margine/dati (letto da web/).
// Compatto di proposito: righe come array di numeri con indici nelle dimensioni.
export type Dati = {
	estratto: string;
	ultimo_chiuso: string;
	fonti: Record<string, string>;
	mesi: string[];
	componenti: string[];
	colonne_righe: string[];
	/** [nome, città, provincia, gruppo, categoria] */
	farmacie: [string, string, string, string, string][];
	/** [nome, interno (0/1), città] */
	fornitori: [string, number, string][];
	/** [indice mese, indice farmacia, indice fornitore, ...numeri nell'ordine di colonne_righe] */
	righe: number[][];
	/** [indice mese, indice fornitore, costo] */
	costo_senza_consegne: [number, number, number][];
	non_attribuito: Record<string, number>;
};
