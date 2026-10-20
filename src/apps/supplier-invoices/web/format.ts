import { type CostState, OPEN_VERDICTS, type QueueItem, type SupplierMonth, type Verdict } from "../api/types";

// "always": in italiano Intl non separa le migliaia sotto 10.000 (9736,08 invece di 9.736,08). Il cast serve
// perché la lib di TypeScript in uso conosce solo il valore booleano.
const eurFmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" as unknown as boolean });
export const eur = (n: number | null | undefined) => (n === null || n === undefined ? "–" : eurFmt.format(n) + " €");
export const signedEur = (n: number | null | undefined) =>
	n === null || n === undefined ? "–" : (n > 0 ? "+" : "") + eurFmt.format(n) + " €";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const monthName = (m: string) => {
	const [y, mm] = m.split("-");
	return `${MONTHS[Number(mm) - 1]} ${y}`;
};

export const dateTime = (iso: string) => {
	// D1 salva "AAAA-MM-GG HH:MM:SS" in UTC senza fuso
	const d = new Date(/T/.test(iso) ? iso : iso.replace(" ", "T") + "Z");
	return d.toLocaleDateString("it-IT") + " alle " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
};
export const date = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("it-IT");

type Tone = "success" | "warning" | "error" | "info" | "default";

// "help" dice cosa succede dopo la scelta: si legge sul pulsante (al passaggio del mouse) e sotto la riga decisa.
export const VERDICT: Record<Verdict, { label: string; help: string; tone: Tone }> = {
	to_check: { label: "Da verificare", help: "Nessuno ha ancora deciso: la riga resta aperta e per il fornitore vale il costo previsto.", tone: "warning" },
	needs_detail: {
		label: "Serve il dettaglio",
		help: "Senza il dettaglio consegna per consegna non si può decidere: la riga resta aperta, vale il costo previsto e la routine prepara la bozza di richiesta al fornitore.",
		tone: "warning",
	},
	invoice_correct: {
		label: "Fattura corretta",
		help: "Il fornitore ha ragione: la riga si chiude. Quando tutte le righe del fornitore sono decise, il costo passa a «da confermare» con l'importo della fattura. Il nostro calcolo o l'accordo scritto va aggiornato.",
		tone: "success",
	},
	dispute: {
		label: "Da contestare",
		help: "Il fornitore ha sbagliato: la riga si chiude come decisa e la correzione (per esempio una nota di credito) si chiede al fornitore. Confermando il costo si scrive l'importo giusto, con la nota.",
		tone: "error",
	},
	ignored: { label: "Ignorato", help: "Non si approfondisce, per esempio perché molto piccolo: la riga si chiude e la fattura si paga così com'è.", tone: "default" },
};

// Ordine in cui i verdetti compaiono come pulsanti: prima le decisioni, poi gli stati di attesa.
export const VERDICT_ORDER: Verdict[] = ["invoice_correct", "dispute", "needs_detail", "ignored", "to_check"];

export const OUTCOME: Record<SupplierMonth["outcome"], { label: string; tone: Tone }> = {
	ok: { label: "Torna", tone: "success" },
	deviation: { label: "Scostamento", tone: "warning" },
	missing: { label: "Fattura non arrivata", tone: "default" },
	not_profiled: { label: "Senza formula", tone: "info" },
};

// Quanto resta da chiarire per un fornitore: gli importi in fattura delle righe ancora aperte. È la cifra
// di "Da fare"; la differenza fattura meno previsto può essere più grande se una parte è già decisa.
export const toClarify = (queue: QueueItem[], supplier: string) =>
	queue.filter((q) => q.supplier === supplier && OPEN_VERDICTS.includes(q.verdict)).reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0);

export const COST: Record<CostState, { label: string; tone: Tone }> = {
	no_invoice: { label: "In attesa della fattura", tone: "default" },
	expected_only: { label: "Resta il previsto", tone: "warning" },
	to_confirm: { label: "Costo da confermare", tone: "info" },
	confirmed: { label: "Confermato, da inserire", tone: "success" },
	loaded: { label: "Inserito nel backadmin", tone: "default" },
};


// Chi ha in mano una riga: il responsabile fornitori ("supplier_owner" nel database) o, se ha chiesto
// supporto, la gestione operativa ("operations").
export const OWNER_LABEL = { supplier_owner: "responsabile fornitori", operations: "gestione operativa" } as const;
