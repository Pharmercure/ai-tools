// Formato dei dati della dashboard. Lo stesso file lo usa il frontend.
// I dati li calcola la routine di verifica delle fatture fornitori (task programmati di Claude
// sul computer del referente, procedura nella KB "Verifica mensile delle fatture dei fornitori
// esterni") e li carica con POST /api/supplier-invoices/import.

export const VERDICTS = ["da_verificare", "non_verificabile", "ragione_nostra", "ragione_loro", "ignorato"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const OPEN_VERDICTS: readonly Verdict[] = ["da_verificare", "non_verificabile"];

export const OWNERS = ["CS", "Logistica"] as const;
export type Owner = (typeof OWNERS)[number];

export type Invoice = {
	number: string;
	date: string; // AAAA-MM-GG
	net: number; // imponibile
	source: "api" | "browser";
};

export type SupplierMonth = {
	supplier: string; // nome nel sistema
	invoiceName: string; // intestatario della fattura
	track: "A" | "B"; // binario
	deliveries: Record<string, number>; // consegne per categoria del nostro calcolo
	expected: number | null; // previsto (imponibile); null se non calcolabile
	expectedNote: string;
	invoices: Invoice[];
	invoiced: number | null; // somma degli imponibili delle fatture del mese; null se non arrivate
	outcome: "ok" | "deviation" | "missing" | "not_profiled";
	outcomeNote: string;
};

export type QueueItemInput = {
	id: string;
	month: string;
	supplier: string;
	invoice: string;
	owner: Owner;
	deliveries: string;
	amount: number | null;
	check: string;
	verdict: Verdict; // usato solo quando la riga è nuova
};

export type MonthImport = {
	kind: "month";
	month: string; // AAAA-MM, mese delle consegne
	extractedAt: string; // ISO
	source: string;
	suppliers: SupplierMonth[];
	queue: QueueItemInput[];
};

export type UbmCarnet = {
	start: string; // AAAA-MM-GG
	end: string | null; // null se in corso
	size: number; // tagliandi acquistati
	invoice: string; // fattura di acquisto o rinnovo, se nota
	usedSupplier: number | null; // tagliandi consumati secondo UBM
	usedModel: number | null; // tagliandi consumati secondo il nostro calcolo
	note: string;
};

export type UbmImport = {
	kind: "ubm";
	extractedAt: string;
	source: string;
	rules: string[]; // regole di conteggio in vigore, in parole
	carnets: UbmCarnet[]; // dal più recente
	current: {
		start: string;
		size: number;
		used: number; // tagliandi consumati dal nostro calcolo fino a "asOf"
		asOf: string;
		dailyAverage: number; // tagliandi per giorno lavorativo, ultime 8 settimane
		forecastEnd: string | null; // data stimata di esaurimento
	} | null;
	monthly: { month: string; deliveries: number; tickets: number; supplierTickets: number | null }[];
	differences: { date: string; pharmacy: string; reason: string; supplier: number; model: number }[];
};

export type Import = MonthImport | UbmImport;

// Risposte delle API
export type QueueItem = Omit<QueueItemInput, "verdict"> & {
	verdict: Verdict;
	note: string;
	createdAt: string;
	updatedAt: string;
	updatedBy: string;
};

export type CostState = "actual_ready" | "expected_only" | "no_invoice";

export type MonthView = {
	month: string;
	extractedAt: string;
	source: string;
	loadedAt: string;
	loadedBy: string;
	suppliers: (SupplierMonth & { openItems: number; costState: CostState })[];
	queue: QueueItem[];
};

export type LogEntry = { field: string; oldValue: string | null; newValue: string | null; changedBy: string; changedAt: string };
