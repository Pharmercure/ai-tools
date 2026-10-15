// Calcolo del primo margine: una riga per mese x farmacia x fornitore, nel formato compatto di Dati.
// Funzione pura (nessuna rete, nessun D1), portata da aggiornamento/scripts/costruisci.py ed
// esporta_dashboard.py. Le regole di business sono quelle decise da Gianluca il 12/10/2026:
//  - Ricavi: imponibile di righe di fatture emesse e note di credito di Fatture in Cloud, più le
//    fatture del database emesse prima di marzo 2026 e quelle non ancora inviate. Ogni riga è
//    ripartita per giorni sui mesi del suo periodo. Le righe di un gruppo fatturato come gruppo si
//    dividono in parti uguali fra le farmacie del gruppo con un contratto in corso nel mese.
//  - Costi: costo effettivo caricato nel backadmin per fornitore e mese, diviso fra le farmacie in
//    proporzione alle consegne; altrimenti costo scritto sull'ordine; poi listino del fornitore
//    esterno; altrimenti mancante (contato, mai stimato).
//  - Il ricavo di una farmacia nel mese si divide fra i fornitori in proporzione alle consegne.
import type { Dati } from "./types";

export type MongoDate = string | { $date: string } | null | undefined;
type Doc = { _id: string | null; righe: unknown[] };

export type FicDoc = {
	id: number;
	date: string;
	type?: string;
	number?: number | string | null;
	visible_subject?: string | null;
	entity?: { name?: string | null; country?: string | null; vat_number?: string | null; type?: string | null } | null;
	items_list?: {
		code?: string | null;
		name?: string | null;
		description?: string | null;
		net_price?: number | null;
		qty?: number | null;
		discount?: number | null;
	}[];
};

export type Inputs = {
	accounts: Doc[];
	/** Un documento per mese: { _id: "2026-03", righe: [{ r: [farmacia, fornitore, n, ...] }] }. */
	orders: { _id: string; righe: { r: (string | number | null)[] }[] }[];
	deliveryCosts: Doc[];
	invoicesBeforeMarch: Doc[];
	invoicesNotOnFic: Doc[];
	issued: FicDoc[];
	creditNotes: FicDoc[];
	/** Oggi in Italia, AAAA-MM-GG. */
	today: string;
	/** Ora italiana senza fuso, AAAA-MM-GGTHH:MM (solo per il campo "estratto"). */
	now: string;
};

type Group = { id: string; nome: string; fatt: number | null; canone: number | null };
type Supplier = { id: string; nome?: string; interno?: boolean; p?: unknown; pz?: unknown; prx?: unknown; pbk?: unknown; citta?: string };
type Pharmacy = { id: string; nome?: string | null; rs?: string | null; piva?: string | null; citta?: string | null; prov?: string | null; aff?: number | null; gruppo: string | null };
type DbInvoice = {
	x?: number | null; p?: string | null; g?: string | null; gb?: boolean; t?: number; f?: MongoDate; to?: MongoDate;
	net?: number | string | null; st?: number; prod?: { ProductCode?: string; TotalToBePaid?: number | string }[] | null;
};
type Contract = { p: string; a: MongoDate; e: MongoDate; b: { s: MongoDate; e: MongoDate; pr: number }[] };
type Recipient = ["p" | "g" | "piva" | "cliente" | "escluso" | "?", string | null | undefined];
type Component = string;

const START_MONTH = "2026-03";
const GROUP_DRMAX = "68e77069bf13a54e2b1c6939";
const GROUP_HIPPO = "68d68e7dc57d5d17ed527d1a";
const GROUP_FI = "68385ba685464847ec67b9e5";
// Piccoli gruppi dello stesso titolare senza PharmaciesGroup (regole di business pmc-mongodb).
const PSEUDO_GROUPS: Record<string, string[]> = {
	"m:cannata": ["61267327f93bca9bba16bd19", "61cc35170654f678c09f009d", "6703bc174d55c9d1c96d02eb"],
	"m:villaggio": ["6915bbe9fe4bec6852d2ff5f", "6915b9fbfe4bec6852d2f31d"],
};
const PSEUDO_GROUP_NAMES: Record<string, string> = { "m:cannata": "Cannata", "m:villaggio": "Del Villaggio e Delle Poste" };
const EXCLUDED_REVENUE = ["BLUE HEALTH CENTER"];
const COMPONENTS = [
	"canone", "canone_da_contratto", "extra", "attivazione", "consegne_a_consumo", "ritiro_ricetta",
	"commissioni_pos", "oneri_sepa", "ecommerce", "consegna_cliente_webapp", "altro",
];
const DELIVERY_FIELDS = ["n", "nAcc", "dac", "nDac", "nS", "lzS", "rxS", "bkS", "rx", "lz", "wa", "coin"];

