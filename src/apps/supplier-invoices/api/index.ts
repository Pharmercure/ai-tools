import { type Context, Hono } from "hono";
import {
	type AgreementItemState, type AgreementsImport, type CostAction, type CostRecord, type CostState, type Import, type LogEntry,
	type MonthImport, type MonthView, type QueueItem, type UbmImport, AGREEMENT_ITEM_STATUSES, COST_ACTIONS, OPEN_VERDICTS, OWNERS, VERDICTS,
} from "./types";

// Montata su /api/supplier-invoices. Le tabelle D1 di questa dashboard iniziano con "supplier_invoices_".
// I dati di ogni mese li carica la routine di verifica (POST /import); verdetto, chi e nota della coda
// li cambiano le persone dalla pagina (PATCH /queue/:id); stato ed esito dei punti sugli accordi li
// scrive il responsabile dei rapporti con i fornitori (PATCH /agreements/items/:id); il costo effettivo del mese
// lo conferma lui e chi lo inserisce nel backadmin lo segna come inserito (POST /costs/:month). Storico in supplier_invoices_log.
const api = new Hono<{ Bindings: Env }>();

// Chi può caricare i dati: il referente della dashboard. Tutti gli altri leggono e lavorano la coda.
const IMPORTERS = ["gianluca.abate@pharmercure.com"];

// Cloudflare Access, davanti al Worker, aggiunge l'email di chi ha fatto il login. In sviluppo locale
// (npm run dev) Access non c'è: si usa DEV_USER_EMAIL di .dev.vars, che in produzione non esiste.
const userEmail = (c: Context<{ Bindings: Env }>) =>
	(c.req.header("cf-access-authenticated-user-email") || (c.env as { DEV_USER_EMAIL?: string }).DEV_USER_EMAIL || "")
		.trim().toLowerCase();

type QueueRow = {
	id: string; month: string; supplier: string; invoice: string; owner: QueueItem["owner"]; deliveries: string;
	amount: number | null; check_text: string; verdict: QueueItem["verdict"]; note: string;
	created_at: string; updated_at: string; updated_by: string;
};

const toItem = (r: QueueRow): QueueItem => ({
	id: r.id, month: r.month, supplier: r.supplier, invoice: r.invoice, owner: r.owner, deliveries: r.deliveries,
	amount: r.amount, check: r.check_text, verdict: r.verdict, note: r.note,
	createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by,
});

// Importi nello storico come li legge una persona: 2.024,00 €.
const eurFmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" as unknown as boolean });
const eur = (n: number) => `${eurFmt.format(n)} €`;

const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

api.get("/me", (c) => {
	const email = userEmail(c);
	return c.json({ email, canImport: IMPORTERS.includes(email) });
});

