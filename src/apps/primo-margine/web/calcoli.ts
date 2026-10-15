// Tipi, formati e calcoli della dashboard (portati dalla vecchia pagina HTML).

export type { Dati } from "../api/types";
import type { Dati } from "../api/types";

export type Filtri = {
	da: string;
	a: string;
	cat: string;
	citta: string;
	tipo: string; // "" tutti, "1" interni, "0" esterni
	forn: string; // indice del fornitore, "" tutti
	testo: string;
	conContratto: boolean;
};

export type Vista = "citta" | "farmacia" | "fornitore" | "categoria" | "gruppo" | "mese";

export const NOMI_COMP: Record<string, string> = {
	canone: "Canone abbonamento",
	canone_da_contratto: "Canone da contratto (fattura non trovata)",
	extra: "Coin extra",
	attivazione: "Attivazione backoffice",
	consegne_a_consumo: "Consegne a consumo",
	ritiro_ricetta: "Ritiro ricetta",
	commissioni_pos: "Commissioni POS",
	oneri_sepa: "Oneri SEPA",
	ecommerce: "Integrazione e-commerce (Dr. Max)",
	consegna_cliente_webapp: "Consegna pagata dal cliente (webapp)",
	altro: "Altro",
};

const NOMI_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
export const nomeMese = (m: string) => `${NOMI_MESI[+m.slice(5) - 1]} ${m.slice(2, 4)}`;

export const eur = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" as unknown as boolean }).format;
export const eur2 = new Intl.NumberFormat("it-IT", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: "always" as unknown as boolean,
}).format;
export const pct = new Intl.NumberFormat("it-IT", {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
}).format;

export function nomeForn(d: Dati, i: number) {
	const n = d.fornitori[i][0];
	if (n === "nessun-fornitore") return "Nessun fornitore (farmacia senza consegne)";
	if (n === "senza-fornitore") return "Fornitore non indicato sull'ordine";
	return n;
}

/** Posizione di ogni colonna nelle righe, es. I.consegne. */
export const indici = (d: Dati) =>
	Object.fromEntries(d.colonne_righe.map((c, i) => [c, i])) as Record<string, number>;

export type Riga = { r: number[]; m: string; ricavo: number; costo: number };
export type Extra = { m: string; ai: number; costo: number };

/** Righe filtrate con ricavo e costo già calcolati. */
export function filtra(d: Dati, f: Filtri) {
	const I = indici(d);
	const comp = d.componenti.filter((c) => f.conContratto || c !== "canone_da_contratto");
	const testo = f.testo.trim().toLowerCase();
	const righe: Riga[] = [];
	for (const r of d.righe) {
		const m = d.mesi[r[0]];
		if (m < f.da || m > f.a) continue;
		const fa = d.farmacie[r[1]];
		const fo = d.fornitori[r[2]];
		if (f.cat && fa[4] !== f.cat) continue;
		if (f.citta && fa[1] !== f.citta) continue;
		if (f.tipo !== "" && String(fo[1]) !== f.tipo) continue;
		if (f.forn && String(r[2]) !== f.forn) continue;
		if (testo && !fa[0].toLowerCase().includes(testo)) continue;
		let ricavo = 0;
		for (const c of comp) ricavo += r[I["r_" + c]];
		righe.push({ r, m, ricavo, costo: r[I.c_effettivo] + r[I.c_ordine] + r[I.c_listino] });
	}
	// Costo di fornitori senza consegne nel mese (es. corriere interno non chiamato):
	// entra solo se i filtri non riguardano le farmacie.
	const extra: Extra[] = [];
	if (!f.cat && !f.citta && !testo) {
		for (const [mi, ai, costo] of d.costo_senza_consegne) {
			const m = d.mesi[mi];
			if (m < f.da || m > f.a) continue;
			if (f.tipo !== "" && String(d.fornitori[ai][1]) !== f.tipo) continue;
			if (f.forn && String(ai) !== f.forn) continue;
			extra.push({ m, ai, costo });
		}
	}
	return { righe, extra, comp, I };
}
export type Filtrato = ReturnType<typeof filtra>;

export type Acc = {
	ricavo: number;
	costo: number;
	consegne: number;
	coin: number;
	eff: number;
	ord: number;
	lis: number;
	senza: number;
	farm: Set<number>;
};
export const nuovoAcc = (): Acc => ({
	ricavo: 0, costo: 0, consegne: 0, coin: 0, eff: 0, ord: 0, lis: 0, senza: 0, farm: new Set(),
});

