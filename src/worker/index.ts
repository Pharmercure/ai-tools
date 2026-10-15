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

// Ogni src/apps/<nome>/api/scheduled.ts (export default: funzione async che riceve l'env) viene
// eseguito dai cron di wrangler.json ("triggers"). Tutti i cron lanciano tutti i job.
const jobs = import.meta.glob<{ default: (env: Env) => Promise<void> }>(
	"../apps/*/api/scheduled.ts",
	{ eager: true },
);

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(Promise.all(Object.values(jobs).map((job) => job.default(env))));
	},
};