// Mesi con dati caricati, dal più recente, con il numero di righe della coda ancora aperte.
api.get("/months", async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT s.month, MAX(s.created_at) AS loaded_at,
			(SELECT COUNT(*) FROM supplier_invoices_queue q WHERE q.month = s.month AND q.verdict IN (?, ?)) AS open_items
		 FROM supplier_invoices_snapshots s WHERE s.kind = 'month' GROUP BY s.month ORDER BY s.month DESC`,
	).bind(...OPEN_VERDICTS).all<{ month: string; loaded_at: string; open_items: number }>();
	return c.json(results.map((r) => ({ month: r.month, loadedAt: r.loaded_at, openItems: r.open_items })));
});

type CostRow = { supplier: string; amount: number; note: string; confirmed_at: string; confirmed_by: string; loaded_at: string | null; loaded_by: string };
const toCost = (r: CostRow): CostRecord => ({
	amount: r.amount, note: r.note, confirmedAt: r.confirmed_at, confirmedBy: r.confirmed_by, loadedAt: r.loaded_at, loadedBy: r.loaded_by,
});

async function monthView(db: D1Database, month: string): Promise<MonthView | null> {
	const snap = await db.prepare(
		"SELECT data, created_at, created_by FROM supplier_invoices_snapshots WHERE kind = 'month' AND month = ? ORDER BY id DESC LIMIT 1",
	).bind(month).first<{ data: string; created_at: string; created_by: string }>();
	if (!snap) return null;
	const data = JSON.parse(snap.data) as MonthImport;
	const { results } = await db.prepare("SELECT * FROM supplier_invoices_queue WHERE month = ? ORDER BY supplier, id").bind(month).all<QueueRow>();
	const { results: costRows } = await db.prepare("SELECT * FROM supplier_invoices_costs WHERE month = ?").bind(month).all<CostRow>();
	const queue = results.map(toItem);
	const costs = new Map(costRows.map((r) => [r.supplier, toCost(r)]));
	return {
		month, extractedAt: data.extractedAt, source: data.source, loadedAt: snap.created_at, loadedBy: snap.created_by,
		suppliers: data.suppliers.map((s) => {
			const openItems = queue.filter((q) => q.supplier === s.supplier && OPEN_VERDICTS.includes(q.verdict)).length;
			const cost = costs.get(s.supplier) ?? null;
			// Regola della KB: finché uno scostamento è aperto si carica solo il costo previsto. Il costo effettivo
			// si inserisce nel backadmin solo dopo che il responsabile fornitori l'ha confermato.
			const costState: CostState = cost?.loadedAt ? "loaded" : cost ? "confirmed"
				: s.invoiced === null ? "no_invoice" : openItems > 0 ? "expected_only" : "to_confirm";
			return { ...s, openItems, costState, cost };
		}),
		queue,
	};
}

api.get("/months/:month", async (c) => {
	const month = c.req.param("month");
	if (!isMonth(month)) return c.json({ error: "mese non valido" }, 400);
	const view = await monthView(c.env.DB, month);
	if (!view) return c.json({ error: "nessun dato per questo mese" }, 404);
	return c.json(view);
});

// Il ciclo del costo di un fornitore nel mese: conferma (con l'importo), annullamento della conferma,
// inserito nel backadmin, annullamento dell'inserito. Ogni passaggio va nello storico.
api.post("/costs/:month", async (c) => {
	const month = c.req.param("month");
	if (!isMonth(month)) return c.json({ error: "mese non valido" }, 400);
	const by = userEmail(c) || "sconosciuto";
	const body = await c.req.json<{ supplier?: string; action?: CostAction; amount?: number; note?: string }>().catch(() => null);
	if (!body || typeof body.supplier !== "string" || !(COST_ACTIONS as readonly string[]).includes(body.action ?? "")) {
		return c.json({ error: "richiesta non valida" }, 400);
	}
	const db = c.env.DB;
	const view = await monthView(db, month);
	const s = view?.suppliers.find((x) => x.supplier === body.supplier);
	if (!s) return c.json({ error: "fornitore non trovato nel mese" }, 404);
	const fmt = (r: CostRecord | null) => (r ? `${eur(r.amount)}${r.loadedAt ? ", inserito" : ""}` : "");
	let stmt: D1PreparedStatement;
	let newValue: string;
	switch (body.action) {
		case "confirm": {
			if (s.costState !== "to_confirm") {
				return c.json({ error: s.invoiced === null ? "La fattura non è ancora arrivata." : s.openItems ? "Ci sono ancora scostamenti da decidere." : "Il costo è già confermato." }, 400);
			}
			const amount = Math.round(Number(body.amount) * 100) / 100;
			if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return c.json({ error: "Importo non valido." }, 400);
			const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
			// Un importo diverso dalla fattura (per esempio dopo una nota di credito) va spiegato.
			if (Math.abs(amount - (s.invoiced ?? 0)) > 0.005 && !note) return c.json({ error: "Se l'importo è diverso dalla fattura scrivi il perché nella nota." }, 400);
			stmt = db.prepare("INSERT INTO supplier_invoices_costs (month, supplier, amount, note, confirmed_by) VALUES (?, ?, ?, ?, ?)")
				.bind(month, s.supplier, amount, note, by);
			newValue = `${eur(amount)} confermato${note ? ` (${note})` : ""}`;
			break;
		}
		case "unconfirm":
			if (s.costState !== "confirmed") return c.json({ error: s.costState === "loaded" ? "Il costo è già inserito: prima va tolto l'inserito." : "Il costo non è confermato." }, 400);
			stmt = db.prepare("DELETE FROM supplier_invoices_costs WHERE month = ? AND supplier = ?").bind(month, s.supplier);
			newValue = "conferma annullata";
			break;
		case "loaded":
			if (s.costState !== "confirmed") return c.json({ error: "Si segna come inserito solo un costo confermato e non ancora inserito." }, 400);
			stmt = db.prepare("UPDATE supplier_invoices_costs SET loaded_at = datetime('now'), loaded_by = ? WHERE month = ? AND supplier = ?").bind(by, month, s.supplier);
			newValue = "inserito nel backadmin";
			break;
		default:
			if (s.costState !== "loaded") return c.json({ error: "Il costo non risulta inserito." }, 400);
			stmt = db.prepare("UPDATE supplier_invoices_costs SET loaded_at = NULL, loaded_by = '' WHERE month = ? AND supplier = ?").bind(month, s.supplier);
			newValue = "inserito annullato";
	}
	await db.batch([stmt, logStmt(db, "cost", `${month}|${s.supplier}`, "cost", fmt(s.cost), newValue, by)]);
	return c.json(await monthView(db, month));
});

api.get("/costs/:month/log", async (c) => {
	const supplier = c.req.query("supplier") ?? "";
	return c.json(await readLog(c.env.DB, "cost", `${c.req.param("month")}|${supplier}`));
});

// Coda di tutti i mesi; con ?open=1 solo le righe ancora da decidere.
api.get("/queue", async (c) => {
	const open = c.req.query("open") === "1";
	const sql = open
		? "SELECT * FROM supplier_invoices_queue WHERE verdict IN (?, ?) ORDER BY month DESC, supplier, id"
		: "SELECT * FROM supplier_invoices_queue ORDER BY month DESC, supplier, id";
	const stmt = open ? c.env.DB.prepare(sql).bind(...OPEN_VERDICTS) : c.env.DB.prepare(sql);
	const { results } = await stmt.all<QueueRow>();
	return c.json(results.map(toItem));
});

async function readLog(db: D1Database, kind: "queue" | "agreement" | "cost", id: string): Promise<LogEntry[]> {
	const { results } = await db.prepare(
		"SELECT field, old_value, new_value, changed_by, changed_at FROM supplier_invoices_log WHERE item_kind = ? AND item_id = ? ORDER BY id DESC",
	).bind(kind, id).all<{ field: string; old_value: string | null; new_value: string | null; changed_by: string; changed_at: string }>();
	return results.map((r) => ({ field: r.field, oldValue: r.old_value, newValue: r.new_value, changedBy: r.changed_by, changedAt: r.changed_at }));
}

const logStmt = (db: D1Database, kind: "queue" | "agreement" | "cost", id: string, field: string, oldValue: string, newValue: string, by: string) =>
	db.prepare("INSERT INTO supplier_invoices_log (item_kind, item_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(kind, id, field, oldValue, newValue, by);

api.get("/queue/:id/log", async (c) => c.json(await readLog(c.env.DB, "queue", c.req.param("id"))));

api.patch("/queue/:id", async (c) => {
	const id = c.req.param("id");
	const by = userEmail(c) || "sconosciuto";
	const body = await c.req.json<{ verdict?: string; owner?: string; note?: string }>().catch(() => null);
	if (!body) return c.json({ error: "richiesta non valida" }, 400);
	const changes: [field: "verdict" | "owner" | "note", value: string][] = [];
	if (body.verdict !== undefined) {
		if (!(VERDICTS as readonly string[]).includes(body.verdict)) return c.json({ error: "verdetto non valido" }, 400);
		changes.push(["verdict", body.verdict]);
	}
	if (body.owner !== undefined) {
		if (!(OWNERS as readonly string[]).includes(body.owner)) return c.json({ error: "chi non valido" }, 400);
		changes.push(["owner", body.owner]);
	}
	if (body.note !== undefined) {
		if (typeof body.note !== "string" || body.note.length > 2000) return c.json({ error: "nota non valida" }, 400);
		changes.push(["note", body.note.trim()]);
	}
	if (!changes.length) return c.json({ error: "niente da cambiare" }, 400);

	const row = await c.env.DB.prepare("SELECT * FROM supplier_invoices_queue WHERE id = ?").bind(id).first<QueueRow>();
	if (!row) return c.json({ error: "riga non trovata" }, 404);
	// Cambiare un verdetto cambia il costo del fornitore: se il costo del mese è già confermato, prima si annulla la conferma.
	if (body.verdict !== undefined && body.verdict !== row.verdict) {
		const cost = await c.env.DB.prepare("SELECT 1 FROM supplier_invoices_costs WHERE month = ? AND supplier = ?").bind(row.month, row.supplier).first();
		if (cost) return c.json({ error: "Il costo di questo fornitore è già confermato: per cambiare il verdetto prima annulla la conferma dalla sua pagina." }, 409);
	}
	const stmts = [];
	for (const [field, value] of changes) {
		if (row[field] === value) continue;
		// field viene solo dall'elenco chiuso qui sopra: non è input dell'utente
		stmts.push(c.env.DB.prepare(`UPDATE supplier_invoices_queue SET ${field} = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`).bind(value, by, id));
		stmts.push(logStmt(c.env.DB, "queue", id, field, row[field], value, by));
	}
	if (stmts.length) await c.env.DB.batch(stmts);
	const updated = await c.env.DB.prepare("SELECT * FROM supplier_invoices_queue WHERE id = ?").bind(id).first<QueueRow>();
	return c.json(toItem(updated!));
});

type AgreementItemRow = { id: string; status: AgreementItemState["status"]; outcome: string; updated_at: string; updated_by: string };
const toState = (r: AgreementItemRow): AgreementItemState => ({
	id: r.id, status: r.status, outcome: r.outcome, updatedAt: r.updated_at, updatedBy: r.updated_by,
});
const ITEM_COLUMNS = "id, status, outcome, updated_at, updated_by";

api.get("/agreements", async (c) => {
	const snap = await c.env.DB.prepare(
		"SELECT data, created_at, created_by FROM supplier_invoices_snapshots WHERE kind = 'agreements' ORDER BY id DESC LIMIT 1",
	).first<{ data: string; created_at: string; created_by: string }>();
	if (!snap) return c.json({ error: "nessun accordo caricato" }, 404);
	const { results } = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM supplier_invoices_agreement_items`).all<AgreementItemRow>();
	return c.json({
		...(JSON.parse(snap.data) as AgreementsImport), loadedAt: snap.created_at, loadedBy: snap.created_by,
		states: Object.fromEntries(results.map((r) => [r.id, toState(r)])),
	});
});

