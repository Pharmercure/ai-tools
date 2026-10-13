import { Hono } from "hono";

// Montata su /api/demo-vendite. Tabelle: prefisso "demo_vendite_".
const api = new Hono<{ Bindings: Env }>();

api.get("/summary", async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT categoria, COUNT(*) AS ordini, SUM(importo) AS totale FROM demo_vendite_ordini GROUP BY categoria ORDER BY totale DESC",
	).all();
	return c.json(results);
});

api.get("/orders", async (c) => {
	const limit = Math.min(Number(c.req.query("limit")) || 10, 100);
	const { results } = await c.env.DB.prepare(
		"SELECT id, data, categoria, importo FROM demo_vendite_ordini ORDER BY data DESC, id DESC LIMIT ?",
	)
		.bind(limit)
		.all();
	return c.json(results);
});

export default api;
