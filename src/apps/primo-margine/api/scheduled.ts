import type { AppEnv } from "./env";
import { refreshSnapshot } from "./refresh";

// Eseguito dal cron del Worker (vedi wrangler.json), una volta a settimana.
export default async function scheduled(env: Env) {
	await refreshSnapshot(env as AppEnv);
}