// Punti chiusi con il loro esito: la routine li legge per riportare le regole nel Registro Accordi.
api.get("/agreements/outcomes", async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT id, supplier, topic, outcome, updated_at, updated_by FROM supplier_invoices_agreement_items WHERE status = 'closed' ORDER BY updated_at DESC",
	).all();
	return c.json(results);
});

api.get("/agreements/items/:id/log", async (c) => c.json(await readLog(c.env.DB, "agreement", c.req.param("id"))));

api.patch("/agreements/items/:id", async (c) => {
	const id = c.req.param("id");
	const by = userEmail(c) || "sconosciuto";
	const body = await c.req.json<{ status?: string; outcome?: string }>().catch(() => null);
	if (!body) return c.json({ error: "richiesta non valida" }, 400);
	const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM supplier_invoices_agreement_items WHERE id = ?`).bind(id).first<AgreementItemRow>();
	if (!row) return c.json({ error: "punto non trovato" }, 404);
	const changes: [field: "status" | "outcome", value: string][] = [];
	if (body.status !== undefined) {
		if (!(AGREEMENT_ITEM_STATUSES as readonly string[]).includes(body.status)) return c.json({ error: "stato non valido" }, 400);
		changes.push(["status", body.status]);
	}
	if (body.outcome !== undefined) {
		if (typeof body.outcome !== "string" || body.outcome.length > 4000) return c.json({ error: "esito non valido" }, 400);
		changes.push(["outcome", body.outcome.trim()]);
	}
	// Un punto si chiude solo con un esito scritto: è la regola che poi va nel Registro Accordi.
	const finalStatus = changes.find(([f]) => f === "status")?.[1] ?? row.status;
	const finalOutcome = changes.find(([f]) => f === "outcome")?.[1] ?? row.outcome;
	if (finalStatus === "closed" && !finalOutcome) return c.json({ error: "Per chiudere un punto scrivi prima l'esito." }, 400);
	const stmts = [];
	for (const [field, value] of changes) {
		if (row[field] === value) continue;
		// field viene solo dall'elenco chiuso qui sopra: non è input dell'utente
		stmts.push(c.env.DB.prepare(`UPDATE supplier_invoices_agreement_items SET ${field} = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`).bind(value, by, id));
		stmts.push(logStmt(c.env.DB, "agreement", id, field, row[field], value, by));
	}
	if (stmts.length) await c.env.DB.batch(stmts);
	const updated = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM supplier_invoices_agreement_items WHERE id = ?`).bind(id).first<AgreementItemRow>();
	return c.json(toState(updated!));
});

