import { Hono } from "hono";
import type { AppEnv } from "./env";
import { latestSnapshot, refreshSnapshot } from "./refresh";

// Montata su /api/primo-margine. Le tabelle D1 di questa dashboard iniziano con "primo_margine_".
// I dati sono uno snapshot rigenerato dal cron (scheduled.ts) da MongoDB e Fatture in Cloud.
const api = new Hono<{ Bindings: AppEnv }>();

api.get("/dati", async (c) => {
	const data = await latestSnapshot(c.env.DB);
	if (!data) return c.json({ error: "snapshot non ancora generato" }, 404);
	return new Response(data, { headers: { "content-type": "application/json" } });
});

// Esito dell'ultimo tentativo di aggiornamento (ok, scartato dai controlli o fallito), per il bottone nella pagina.
api.get("/status", async (c) => {
	const row = await c.env.DB
		.prepare("SELECT id, created_at, status, log FROM primo_margine_snapshot ORDER BY id DESC LIMIT 1")
		.first<{ id: number; created_at: string; status: string; log: string }>();
	return c.json(row ? { ...row, log: JSON.parse(row.log) } : null);
});

// Rigenerazione su richiesta (primo avvio e test). Legge MongoDB e Fatture in Cloud.
// ponytail: per ora nessun limite di frequenza, per poter provare facilmente. Prima di usarlo
// in produzione rimettere "al massimo un tentativo all'ora" (controllo su created_at in D1).
api.post("/refresh", (c) => {
	c.executionCtx.waitUntil(refreshSnapshot(c.env));
	return c.json({ started: true }, 202);
});

export default api;
