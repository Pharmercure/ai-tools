// Lettura delle fonti: MongoDB tramite DB Proxy (skill mongodb-proxy) e Fatture in Cloud (sola lettura).
import type { FicDoc } from "./compute";
import type { AppEnv } from "./env";
import type { Pipeline } from "./pipelines";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Il proxy taglia in silenzio a 1000 documenti: un risultato così lungo può essere troncato.
const PROXY_MAX_DOCS = 1000;

export async function aggregate<T>(env: AppEnv, { collection, pipeline }: Pipeline): Promise<T[]> {
	const res = await fetch(`${env.DB_PROXY_URL}/api/db-proxy/query`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-pmc-api-key": env.PMC_API_KEY },
		body: JSON.stringify({ op: "aggregate", collection, pipeline }),
	});
	if (!res.ok) throw new Error(`DB proxy ${collection}: ${res.status} ${await res.text()}`);
	const docs = (await res.json()) as T[];
	if (!docs.length) throw new Error(`DB proxy ${collection}: nessun documento`);
	if (docs.length >= PROXY_MAX_DOCS) throw new Error(`DB proxy ${collection}: risultato forse troncato (${docs.length} documenti)`);
	return docs;
}

const FIC_COMPANY_ID = 1566024; // Persista srl

/** Tutte le fatture (o note di credito) emesse nel periodo, con la paginazione fatta come in fic.py pull. */
export async function pullIssued(env: AppEnv, type: "invoice" | "credit_note", from: string, to: string): Promise<FicDoc[]> {
	const docs: FicDoc[] = [];
	for (let page = 1; ; page++) {
		// sort=id e mai sort=date: con la data la paginazione non è stabile e si perdono documenti
		const qs = new URLSearchParams({
			type, per_page: "100", page: String(page), sort: "id", fieldset: "detailed",
			q: `date >= '${from}' and date <= '${to}'`,
		});
		const url = `https://api-v2.fattureincloud.it/c/${FIC_COMPANY_ID}/issued_documents?${qs}`;
		let body: { data?: FicDoc[]; last_page?: number } | null = null;
		for (let attempt = 0; attempt < 4 && !body; attempt++) {
			const res = await fetch(url, { headers: { authorization: `Bearer ${env.FIC_ACCESS_TOKEN}`, accept: "application/json" } });
			if (res.ok) body = await res.json();
			else if (attempt === 3) throw new Error(`Fatture in Cloud ${type} pagina ${page}: ${res.status} ${await res.text()}`);
			else await sleep(res.status === 429 ? (Number(res.headers.get("retry-after")) || 3) * 1000 + 1000 : 2000 * (attempt + 1));
		}
		docs.push(...(body!.data ?? []));
		if (page >= (body!.last_page ?? 1)) break;
		await sleep(300);
	}
	if (new Set(docs.map((d) => d.id)).size !== docs.length) {
		throw new Error(`Fatture in Cloud ${type}: id duplicati, paginazione non affidabile`);
	}
	return docs;
}