api.get("/ubm", async (c) => {
	const snap = await c.env.DB.prepare(
		"SELECT data, created_at, created_by FROM supplier_invoices_snapshots WHERE kind = 'ubm' ORDER BY id DESC LIMIT 1",
	).first<{ data: string; created_at: string; created_by: string }>();
	if (!snap) return c.json({ error: "nessun dato UBM caricato" }, 404);
	return c.json({ ...(JSON.parse(snap.data) as UbmImport), loadedAt: snap.created_at, loadedBy: snap.created_by });
});

// Caricamento dei dati calcolati dalla routine. Le righe della coda nuove si inseriscono; per quelle
// già presenti si aggiornano solo i campi descrittivi, mai verdetto, chi e nota.
api.post("/import", async (c) => {
	const by = userEmail(c);
	if (!IMPORTERS.includes(by)) return c.json({ error: "solo il referente della dashboard può caricare i dati" }, 403);
	const body = await c.req.json<Import>().catch(() => null);
	const err = validate(body);
	if (err) return c.json({ error: err }, 400);
	const data = body!;
	const stmts = [
		c.env.DB.prepare("INSERT INTO supplier_invoices_snapshots (kind, month, created_by, data) VALUES (?, ?, ?, ?)")
			.bind(data.kind, data.kind === "month" ? data.month : "", by, JSON.stringify(data)),
	];
	let queued = 0;
	if (data.kind === "month") {
		for (const q of data.queue) {
			queued++;
			stmts.push(c.env.DB.prepare(
				// updated_by resta vuoto: indica le modifiche delle persone, non dei caricamenti
				`INSERT INTO supplier_invoices_queue (id, month, supplier, invoice, owner, deliveries, amount, check_text, verdict)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET invoice = excluded.invoice, deliveries = excluded.deliveries,
					amount = excluded.amount, check_text = excluded.check_text`,
			).bind(q.id, q.month, q.supplier, q.invoice, q.owner, q.deliveries, q.amount, q.check, q.verdict));
		}
	}
	if (data.kind === "agreements") {
		// I punti nuovi entrano aperti; per quelli già presenti si aggiornano solo fornitore e titolo, mai stato ed esito.
		for (const s of data.suppliers) {
			for (const g of s.gaps) {
				stmts.push(c.env.DB.prepare(
					`INSERT INTO supplier_invoices_agreement_items (id, supplier, topic) VALUES (?, ?, ?)
					 ON CONFLICT(id) DO UPDATE SET supplier = excluded.supplier, topic = excluded.topic`,
				).bind(g.id, s.supplier, g.topic));
			}
		}
	}
	await c.env.DB.batch(stmts);
	return c.json({ ok: true, kind: data.kind, queueRows: queued });
});

