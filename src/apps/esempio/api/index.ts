import { Hono } from "hono";

// Montata su /api/esempio. Le tabelle D1 di questa dashboard iniziano con "esempio_".
const api = new Hono<{ Bindings: Env }>();

api.get("/notes", async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT id, text FROM esempio_notes ORDER BY id DESC",
	).all();
	return c.json(results);
});

api.post("/notes", async (c) => {
	const { text } = await c.req.json<{ text?: string }>();
	if (!text?.trim()) return c.json({ error: "testo mancante" }, 400);
	await c.env.DB.prepare("INSERT INTO esempio_notes (text) VALUES (?)")
		.bind(text.trim())
		.run();
	return c.body(null, 201);
});

export default api;
