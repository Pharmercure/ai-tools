// Lettura delle fonti: MongoDB tramite DB Proxy (skill mongodb-proxy) e Fatture in Cloud (sola lettura).
import type { FicDoc } from "./compute";
import type { AppEnv } from "./env";
import type { Pipeline } from "./pipelines";

// Un Worker non invia nessun User-Agent: il firewall di Cloudflare del DB Proxy blocca le richieste che ne sono prive.
const USER_AGENT = "ai-tools-primo-margine/1.0";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Un risultato vuoto è lecito ($group su zero righe non produce documenti): lo controlla chi chiama.
// Il proxy taglia in silenzio a 1000 documenti: un risultato così lungo può essere troncato.
const PROXY_MAX_DOCS = 1000;

/** Messaggio breve per una risposta di errore: le pagine di blocco di Cloudflare sono lunghe, basta il Ray ID. */
async function describeError(res: Response) {
  const text = await res.text();
  const ray = /Ray ID: <strong[^>]*>([0-9a-f]+)/.exec(text)?.[1];
  return ray ? `bloccato da Cloudflare (Ray ID ${ray})` : text.slice(0, 300);
}

export async function aggregate<T>(
  env: AppEnv,
  { collection, pipeline }: Pipeline,
): Promise<T[]> {
  const res = await fetch(`${env.DB_PROXY_URL}/db-proxy/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": USER_AGENT,
      "x-pmc-api-key": env.PMC_API_KEY,
      // Solo se il dominio del proxy è protetto da Cloudflare Access (Service Auth).
      ...(env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
        ? {
            "cf-access-client-id": env.CF_ACCESS_CLIENT_ID,
            "cf-access-client-secret": env.CF_ACCESS_CLIENT_SECRET,
          }
        : {}),
    },
    body: JSON.stringify({ op: "aggregate", collection, pipeline }),
  });
  if (!res.ok)
    throw new Error(
      `DB proxy ${collection}: ${res.status} ${await describeError(res)}`,
    );
  const docs = (await res.json()) as T[];
  if (docs.length >= PROXY_MAX_DOCS)
    throw new Error(
      `DB proxy ${collection}: risultato forse troncato (${docs.length} documenti)`,
    );
  return docs;
}

const FIC_COMPANY_ID = 1566024; // Persista srl

/** Tutte le fatture (o note di credito) emesse nel periodo, con la paginazione fatta come in fic.py pull. */
export async function pullIssued(
  env: AppEnv,
  type: "invoice" | "credit_note",
  from: string,
  to: string,
): Promise<FicDoc[]> {
  const docs: FicDoc[] = [];
  for (let page = 1; ; page++) {
    // sort=id e mai sort=date: con la data la paginazione non è stabile e si perdono documenti
    const qs = new URLSearchParams({
      type,
      per_page: "100",
      page: String(page),
      sort: "id",
      fieldset: "detailed",
      q: `date >= '${from}' and date <= '${to}'`,
    });
    const url = `https://api-v2.fattureincloud.it/c/${FIC_COMPANY_ID}/issued_documents?${qs}`;
    let body: { data?: FicDoc[]; last_page?: number } | null = null;
    for (let attempt = 0; attempt < 4 && !body; attempt++) {
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${env.FIC_ACCESS_TOKEN}`,
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
      });
      if (res.ok) body = await res.json();
      else if (attempt === 3)
        throw new Error(
          `Fatture in Cloud ${type} pagina ${page}: ${res.status} ${await describeError(res)}`,
        );
      else
        await sleep(
          res.status === 429
            ? (Number(res.headers.get("retry-after")) || 3) * 1000 + 1000
            : 2000 * (attempt + 1),
        );
    }
    docs.push(...(body!.data ?? []));
    if (page >= (body!.last_page ?? 1)) break;
    await sleep(300);
  }
  if (new Set(docs.map((d) => d.id)).size !== docs.length) {
    throw new Error(
      `Fatture in Cloud ${type}: id duplicati, paginazione non affidabile`,
    );
  }
  return docs;
}