// ------------------------------------------------------------------ date
// Un giorno è un intero: giorni dal 1/1/1970. Evita i fusi orari nei calcoli per mese.
type Day = number;
const MS_DAY = 86_400_000;
const dayFromYmd = (y: number, m: number, d: number): Day => Date.UTC(y, m - 1, d) / MS_DAY;
const ymd = (day: Day) => {
	const d = new Date(day * MS_DAY);
	return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const monthOf = (day: Day) => {
	const { y, m } = ymd(day);
	return `${y}-${String(m).padStart(2, "0")}`;
};
const dayFromIso = (iso: string): Day => dayFromYmd(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));
const mongoMs = (x: MongoDate) => (x == null ? null : Date.parse(typeof x === "string" ? x : x.$date));

/** Data di calendario italiana di un istante UTC (CET/CEST approssimato: +2 da fine marzo a fine ottobre). */
function romeDay(x: MongoDate): Day | null {
	const ms = mongoMs(x);
	if (ms == null || Number.isNaN(ms)) return null;
	const d = new Date(ms);
	const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
	const offset = md >= 329 && md < 1025 ? 2 : 1;
	return Math.floor((ms + offset * 3_600_000) / MS_DAY);
}

/** Ripartisce un importo per giorni sui mesi di calendario fra inizio e fine compresi. */
function spread(start: Day, end: Day, amount: number): Map<string, number> {
	if (end < start) end = start;
	const days = end - start + 1;
	const out = new Map<string, number>();
	let d = start;
	while (d <= end) {
		const { y, m } = ymd(d);
		const next = dayFromYmd(y, m + 1, 1);
		const last = Math.min(end, next - 1);
		const key = monthOf(d);
		out.set(key, (out.get(key) ?? 0) + (amount * (last - d + 1)) / days);
		d = next;
	}
	return out;
}

const num = (x: unknown) => {
	const n = parseFloat(String(x ?? 0).replace(",", "."));
	return Number.isNaN(n) ? 0 : n;
};
// Arrotonda a 2 decimali come Python: i casi esatti a metà (es. 203,125) vanno al centesimo pari.
const r2 = (x = 0) => {
	const t = x * 100;
	const f = Math.floor(t);
	if (t - f === 0.5 && Number.isInteger(x * 8)) return (f % 2 === 0 ? f : f + 1) / 100;
	return Number(x.toFixed(2));
};
const titleCase = (s: string) =>
	s.trim().toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

// ------------------------------------------------------------ classificazione fatture
function periodFromText(...texts: (string | null | undefined)[]): [Day, Day] | null {
	for (const t of texts) {
		const m = /dal (\d\d)\/(\d\d)\/(\d{4}) al (\d\d)\/(\d\d)\/(\d{4})/i.exec(t ?? "");
		if (m) return [dayFromYmd(+m[3], +m[2], +m[1]), dayFromYmd(+m[6], +m[5], +m[4])];
	}
	return null;
}

