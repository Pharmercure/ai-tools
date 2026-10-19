import type { CostState, SupplierMonth, Verdict } from "../api/types";

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

export const VERDICT: Record<Verdict, { label: string; help: string; tone: Tone }> = {
	da_verificare: { label: "Da verificare", help: "Nessuno ha ancora deciso.", tone: "warning" },
	non_verificabile: { label: "Serve il dettaglio", help: "Senza il dettaglio consegna per consegna del fornitore non si può verificare.", tone: "warning" },
	ragione_loro: { label: "Fattura corretta", help: "Il fornitore ha ragione: si aggiorna il nostro calcolo o l'accordo scritto.", tone: "success" },
	ragione_nostra: { label: "Da contestare", help: "Il fornitore ha sbagliato: si chiede la correzione.", tone: "error" },
	ignorato: { label: "Ignorato", help: "Non si controlla, per esempio perché molto piccolo.", tone: "default" },
};

// Ordine in cui i verdetti compaiono come pulsanti: prima le decisioni, poi gli stati di attesa.
export const VERDICT_ORDER: Verdict[] = ["ragione_loro", "ragione_nostra", "non_verificabile", "ignorato", "da_verificare"];

export const OUTCOME: Record<SupplierMonth["outcome"], { label: string; tone: Tone }> = {
	ok: { label: "Torna", tone: "success" },
	deviation: { label: "Scostamento", tone: "warning" },
	missing: { label: "Fattura non arrivata", tone: "default" },
	not_profiled: { label: "Senza formula", tone: "info" },
};

export const COST: Record<CostState, { label: string; tone: Tone }> = {
	no_invoice: { label: "In attesa della fattura", tone: "default" },
	expected_only: { label: "Resta il previsto", tone: "warning" },
	to_confirm: { label: "Costo da confermare", tone: "info" },
	confirmed: { label: "Confermato, da inserire", tone: "success" },
	loaded: { label: "Inserito nel backadmin", tone: "default" },
};

export const supplierPath = (name: string) => `/supplier-invoices/suppliers/${encodeURIComponent(name)}`;

// Chi ha in mano una riga: il responsabile fornitori ("Logistica" nel database) o, se ha chiesto
// supporto, la gestione operativa ("CS").
export const OWNER_LABEL = { Logistica: "responsabile fornitori", CS: "gestione operativa" } as const;
