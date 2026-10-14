# primo-margine

Ricavi pagati dalle farmacie meno costo logistico delle consegne, per mese, città, farmacia, fornitore, categoria e gruppo, da marzo 2026. I costi commerciali (provvigioni) non sono inclusi. Referente: Gianluca Abate.

## Come funziona

1. Un cron del Worker (`wrangler.json`, ogni lunedì alle 05:00 UTC) esegue `api/scheduled.ts` → `api/refresh.ts`.
2. `api/sources.ts` legge le fonti: MongoDB tramite il DB Proxy (cinque pipeline in `api/pipelines.ts`, skill `mongodb-proxy`) e Fatture in Cloud (fatture emesse e note di credito, sola lettura).
3. `api/compute.ts` calcola le righe (funzione pura, nessun accesso a rete o D1). Le regole di business sono nel commento in testa al file e nella sezione "Come si calcola" della pagina.
4. `api/validate.ts` confronta il risultato con lo snapshot precedente: righe in forte calo, mesi spariti, mesi chiusi che cambiano più del 3%. Se qualcosa non torna lo snapshot viene scartato e resta quello vecchio.
5. Lo snapshot è salvato in D1 (`primo_margine_snapshot`: stati `ok`, `rejected`, `failed`, con il motivo in `log`; si tengono gli ultimi 5 per stato).
6. `GET /api/primo-margine/dati` serve l'ultimo snapshot `ok` (404 se non ce n'è ancora); la pagina in `web/` lo legge.

`POST /api/primo-margine/refresh` rigenera su richiesta (primo avvio, test), al massimo una volta all'ora.

## Secrets da configurare

Con `npx wrangler secret put <NOME>` (in locale, in `.dev.vars`, mai in git):

- `DB_PROXY_URL`: indirizzo base del DB Proxy.
- `PMC_API_KEY`: API key del proxy.
- `FIC_ACCESS_TOKEN`: access token di Fatture in Cloud per Persista, sola lettura (da chiedere a Mauri).

## Primo avvio e controllo

Dopo il deploy lo snapshot non esiste: lancia `POST /api/primo-margine/refresh` (o aspetta il lunedì). Per vedere cosa è successo:

```bash
npx wrangler d1 execute DB --remote --command "SELECT id, created_at, status, log FROM primo_margine_snapshot ORDER BY id DESC LIMIT 5"
```

## Da sapere

- Il calcolo riproduce in modo identico lo script Python originale (verificato sugli stessi dati). Compreso un suo difetto: l'abbinamento fra nome della fattura e nome della farmacia non toglieva "farmacia", "srl" ecc. per un errore nell'espressione regolare. Vedi il commento su `normalizeName` in `compute.ts`: correggerlo cambia gli abbinamenti, quindi i numeri.
- Uno snapshot sta in una sola riga D1 (limite 2 MB, oggi circa 250 KB).
- L'aggiornamento fa una trentina di chiamate esterne e un calcolo di qualche secondo: se supera i limiti del Worker (tempo di CPU, numero di chiamate) il tentativo risulta `failed` in `log`.
