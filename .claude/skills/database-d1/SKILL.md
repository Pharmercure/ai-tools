---
name: database-d1
description: Come usare il database Cloudflare D1 condiviso nelle dashboard (query, tabelle con prefisso, migrazioni). Usala quando serve salvare o leggere dati, creare o modificare tabelle.
---

# Database D1

Un solo database D1, binding `DB`, condiviso da tutte le dashboard. Nel codice backend è `c.env.DB` (Hono).

## Regole

- Ogni tabella inizia con il nome della dashboard: `ordini_fornitori_righe` per `ordini-fornitori` (trattini → `_`).
- Mai toccare tabelle di altre dashboard.
- Ogni modifica allo schema è un **nuovo** file in `migrations/`. Non modificare mai una migrazione già creata.
- Query sempre parametrizzate con `.bind(...)`, mai concatenando input dell'utente nella stringa SQL.
- Valida l'input nelle rotte API (campi mancanti → risposta 400).

## Nuova migrazione

Nome file: `migrations/NNNN_<nome>_<descrizione>.sql`, dove `NNNN` è il numero successivo all'ultimo presente (guarda la cartella: `0002`, `0003`, …).

```sql
-- migrations/0002_ordini_fornitori_righe.sql
CREATE TABLE ordini_fornitori_righe (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	fornitore TEXT NOT NULL,
	importo REAL NOT NULL
);
```

Applicala in locale:

```bash
npm run db:migrate:local
```

In produzione la migrazione si applica al deploy (vedi `deploy-dashboard`).

## Query nel backend

```ts
const { results } = await c.env.DB
	.prepare("SELECT * FROM ordini_fornitori_righe WHERE fornitore = ?")
	.bind(fornitore)
	.all();
```

Scrittura: `.run()`. Più scritture insieme: `c.env.DB.batch([...])`.

## Dati locali vs produzione

`npm run dev` usa un database locale (cartella `.wrangler/`, non in git): puoi sperimentare senza rischi. I dati di produzione si toccano solo tramite migrazioni e codice rilasciato, mai con comandi `--remote` manuali su `execute`, a meno che l'utente lo chieda esplicitamente.

Se `src/worker` non vede `DB` nei tipi, esegui `npm run cf-typegen`.
