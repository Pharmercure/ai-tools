import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// Ogni src/apps/<nome>/api/index.ts viene montato automaticamente su /api/<nome>
const routes = import.meta.glob<{ default: Hono<{ Bindings: Env }> }>(
	"../apps/*/api/index.ts",
	{ eager: true },
);
for (const [path, mod] of Object.entries(routes)) {
	app.route(`/api/${path.match(/apps\/([^/]+)\//)![1]}`, mod.default);
}

export default app;