function validate(d: Import | null): string | null {
	if (!d || typeof d !== "object") return "JSON non valido";
	if (typeof d.extractedAt !== "string" || isNaN(Date.parse(d.extractedAt))) return "extractedAt mancante o non valido";
	if (d.kind === "month") {
		if (!isMonth(d.month)) return "month deve essere AAAA-MM";
		if (!Array.isArray(d.suppliers) || !Array.isArray(d.queue)) return "suppliers e queue devono essere elenchi";
		for (const s of d.suppliers) {
			if (!s.supplier || !["A", "B"].includes(s.track)) return `fornitore non valido: ${s.supplier}`;
			if (!["ok", "deviation", "missing", "not_profiled"].includes(s.outcome)) return `esito non valido per ${s.supplier}`;
		}
		for (const q of d.queue) {
			if (!q.id || !q.supplier || q.month !== d.month) return `riga della coda non valida: ${q.id}`;
			if (!(OWNERS as readonly string[]).includes(q.owner)) return `chi non valido nella riga ${q.id}`;
			if (!(VERDICTS as readonly string[]).includes(q.verdict)) return `verdetto non valido nella riga ${q.id}`;
		}
		return null;
	}
	if (d.kind === "ubm") {
		if (!Array.isArray(d.carnets) || !Array.isArray(d.monthly) || !Array.isArray(d.differences)) return "dati UBM incompleti";
		return null;
	}
	if (d.kind === "agreements") {
		if (!Array.isArray(d.themes) || !Array.isArray(d.suppliers)) return "themes e suppliers devono essere elenchi";
		for (const s of d.suppliers) {
			if (!s.supplier || typeof s.writtenAgreement !== "boolean") return `accordo non valido: ${s.supplier}`;
			if (!Array.isArray(s.gaps) || !Array.isArray(s.ours) || !Array.isArray(s.observed)) return `accordo incompleto: ${s.supplier}`;
			for (const g of s.gaps) if (!g.id || !g.topic) return `punto senza id o titolo per ${s.supplier}`;
		}
		return null;
	}
	return "kind deve essere month, ubm o agreements";
}

export default api;
