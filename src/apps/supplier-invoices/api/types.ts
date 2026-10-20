// Formato dei dati della dashboard. Lo stesso file lo usa il frontend.
// I dati li calcola la routine di verifica delle fatture fornitori (task programmati di Claude
// sul computer del referente, procedura nella KB "Verifica mensile delle fatture dei fornitori
// esterni") e li carica con POST /api/supplier-invoices/import.

export const VERDICTS = ["to_check", "needs_detail", "dispute", "invoice_correct", "ignored"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const OPEN_VERDICTS: readonly Verdict[] = ["to_check", "needs_detail"];

export const OWNERS = ["operations", "supplier_owner"] as const;
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
	// confronto consegna per consegna fra il file di UBM e il nostro DB: solo le righe che non coincidono
	differences: { date: string; pharmacy: string; order?: string | null; reason: string; supplier: number; model: number }[];
	comparison?: { rows: number; matched: number; unipolDays: number; against: number; favour: number };
};

// Accordi commerciali, per il responsabile dei rapporti con i fornitori: cosa prevede il nostro
// accordo, cosa applica il fornitore e dove le due cose non coincidono. Si descrive il problema con
// i fatti e quanto vale; come risolverlo lo decide il responsabile, che ne scrive l'esito.
export const AGREEMENT_ITEM_STATUSES = ["open", "in_discussion", "closed"] as const;
export type AgreementItemStatus = (typeof AGREEMENT_ITEM_STATUSES)[number];

export type AgreementGap = {
	id: string; // stabile fra un caricamento e l'altro, per esempio "ubm-oltre-5km"
	topic: string;
	ours: string; // cosa prevede il nostro accordo
	theirs: string; // cosa applica il fornitore
	impact: string; // quanto vale, in parole e con il periodo
	evidence: string; // da dove lo sappiamo
	question: string; // la domanda aperta, senza indicare la risposta
};

export type SupplierAgreement = {
	supplier: string;
	writtenAgreement: boolean; // false: nel Registro non c'è un accordo scritto
	summary: string;
	ours: string[];
	observed: string[];
	gaps: AgreementGap[];
};

export type AgreementsImport = {
	kind: "agreements";
	extractedAt: string;
	source: string;
	themes: { title: string; detail: string; suppliers: string[]; impact: string }[];
	suppliers: SupplierAgreement[];
};

export type AgreementItemState = {
	id: string;
	status: AgreementItemStatus;
	outcome: string;
	updatedAt: string;
	updatedBy: string;
};

export type Import = MonthImport | UbmImport | AgreementsImport;

// Risposte delle API
export type QueueItem = Omit<QueueItemInput, "verdict"> & {
	verdict: Verdict;
	note: string;
	createdAt: string;
	updatedAt: string;
	updatedBy: string;
};

// Il ciclo del costo effettivo di un fornitore nel mese:
// fattura non arrivata → scostamenti aperti (resta il previsto) → da confermare (responsabile fornitori)
// → confermato (da inserire nel backadmin) → inserito.
export type CostState = "no_invoice" | "expected_only" | "to_confirm" | "confirmed" | "loaded";

export type CostRecord = {
	amount: number;
	note: string;
	confirmedAt: string;
	confirmedBy: string;
	loadedAt: string | null;
	loadedBy: string;
};

export const COST_ACTIONS = ["confirm", "unconfirm", "loaded", "unloaded"] as const;
export type CostAction = (typeof COST_ACTIONS)[number];

export type MonthView = {
	month: string;
	extractedAt: string;
	source: string;
	loadedAt: string;
	loadedBy: string;
	suppliers: (SupplierMonth & { openItems: number; costState: CostState; cost: CostRecord | null })[];
	queue: QueueItem[];
};

export type LogEntry = { field: string; oldValue: string | null; newValue: string | null; changedBy: string; changedAt: string };
