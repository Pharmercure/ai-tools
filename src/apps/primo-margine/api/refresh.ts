// Rigenera lo snapshot: legge le fonti, calcola, controlla e salva su D1.
import { computeSnapshot } from "./compute";
import type { AppEnv } from "./env";
import * as pipelines from "./pipelines";
import { aggregate, pullIssued } from "./sources";
import type { Dati } from "./types";
import { validateSnapshot } from "./validate";

const START_DATE = "2026-03-01";
const KEEP_PER_STATUS = 5;

type Doc = Parameters<typeof computeSnapshot>[0]["accounts"][number];
type OrderDoc = Parameters<typeof computeSnapshot>[0]["orders"][number];

const romeHour = (t: Date) =>
	Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(t));

/** Mezzanotte italiana di oggi, come istante UTC in formato ISO (limite superiore degli ordini). */
function romeMidnightUtc(today: string) {
	const [y, m, d] = today.split("-").map(Number);
	for (const offsetHours of [1, 2]) {
		const t = new Date(Date.UTC(y, m - 1, d) - offsetHours * 3_600_000);
		if (romeHour(t) === 0) return t.toISOString();
	}
	return new Date(Date.UTC(y, m - 1, d) - 3_600_000).toISOString();
}

export async function latestSnapshot(db: D1Database): Promise<string | null> {
	const row = await db
		.prepare("SELECT data FROM primo_margine_snapshot WHERE status = 'ok' ORDER BY id DESC LIMIT 1")
		.first<{ data: string }>();
	return row?.data ?? null;
}

async function save(db: D1Database, status: "ok" | "rejected" | "failed", log: object, data: Dati | null) {
	// ponytail: lo snapshot sta in una sola riga D1 (limite 2 MB, oggi circa 250 KB); se si avvicina a 1,5 MB va compresso o diviso.
	await db.batch([
		db
			.prepare("INSERT INTO primo_margine_snapshot (status, log, data) VALUES (?, ?, ?)")
			.bind(status, JSON.stringify(log), data ? JSON.stringify(data) : null),
		...(["ok", "rejected", "failed"] as const).map((s) =>
			db
				.prepare(
					"DELETE FROM primo_margine_snapshot WHERE status = ?1 AND id NOT IN (SELECT id FROM primo_margine_snapshot WHERE status = ?1 ORDER BY id DESC LIMIT ?2)",
				)
				.bind(s, KEEP_PER_STATUS),
		),
	]);
}

export async function refreshSnapshot(env: AppEnv) {
	try {
		const local = new Intl.DateTimeFormat("sv-SE", {
			timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
		}).format(new Date());
		const today = local.slice(0, 10);

		// allSettled: se qualche lettura fallisce si vedono tutte quelle fallite, non solo la prima
		const reads = await Promise.allSettled([
			aggregate<Doc>(env, pipelines.accounts),
			aggregate<OrderDoc>(env, pipelines.ordersPipeline(romeMidnightUtc(today))),
			aggregate<Doc>(env, pipelines.deliveryCosts),
			aggregate<Doc>(env, pipelines.invoicesBeforeMarch),
			aggregate<Doc>(env, pipelines.invoicesNotOnFic),
		]);
		const errors = reads.flatMap((r) => (r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : []));
		if (errors.length) throw new Error(errors.join(" | "));
		const [accounts, orders, deliveryCosts, invoicesBeforeMarch, invoicesNotOnFic] = reads.map(
			(r) => (r as PromiseFulfilledResult<unknown>).value,
		) as [Doc[], OrderDoc[], Doc[], Doc[], Doc[]];
		// le altre tre letture possono essere vuote (nessuna fattura prima di marzo, nessun costo caricato…)
		if (!accounts.length || !orders.length) throw new Error("DB proxy: anagrafiche o ordini vuoti");
		const issued = await pullIssued(env, "invoice", START_DATE, today);
		const creditNotes = await pullIssued(env, "credit_note", START_DATE, today);

		const data = computeSnapshot({
			accounts, orders, deliveryCosts, invoicesBeforeMarch, invoicesNotOnFic, issued, creditNotes,
			today, now: local.replace(" ", "T"),
		});
		const previous = await latestSnapshot(env.DB);
		const { problems, notes } = validateSnapshot(data, previous ? (JSON.parse(previous) as Dati) : null);
		const log = { problems, notes, rows: data.righe.length, invoices: issued.length, creditNotes: creditNotes.length };
		if (problems.length) {
			console.error("primo-margine: snapshot scartato", log);
			await save(env.DB, "rejected", log, data);
			return { status: "rejected" as const, ...log };
		}
		await save(env.DB, "ok", log, data);
		return { status: "ok" as const, ...log };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error("primo-margine: aggiornamento fallito", message);
		// se anche il salvataggio dell'errore fallisce (es. D1 non raggiungibile) l'esito va comunque restituito
		await save(env.DB, "failed", { error: message }, null).catch((e2) => console.error("primo-margine: esito non salvato", e2));
		return { status: "failed" as const, error: message };
	}
}
