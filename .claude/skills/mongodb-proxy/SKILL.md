---
name: mongodb-proxy
description: Come leggere i dati del database MongoDB Pharmercure dal Worker tramite il DB Proxy API (find, count, distinct, aggregate in sola lettura, con API key). Usala quando una dashboard deve leggere dati da MongoDB (consegne, farmacie, fatture, contratti…).
---

# MongoDB tramite DB Proxy

Il Worker **non** si collega direttamente a MongoDB (niente driver, niente IP aperti su Atlas). Legge i dati chiamando il **DB Proxy API**, un servizio del progetto `pharmercure` (`apps/integration-service/src/db-proxy`). Documentazione completa, con esempi `curl` e tabella degli errori: [DB_PROXY.md](DB_PROXY.md) (nella stessa cartella). Questa pagina ne è il riassunto operativo per il Worker: se il proxy cambia, aggiorna prima `DB_PROXY.md`.

Per dati che la dashboard scrive o salva (snapshot, preferenze) si usa D1: vedi `database-d1`.

## Configurazione

Due secrets Cloudflare, mai nel codice né in git (`wrangler secret put <NOME>`; in locale `.dev.vars`, non in git):

- `DB_PROXY_URL`: indirizzo base del proxy (staging o produzione).
- `PMC_API_KEY`: API key server-to-server. Solo lato Worker, mai nel browser.

Se i tipi `Env` non li vedono, esegui `npm run cf-typegen`.

## Richiesta

```
POST {DB_PROXY_URL}/api/db-proxy/query
Content-Type: application/json
x-pmc-api-key: <PMC_API_KEY>
```

```ts
const res = await fetch(`${c.env.DB_PROXY_URL}/api/db-proxy/query`, {
	method: "POST",
	headers: { "content-type": "application/json", "x-pmc-api-key": c.env.PMC_API_KEY },
	body: JSON.stringify({ op: "find", collection: "Pharmacy", filter: { _id: { $oid: id } }, limit: 1 }),
});
if (!res.ok) throw new Error(`DB proxy ${res.status}: ${await res.text()}`);
const docs = await res.json();
```

## Operazioni (`op`; `collection` sempre obbligatoria)

| `op` | Campi | Risposta |
| --- | --- | --- |
| `find` | `filter`, `projection`, `sort`, `limit`, `skip` (tutti opzionali) | array di documenti |
| `count` | `filter` | `{ "count": n }` |
| `distinct` | `field`, `filter` | array di valori |
| `aggregate` | `pipeline` (array) | array di documenti |

## Tipi speciali (Extended JSON)

ObjectId: `{ "$oid": "665f…" }`. Date: `{ "$date": "2026-01-31T00:00:00Z" }`. Nei **filtri** vanno scritti così, altrimenti Mongo confronta stringhe e non trova nulla. Nelle **risposte** ObjectId e date tornano come stringhe (esadecimale e ISO 8601): per confrontarli usa `{ $toString: "$_id" }` nella pipeline o confronta stringhe.

## Limiti da ricordare

- Tempo massimo 10 s per query (errore `408`): query pesanti vanno spezzate (per mese, per collection).
- `find`: `limit` default 100, massimo 1000; `skip` massimo 10000. Fuori range viene corretto **in silenzio**.
- `aggregate`: massimo 20 stage e **1000 documenti in uscita**: il proxy aggiunge `{ "$limit": 1000 }` in coda **senza avvisare**. Se servono più righe, raggruppa nella pipeline (come fanno le estrazioni di `primo-margine`) o pagina con `$skip`/`$limit`. Un risultato di esattamente 1000 documenti va trattato come possibilmente troncato.
- JSON profondo al massimo 20 livelli; `allowDiskUse` disattivato.
- Le letture usano `secondaryPreferred`: i dati possono essere in ritardo di qualche istante.

## Cosa viene rifiutato (`400`)

- Operatori: `$where`, `$function`, `$accumulator`, `$out`, `$merge`, `$getField`, `$setField`, `$unsetField` e stage di amministrazione (`$currentOp`, `$collStats`, `$indexStats`, `$changeStream`…).
- Collection `system.*` o in denylist (anche in `$lookup`, `$graphLookup`, `$unionWith`).
- Campi riservati, sempre rimossi dai risultati: `password`, `passwordHash`, `accessToken`, `firebaseToken`, `downloadToken`, `iban`, `ibanCode` (maiuscole ignorate, anche in percorsi come `User.passwordHash`).
- Body non valido. Anche **API key mancante o errata** dà `400` (`PMC API KEY is missing or invalid`); `500` se la chiave non è configurata sul server.

Errore standard NestJS: `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`. Mostra all'utente un messaggio chiaro, non il testo grezzo.

## Buone pratiche

- Il proxy è solo lettura, ma il vincolo vero è l'utente Mongo del server: non fidarti solo delle validazioni.
- Non girare al proxy query scritte da utenti finali: costruiscile nel Worker da parametri validati (accesso ampio a qualsiasi collection).
- Usa sempre `projection` e `limit` espliciti.
- Dati stabili o costosi da calcolare: leggili con un calcolo programmato e salvali in D1, non a ogni apertura della pagina (vedi `database-d1`).
