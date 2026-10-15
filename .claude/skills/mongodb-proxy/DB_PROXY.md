# DB Proxy API

Endpoint di sola lettura per interrogare il database MongoDB Pharmercure dall'esterno (es. da un Cloudflare Worker). Espone `find`, `count`, `distinct` e `aggregate` su qualsiasi collection, con limiti e protezioni lato server.

## Richiesta

```
POST {base-url}/api/db-proxy/query
Content-Type: application/json
x-pmc-api-key: <PMC API KEY>
```

`base-url` e API key dipendono dall'ambiente (staging / produzione). L'API key è la stessa usata per gli altri endpoint server-to-server e va tenuta solo lato server (mai nel browser).

Risposta di successo: `200` con il risultato in JSON.

## Formato dei valori (Extended JSON)

Il body è JSON, ma per i tipi che JSON non ha si usa l'Extended JSON di MongoDB:

| Tipo     | Come scriverlo                    |
| -------- | --------------------------------- |
| ObjectId | `{ "$oid": "665f1c0e2a1b3c0012ab34cd" }` |
| Date     | `{ "$date": "2026-01-31T00:00:00Z" }`    |

Ogni `_id` e ogni campo ObjectId/Date nei **filtri** va passato così, altrimenti Mongo lo confronta come stringa e non trova nulla.
Nelle **risposte** ObjectId e date tornano come stringhe (ObjectId in esadecimale, date in ISO 8601).

## Operazioni

Il campo `op` sceglie l'operazione. `collection` è sempre obbligatorio.

### `find`

```json
{
  "op": "find",
  "collection": "Pharmacy",
  "filter": { "City": "Milano" },
  "projection": { "Name": 1, "City": 1 },
  "sort": { "Name": 1 },
  "limit": 50,
  "skip": 0
}
```

Tutti i campi tranne `op` e `collection` sono opzionali. Risposta: array di documenti.

### `count`

```json
{ "op": "count", "collection": "Pharmacy", "filter": { "City": "Milano" } }
```

Risposta: `{ "count": 42 }`

### `distinct`

```json
{ "op": "distinct", "collection": "Pharmacy", "field": "City", "filter": {} }
```

Risposta: array di valori distinti.

### `aggregate`

```json
{
  "op": "aggregate",
  "collection": "Pharmacy",
  "pipeline": [
    { "$match": { "Active": true } },
    { "$group": { "_id": "$City", "total": { "$sum": 1 } } },
    { "$sort": { "total": -1 } }
  ]
}
```

Risposta: array di documenti.

## Limiti

| Limite                 | Valore                                                   |
| ---------------------- | -------------------------------------------------------- |
| Tempo massimo query    | 10 secondi (errore `408` se superato)                    |
| `limit` (find)         | default 100, massimo 1000 (valori fuori range vengono riportati nel range) |
| `skip` (find)          | massimo 10000                                            |
| Stage di una pipeline  | massimo 20                                               |
| Risultati di `aggregate` | massimo 1000 documenti: **il proxy aggiunge `{ "$limit": 1000 }` in coda alla pipeline, senza errore**. Per paginare usare `$skip`/`$limit` nella pipeline |
| Profondità del JSON    | massimo 20 livelli                                       |
| `allowDiskUse`         | disattivato                                              |

Per `find`, `limit` e `skip` fuori dai limiti vengono corretti in silenzio, non rifiutati.

## Cosa viene rifiutato

Queste richieste ricevono `400` con un messaggio che indica il motivo:

- **Operatori non ammessi:** `$where`, `$function`, `$accumulator`, `$out`, `$merge`, `$getField`, `$setField`, `$unsetField` e gli stage di diagnostica/amministrazione (`$currentOp`, `$collStats`, `$indexStats`, `$listSessions`, `$planCacheStats`, `$changeStream`, …).
- **Collection non ammesse:** nomi con caratteri non validi, collection `system.*`, o collection in denylist. Vale anche per `from` in `$lookup`/`$graphLookup` e `coll` in `$unionWith`.
- **Campi riservati:** `password`, `passwordHash`, `accessToken`, `firebaseToken`, `downloadToken`, `iban`, `ibanCode` (maiuscole/minuscole ignorate, anche in percorsi come `User.passwordHash` o riferimenti come `"$passwordHash"`). Non si possono usare in filtri, sort, proiezioni o pipeline, e vengono sempre rimossi dai risultati.
- Body non valido (Extended JSON malformato, `op` sconosciuto, `pipeline` non array).

## Errori

| Status | Significato                                                  |
| ------ | ------------------------------------------------------------ |
| `200`  | OK                                                           |
| `400`  | Query rifiutata o non valida, oppure errore di Mongo (il messaggio descrive la causa). Anche **API key mancante o errata**: in quel caso il messaggio è `PMC API KEY is missing or invalid` |
| `408`  | La query ha superato i 10 secondi                            |
| `500`  | Errore del server, o API key non configurata sul server      |

Il body di errore ha la forma standard NestJS: `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.

## Note per chi integra

- Il proxy è **solo lettura**, ma il vincolo reale è l'utente Mongo configurato lato server (`DB_PROXY_URI`). Non fare affidamento sulle sole validazioni qui sopra per proteggere i dati.
- Non inoltrare query scritte da utenti finali senza controlli: l'accesso è ampio (qualsiasi collection e operatore consentito). Costruire le query lato Worker a partire da parametri validati.
- Preferire `projection` e `limit` espliciti per ridurre payload e tempi.
- Le letture usano `secondaryPreferred`: i dati possono essere in ritardo di qualche istante rispetto alle scritture più recenti.

## Esempio (curl)

```bash
curl -X POST "$BASE_URL/api/db-proxy/query" \
  -H "Content-Type: application/json" \
  -H "x-pmc-api-key: $PMC_API_KEY" \
  -d '{
    "op": "find",
    "collection": "Pharmacy",
    "filter": { "_id": { "$oid": "665f1c0e2a1b3c0012ab34cd" } },
    "limit": 1
  }'
```
