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

// Rigenerazione su richiesta (per il primo avvio e per i test). Al massimo una all'ora:
// legge MongoDB e Fatture in Cloud, quindi non va lanciata a raffica.
api.post("/refresh", async (c) => {
	const recent = await c.env.DB
		.prepare("SELECT 1 AS found FROM primo_margine_snapshot WHERE created_at > datetime('now', '-1 hour') LIMIT 1")
		.first();
	if (recent) return c.json({ error: "un aggiornamento è già stato tentato nell'ultima ora" }, 429);
	c.executionCtx.waitUntil(refreshSnapshot(c.env));
	return c.json({ started: true }, 202);
});

export default api;
