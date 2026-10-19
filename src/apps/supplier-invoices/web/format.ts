import type { CostState, SupplierMonth, Verdict } from "../api/types";

const eurFmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
	non_verificabile: { label: "Serve il dettaglio", help: "Senza il dettaglio consegna per consegna del fornitore non si può verificare: va chiesto.", tone: "warning" },
	ragione_nostra: { label: "Ragione nostra", help: "Si chiede la correzione al fornitore, per esempio una nota di credito.", tone: "info" },
	ragione_loro: { label: "Ragione loro", help: "Si corregge il nostro calcolo e l'accordo scritto.", tone: "success" },
	ignorato: { label: "Ignorato", help: "Non si controlla, per esempio perché molto piccolo o a nostro favore.", tone: "default" },
};

export const OUTCOME: Record<SupplierMonth["outcome"], { label: string; tone: Tone }> = {
	ok: { label: "Torna", tone: "success" },
	deviation: { label: "Scostamento", tone: "warning" },
	missing: { label: "Fattura non arrivata", tone: "default" },
	not_profiled: { label: "Senza formula", tone: "info" },
};

export const COST: Record<CostState, { label: string; tone: Tone }> = {
	actual_ready: { label: "Costo effettivo pronto", tone: "success" },
	expected_only: { label: "Resta il previsto", tone: "warning" },
	no_invoice: { label: "In attesa della fattura", tone: "default" },
};

export const OWNER_HELP = {
	CS: "Una consegna specifica sotto un accordo chiaro: peso, distanza, esito, note dell'ordine.",
	Logistica: "L'accordo: una tariffa, una formula, un compenso fisso, una voce mai concordata.",
} as const;