function component(code?: string | null, name?: string | null, subject?: string | null): Component {
	const c = (code ?? "").toUpperCase();
	const n = (name ?? "").toLowerCase();
	const s = (subject ?? "").toLowerCase();
	if (c.includes("SEPA") || n.includes("oneri bancari")) return "oneri_sepa";
	if (c === "COMMISSIONI" || n.includes("commissioni pagamenti")) return "commissioni_pos";
	if (c === "018" || (n.includes("ritiro ricetta") && c !== "10004" && c !== "10002")) return "ritiro_ricetta";
	if (c === "017") return "consegne_a_consumo";
	if (c === "10004" || c === "10002") return "consegna_cliente_webapp";
	if (c === "UPGRADECONS" || s.startsWith("consegne extra")) return "extra";
	if (c === "BO&WA" || s.startsWith("attivazione") || n.includes("backoffice")) return "attivazione";
	if (n.includes("integrazione e-commerce") || s.includes("integrazione e-commerce")) return "ecommerce";
	if (s.startsWith("abbonamento") || n.startsWith("abbonamento") || /^(ERCOLE|MERCURIO|GIOVE|OLIMPO|ANNUALE|FARMACIE)/.test(c)) return "canone";
	return "altro";
}

// Chiave per abbinare il nome di una fattura al nome di una farmacia: minuscolo, solo lettere e cifre.
// Lo script Python originale voleva togliere anche parole come "farmacia" o "srl", ma per un errore
// (backspace al posto di \b nell'espressione regolare) non le toglieva mai. I numeri pubblicati sono
// stati calcolati così: si tiene lo stesso comportamento. Togliere le parole cambierebbe gli abbinamenti.
const normalizeName = (x?: string | null) => (x ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

type RevenueRow = { dest: Recipient; comp: Component; start: Day; end: Day; amount: number; ref: string };

export function computeSnapshot(input: Inputs): Dati {
	const today = dayFromIso(input.today);
	const currentMonth = monthOf(today);
	const lastClosed = (() => {
		const { y, m } = ymd(dayFromYmd(ymd(today).y, ymd(today).m, 1) - 1);
		return `${y}-${String(m).padStart(2, "0")}`;
	})();

	// -------------------------------------------------------------- anagrafiche
	const byKey = (key: string) => (input.accounts.find((d) => d._id === key)?.righe ?? []) as unknown[];
	const groups = new Map((byKey("gruppi") as Group[]).map((g) => [g.id, g]));
	const suppliers = new Map((byKey("fornitori") as Supplier[]).map((f) => [f.id, f]));
	const pharmacies = new Map((byKey("farmacie") as Pharmacy[]).map((f) => [f.id, f]));
	const dbInvoices = byKey("fatture") as DbInvoice[];
	const contracts = byKey("contratti") as Contract[];
	for (const [gid, ids] of Object.entries(PSEUDO_GROUPS)) {
		for (const p of ids) {
			const f = pharmacies.get(p);
			if (f) f.gruppo = f.gruppo || gid;
		}
	}
	const groupOf = (pid?: string | null) => (pid ? (pharmacies.get(pid)?.gruppo ?? null) : null);
	const category = (pid: string) => {
		const g = groupOf(pid);
		if (g === GROUP_HIPPO) return "Hippocrates";
		if (g === GROUP_DRMAX) return "Dr. Max";
		if (g === GROUP_FI) return "Farmacie Italiane";
		return "Indipendenti e piccoli gruppi";
	};

	// mesi in cui la farmacia ha un contratto in corso
	const contractMonths = new Map<string, Set<string>>();
	for (const c of contracts) {
		const a = romeDay(c.a);
		const e = romeDay(c.e);
		if (a == null || e == null) continue;
		const set = contractMonths.get(c.p) ?? new Set();
		for (const m of spread(a, e, 1).keys()) set.add(m);
		contractMonths.set(c.p, set);
	}
	const hasContract = (p: string, m: string) => contractMonths.get(p)?.has(m) ?? false;

	const vatToPharmacies = new Map<string, string[]>();
	const nameToPharmacies = new Map<string, string[]>();
	for (const f of pharmacies.values()) {
		if (f.piva) {
			const k = f.piva.replace(/\D/g, "");
			vatToPharmacies.set(k, [...(vatToPharmacies.get(k) ?? []), f.id]);
		}
		for (const k of new Set([normalizeName(f.nome), normalizeName(f.rs)])) {
			if (!k) continue;
			const list = nameToPharmacies.get(k) ?? [];
			if (!list.includes(f.id)) list.push(f.id);
			nameToPharmacies.set(k, list);
		}
	}

	// ----------------------------------------------------------------- consegne
	type Counter = Record<string, number>;
	const deliveries = new Map<string, { m: string; p: string; a: string; c: Counter }>();
	for (const doc of input.orders) {
		for (const { r } of doc.righe) {
			const p = String(r[0]);
			const a = (r[1] as string | null) || "senza-fornitore";
			const key = `${doc._id}|${p}|${a}`;
			let e = deliveries.get(key);
			if (!e) deliveries.set(key, (e = { m: doc._id, p, a, c: {} }));
			DELIVERY_FIELDS.forEach((name, i) => (e.c[name] = (e.c[name] ?? 0) + Number(r[i + 2] ?? 0)));
		}
	}
	const mixByPharmacyMonth = new Map<string, Map<string, number>>(); // "m|p" -> fornitore -> n
	const mixBySupplierMonth = new Map<string, Map<string, number>>(); // "m|a" -> farmacia -> n
	for (const { m, p, a, c } of deliveries.values()) {
		const k1 = `${m}|${p}`;
		if (!mixByPharmacyMonth.has(k1)) mixByPharmacyMonth.set(k1, new Map());
		mixByPharmacyMonth.get(k1)!.set(a, c.n);
		const k2 = `${m}|${a}`;
		if (!mixBySupplierMonth.has(k2)) mixBySupplierMonth.set(k2, new Map());
		mixBySupplierMonth.get(k2)!.set(p, c.n);
	}

	// -------------------------------------------------------------------- ricavi
	const dbByExternalId = new Map<string, DbInvoice>();
	for (const r of dbInvoices) if (r.x) dbByExternalId.set(String(r.x), r);

	function recipient(doc: FicDoc): Recipient {
		const ent = doc.entity ?? {};
		const name = (ent.name ?? "").toUpperCase();
		if (EXCLUDED_REVENUE.some((e) => name.includes(e))) return ["escluso", "Blue Health Center"];
		if ((doc.visible_subject ?? "").toLowerCase().includes("autofattura") || ![null, undefined, "", "Italia"].includes(ent.country))
			return ["escluso", "storni di autofatture e controparti estere"];
		if (name.includes("DRMAX ECOMM")) return ["g", GROUP_DRMAX];
		if (name.includes("FARMACIE ITALIANE")) return ["g", GROUP_FI];
		const r = dbByExternalId.get(String(doc.id));
		if (r) {
			if (r.gb && r.g) return ["g", r.g];
			if (r.p) return ["p", r.p];
		}
		const vat = (ent.vat_number ?? "").replace(/\D/g, "");
		const ids = vat ? (vatToPharmacies.get(vat) ?? []) : [];
		if (ids.length === 1) return ["p", ids[0]];
		if (ids.length) {
			const gs = new Set(ids.map((i) => groupOf(i)));
			if (gs.size === 1 && !gs.has(null)) return ["g", [...gs][0]];
			const active = ids.filter((i) => pharmacies.get(i)?.aff === 2);
			if (active.length === 1) return ["p", active[0]];
			return ["piva", vat];
		}
		const byName = nameToPharmacies.get(normalizeName(ent.name));
		if (byName?.length === 1) return ["p", byName[0]];
		if (ent.type === "person" || !vat) return ["cliente", ent.name];
		return ["?", ent.name];
	}

	const revenueRows: RevenueRow[] = [];
	const push = (dest: Recipient, comp: Component, start: Day, end: Day, amount: number, ref: string) =>
		revenueRows.push({ dest, comp, start, end, amount, ref });

	for (const [docs, sign] of [[input.issued, 1], [input.creditNotes, -1]] as const) {
		for (const doc of docs) {
			const dest = recipient(doc);
			const docDay = dayFromIso(doc.date);
			const r = dbByExternalId.get(String(doc.id));
			for (const it of doc.items_list ?? []) {
				const amount = sign * (it.net_price ?? 0) * (it.qty ?? 1) * (1 - (it.discount || 0) / 100);
				if (Math.abs(amount) < 0.005) continue;
				let period = periodFromText(doc.visible_subject, it.description, it.name);
				if (!period && r?.f && r.to) period = [romeDay(r.f)!, romeDay(r.to)!];
				if (!period) {
					const { y, m } = ymd(docDay);
					period = [dayFromYmd(y, m, 1), dayFromYmd(y, m + 1, 1) - 1];
				}
				push(dest, component(it.code, it.name, doc.visible_subject), period[0], period[1], amount,
					`${doc.type} ${doc.number}/${doc.date.slice(0, 4)} ${doc.entity?.name ?? ""}`);
			}
		}
	}

	// fatture create nel database e non ancora inviate a FIC (State 1), per esempio le trattenute del mese appena chiuso
	const TYPE_COMPONENT: Record<number, Component> = { 1: "canone", 2: "extra", 5: "attivazione" };
	const rowsOf = (d: Doc[]) => (d[0]?.righe ?? []) as DbInvoice[];
	const notSent = rowsOf(input.invoicesNotOnFic).filter((r) => r.st === 1);
	for (const r of [...rowsOf(input.invoicesBeforeMarch), ...notSent]) {
		if (!r.to || !r.f) continue;
		const dest: Recipient = r.gb && r.g ? ["g", r.g] : ["p", r.p];
		if (!dest[1]) continue;
		const start = romeDay(r.f)!;
		const end = romeDay(r.to)!;
		if (r.t === 3) {
			for (const pr of r.prod ?? [])
				push(dest, component(pr.ProductCode, "", "trattenute"), start, end, num(pr.TotalToBePaid) / 1.22, String(r.x));
		} else {
			push(dest, TYPE_COMPONENT[r.t ?? 0] ?? "altro", start, end, num(r.net), String(r.x));
		}
	}

	// ripartizione per mese e per farmacia
	const revenue = new Map<string, Map<string, number>>(); // "m|p" -> componente -> euro
	const unattributed = new Map<string, Map<string, number>>(); // mese -> chiave -> euro
	const groupMembers = (gid: string, m: string) => {
		const ids = PSEUDO_GROUPS[gid] ?? [...pharmacies.values()].filter((f) => f.gruppo === gid).map((f) => f.id);
		return ids.filter((p) => hasContract(p, m));
	};
	const addRevenue = (m: string, p: string, comp: Component, v: number) => {
		const k = `${m}|${p}`;
		if (!revenue.has(k)) revenue.set(k, new Map());
		add(revenue.get(k)!, comp, v);
	};
	const addUnattributed = (m: string, key: string, v: number) => {
		if (!unattributed.has(m)) unattributed.set(m, new Map());
		add(unattributed.get(m)!, key, v);
	};
	for (const rr of revenueRows) {
		for (const [m, amount] of spread(rr.start, rr.end, rr.amount)) {
			if (m < START_MONTH || m > currentMonth) continue;
			const [kind, val] = rr.dest;
			if (kind === "p") {
				addRevenue(m, val!, rr.comp, amount);
			} else if (kind === "g" || kind === "piva") {
				let members = kind === "g" ? groupMembers(val!, m) : (vatToPharmacies.get(val!) ?? []).filter((p) => hasContract(p, m));
				if (rr.comp === "ecommerce") members = groupMembers(GROUP_DRMAX, m);
				if (!members.length) {
					addUnattributed(m, `${kind}:${val}:${rr.comp}`, amount);
					continue;
				}
				for (const p of members) addRevenue(m, p, rr.comp, amount / members.length);
			} else if (kind === "escluso") {
				// escluso dal primo margine
			} else if (kind === "cliente" && rr.comp === "consegna_cliente_webapp") {
				addUnattributed(m, "clienti webapp:consegna_cliente_webapp", amount);
			} else if (rr.comp !== "altro") {
				addUnattributed(m, `farmacia non riconosciuta: ${rr.ref.slice(0, 60)}:${rr.comp}`, amount);
			} else if (kind === "cliente") {
				addUnattributed(m, "clienti webapp:consegna_cliente_webapp", amount);
			}
		}
	}

	// Canone senza fattura: contratti pagati prima di marzo 2026 fuori dal DB e da FIC non hanno una
	// fattura nel periodo. Per le farmacie non fatturate come gruppo, se nel mese non c'è canone
	// fatturato si usa il prezzo dei blocchi del contratto, in una voce a parte (canone_da_contratto).
	const billedAsGroup = new Set([...groups.values()].filter((g) => g.fatt === 0 && g.canone).map((g) => g.id));
	const contractFee = new Map<string, number>(); // "m|p" -> euro
	for (const c of contracts) {
		const g = groupOf(c.p);
		if (g && billedAsGroup.has(g)) continue;
		for (const b of c.b) {
			if (b.pr > 0) for (const [m, v] of spread(romeDay(b.s)!, romeDay(b.e)!, b.pr)) add(contractFee, `${m}|${c.p}`, v);
		}
	}
	for (const [k, v] of contractFee) {
		const [m, p] = k.split("|");
		if (m >= START_MONTH && m <= currentMonth && (revenue.get(k)?.get("canone") ?? 0) <= 0.5) addRevenue(m, p, "canone_da_contratto", v);
	}

	// -------------------------------------------------------------------- costi
	const actualCost = new Map<string, number>(); // "m|a" -> costo effettivo
	for (const r of (input.deliveryCosts[0]?.righe ?? []) as { a: string; from: MongoDate; to: MongoDate; act: unknown }[]) {
		const act = num(r.act);
		if (act <= 0) continue;
		let from = romeDay(r.from)!;
		const to = romeDay(r.to)!;
		// i periodi partono dall'ultimo giorno del mese prima
		if (ymd(from).d >= 28 && ymd(from).m !== ymd(to).m) from += 1;
		for (const [m, v] of spread(from, to, act)) add(actualCost, `${m}|${r.a}`, v);
	}

	type Row = {
		m: string; p: string; a: string; r: Map<string, number>;
		consegne?: number; coin?: number; c_effettivo?: number; c_ordine?: number; c_listino?: number;
		cons_effettivo?: number; cons_ordine?: number; cons_listino?: number; cons_senza_costo?: number;
	};
	const rows: Row[] = [];
	const pairs = new Map<string, [string, string]>();
	for (const k of [...revenue.keys(), ...mixByPharmacyMonth.keys()]) pairs.set(k, k.split("|") as [string, string]);
	const monthsOfPharmacy = new Map<string, string[]>();
	for (const k of mixByPharmacyMonth.keys()) {
		const [m, p] = k.split("|");
		monthsOfPharmacy.set(p, [...(monthsOfPharmacy.get(p) ?? []), m]);
	}
	const monthIndex = (m: string) => +m.slice(0, 4) * 12 + +m.slice(5);
	const sortedPairs = [...pairs.values()].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
	for (const [m, p] of sortedPairs) {
		if (m < START_MONTH) continue;
		let mix = mixByPharmacyMonth.get(`${m}|${p}`);
		let noDeliveries = false;
		if (!mix) {
			// nessuna consegna nel mese: si usa il mix del mese più vicino
			const near = (monthsOfPharmacy.get(p) ?? [])
				.map((mm) => [Math.abs(monthIndex(mm) - monthIndex(m)), mm] as const)
				.sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : 1))[0];
			mix = near ? mixByPharmacyMonth.get(`${near[1]}|${p}`)! : new Map([["nessun-fornitore", 1]]);
			noDeliveries = true;
		}
		const total = [...mix.values()].reduce((s, v) => s + v, 0);
		for (const [a, n] of mix) {
			const share = n / total;
			const row: Row = { m, p, a, r: new Map() };
			for (const [comp, v] of revenue.get(`${m}|${p}`) ?? []) row.r.set(comp, v * share);
			const c = noDeliveries ? undefined : deliveries.get(`${m}|${p}|${a}`)?.c;
			if (c) {
				row.consegne = c.n;
				row.coin = c.coin;
				const eff = actualCost.get(`${m}|${a}`);
				if (eff) {
					const totalSupplier = [...mixBySupplierMonth.get(`${m}|${a}`)!.values()].reduce((s, v) => s + v, 0);
					row.c_effettivo = (eff * c.n) / totalSupplier;
					row.cons_effettivo = c.n;
				} else {
					const f = suppliers.get(a);
					row.c_ordine = c.dac;
					row.cons_ordine = c.nDac;
					if (c.nS) {
						if (f?.interno || num(f?.p) <= 0) {
							row.cons_senza_costo = c.nS;
						} else {
							row.c_listino = c.nS * num(f?.p) + c.lzS * num(f?.pz) + c.rxS * num(f?.prx) + c.bkS * num(f?.pbk);
							row.cons_listino = c.nS;
						}
					}
				}
			}
			rows.push(row);
		}
	}

	// costo effettivo di fornitori che nel mese non hanno consegne (es. corriere interno non chiamato)
	const costWithoutDeliveries: { m: string; a: string; cost: number }[] = [];
	for (const [k, v] of actualCost) {
		const [m, a] = k.split("|");
		if (m >= START_MONTH && !mixBySupplierMonth.has(k)) costWithoutDeliveries.push({ m, a, cost: v });
	}

	// ------------------------------------------------- formato compatto (ex esporta_dashboard.py)
	const months = [...new Set(rows.map((r) => r.m))].sort();
	const pharmacyIds = [...new Set(rows.map((r) => r.p))].sort();
	const supplierIds = [...new Set([...rows.map((r) => r.a), ...costWithoutDeliveries.map((x) => x.a)])].sort();
	const pi = new Map(pharmacyIds.map((x, i) => [x, i]));
	const ai = new Map(supplierIds.map((x, i) => [x, i]));
	const mi = new Map(months.map((x, i) => [x, i]));

	return {
		estratto: input.now,
		ultimo_chiuso: lastClosed,
		fonti: {
			consegne: "MongoDB Order, stato 9, data di consegna (ora italiana)",
			ricavi: "Fatture in Cloud: fatture emesse e note di credito, imponibile di riga, ripartito per giorni sul periodo fatturato",
			costi: "MongoDB DeliveryAgencyInvoice (costo effettivo) > Order.Payment.DeliveryAgencyCost > listino DeliveryAgency > mancante",
		},
		mesi: months,
		componenti: COMPONENTS,
		colonne_righe: [
			"mese", "farmacia", "fornitore", ...COMPONENTS.map((c) => "r_" + c),
			"consegne", "c_effettivo", "c_ordine", "c_listino", "cons_effettivo", "cons_ordine", "cons_listino", "cons_senza_costo", "coin",
		],
		farmacie: pharmacyIds.map((p) => {
			const f = pharmacies.get(p);
			const g = groupOf(p);
			const groupName = (g && groups.get(g)?.nome) || (g ? PSEUDO_GROUP_NAMES[g] : null) || "";
			return [f?.nome ?? "", titleCase(f?.citta ?? ""), (f?.prov ?? "").trim().toUpperCase(), groupName, category(p)];
		}),
		fornitori: supplierIds.map((a) => {
			const f = suppliers.get(a);
			return [f?.nome || a, f?.interno ? 1 : 0, titleCase(f?.citta ?? "")];
		}),
		righe: rows.map((r) => [
			mi.get(r.m)!, pi.get(r.p)!, ai.get(r.a)!,
			...COMPONENTS.map((c) => r2(r.r.get(c))),
			r.consegne ?? 0, r2(r.c_effettivo), r2(r.c_ordine), r2(r.c_listino),
			r.cons_effettivo ?? 0, r.cons_ordine ?? 0, r.cons_listino ?? 0, r.cons_senza_costo ?? 0, r.coin ?? 0,
		]),
		costo_senza_consegne: costWithoutDeliveries.filter((x) => mi.has(x.m)).map((x) => [mi.get(x.m)!, ai.get(x.a)!, r2(x.cost)]),
		non_attribuito: Object.fromEntries(
			[...unattributed].filter(([m]) => mi.has(m)).map(([m, v]) => [m, r2([...v.values()].reduce((s, x) => s + x, 0))]),
		),
	};
}