export function accumula(acc: Acc, x: Riga, I: Record<string, number>) {
	const r = x.r;
	acc.ricavo += x.ricavo;
	acc.costo += x.costo;
	acc.consegne += r[I.consegne];
	acc.coin += r[I.coin];
	acc.eff += r[I.cons_effettivo];
	acc.ord += r[I.cons_ordine];
	acc.lis += r[I.cons_listino];
	acc.senza += r[I.cons_senza_costo];
	if (x.ricavo > 0 || r[I.consegne] > 0) acc.farm.add(r[1]);
}

export function totale(F: Filtrato) {
	const t = nuovoAcc();
	F.righe.forEach((x) => accumula(t, x, F.I));
	F.extra.forEach((x) => (t.costo += x.costo));
	return t;
}

/** Totali per ogni mese del periodo (anche i mesi senza righe). */
export function perMese(d: Dati, f: Filtri, F: Filtrato) {
	const pm = new Map<string, Acc>();
	d.mesi.filter((m) => m >= f.da && m <= f.a).forEach((m) => pm.set(m, nuovoAcc()));
	F.righe.forEach((x) => accumula(pm.get(x.m)!, x, F.I));
	F.extra.forEach((x) => (pm.get(x.m)!.costo += x.costo));
	return [...pm.entries()];
}

export type RigaVista = Acc & {
	chiave: string;
	nome: string;
	det: string;
	farmacie: number;
	margine: number;
	marginePct: number | null;
	rpc: number | null;
	cpc: number | null;
	rpcoin: number | null;
	cpcoin: number | null;
	effPct: number | null;
};

function chiaveVista(d: Dati, vista: Vista, x: Riga): [string, string, string] {
	const f = d.farmacie[x.r[1]];
	const fo = d.fornitori[x.r[2]];
	const citta = f[1] || "(città non indicata)";
	switch (vista) {
		case "citta": return [citta, citta, f[2]];
		case "farmacia": return [String(x.r[1]), f[0], [f[1], f[3] || f[4]].filter(Boolean).join(" · ")];
		case "fornitore":
			return [String(x.r[2]), nomeForn(d, x.r[2]), (fo[1] ? "interno" : "esterno") + (fo[2] ? " · " + fo[2] : "")];
		case "categoria": return [f[4], f[4], ""];
		case "gruppo": return [f[3] || "(senza gruppo)", f[3] || "(senza gruppo)", f[3] ? f[4] : "farmacie singole"];
		case "mese": return [x.m, nomeMese(x.m) + (x.m > d.ultimo_chiuso ? " (in corso)" : ""), ""];
	}
}

const rapporto = (a: number, b: number) => (b ? a / b : null);

/** Raggruppa le righe filtrate secondo la vista scelta. */
export function aggrega(d: Dati, F: Filtrato, vista: Vista): RigaVista[] {
	const g = new Map<string, RigaVista>();
	const prendi = (chiave: string, nome: string, det: string) => {
		if (!g.has(chiave)) g.set(chiave, { ...nuovoAcc(), chiave, nome, det } as RigaVista);
		return g.get(chiave)!;
	};
	for (const x of F.righe) {
		const [k, nome, det] = chiaveVista(d, vista, x);
		accumula(prendi(k, nome, det), x, F.I);
	}
	for (const x of F.extra) {
		if (vista === "fornitore") {
			const interno = d.fornitori[x.ai][1] ? "interno" : "esterno";
			prendi(String(x.ai), nomeForn(d, x.ai), `${interno} · costo senza consegne`).costo += x.costo;
		} else if (vista === "mese") {
			prendi(x.m, nomeMese(x.m), "").costo += x.costo;
		} else {
			prendi("~senza", "Costo di fornitori senza consegne nel mese", "per esempio un corriere interno non chiamato").costo += x.costo;
		}
	}
	return [...g.values()].map((a) => ({
		...a,
		farmacie: a.farm.size,
		margine: a.ricavo - a.costo,
		marginePct: rapporto(a.ricavo - a.costo, a.ricavo),
		rpc: rapporto(a.ricavo, a.consegne),
		cpc: rapporto(a.costo, a.consegne),
		rpcoin: rapporto(a.ricavo, a.coin),
		cpcoin: rapporto(a.costo, a.coin),
		effPct: rapporto(a.eff, a.consegne),
	}));
}
