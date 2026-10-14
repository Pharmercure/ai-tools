// Secrets Cloudflare (wrangler secret put <NOME>; in locale in .dev.vars, mai in git).
export type AppEnv = Env & {
	/** Indirizzo base del DB Proxy (skill mongodb-proxy). */
	DB_PROXY_URL: string;
	PMC_API_KEY: string;
	/** Access token Fatture in Cloud di Persista, sola lettura (da chiedere a Mauri). */
	FIC_ACCESS_TOKEN: string;
};
