---
name: architettura-dashboard
description: Come è organizzato il monorepo delle dashboard (cartelle, convenzioni, cosa non toccare). Da leggere prima di qualsiasi modifica al repo, anche piccola, e ogni volta che si crea, modifica o elimina una dashboard.
---

# Architettura del monorepo

Chi usa questo repo spesso non programma: spiega le cose in italiano semplice, lavora in autonomia sulla propria dashboard e non toccare ciò che appartiene ad altri.

## Mappa

```
src/apps/<nome>/            ← UNA cartella per dashboard (nome minuscolo, trattini: es. "pharmacy-sales")
  meta.ts               ← titolo e descrizione mostrati nell'indice
  web/index.tsx         ← frontend React, export default del componente (Provider Redux + Routes)
  web/store.ts          ← RTK Query: chiamate a /api/<nome> e store della dashboard
  api/index.ts          ← backend Hono, export default dell'app Hono (opzionale)
migrations/             ← migrazioni D1 di TUTTE le dashboard (vedi skill database-d1)
src/shell/              ← pagina indice + caricamento dashboard (condiviso, non toccare)
src/worker/index.ts     ← monta le API (condiviso, non toccare)
wrangler.json           ← config Cloudflare (condiviso)
```

## Come funziona (nessuna registrazione manuale)

- Un solo Worker Cloudflare serve tutto.
- La dashboard `<nome>` è raggiunta su `/<nome>/`; l'indice su `/`.
- `src/shell/main.tsx` scopre da solo `src/apps/*/meta.ts` e `src/apps/*/web/index.tsx`.
- `src/worker/index.ts` scopre da solo `src/apps/*/api/index.ts` e lo monta su `/api/<nome>/...`.
- Database: un solo D1 (binding `DB`). Le tabelle di una dashboard iniziano con `<nome>_` (con `_` al posto dei `-`).
- Accesso: gestito da Cloudflare Access davanti al Worker. Nessun codice di login nelle dashboard.

## Regole

1. Una dashboard vive solo in `src/apps/<nome>/` (più i suoi file in `migrations/`). Non importare file da un'altra dashboard.
2. Il frontend chiama solo `/api/<nome>/...`, mai API di altre dashboard.
3. Le tabelle di altre dashboard non si leggono né si modificano.
4. Niente segreti nel codice. Chiavi e token vanno nei secrets Cloudflare (`wrangler secret put`), mai in git.
5. Non modificare `src/shell`, `src/worker`, `wrangler.json`, tsconfig senza una ragione chiara: sono condivisi da tutte le dashboard. Se serve, dillo all'utente e chiedi conferma.
6. Nuovi pacchetti npm: solo se servono davvero e dopo aver avvisato l'utente (sono condivisi da tutti).
7. Frontend: solo Emotion, React Router e Redux Toolkit/RTK Query, come da skill `stack-frontend`.
8. Prima di dire "fatto" esegui `npm run build` e `npm run lint`.
9. Nomenclatura in inglese: nomi di file, cartelle, dashboard, variabili, funzioni, tipi, tabelle e colonne D1, branch e messaggi di commit sono sempre in inglese (es. `supplier-orders`, `getSalesByMonth`). Solo i testi mostrati agli utenti (titoli, etichette, messaggi in pagina) restano in italiano.

## Sviluppo locale

```bash
npm install
npm run db:migrate:local   # una volta, e dopo ogni nuova migrazione
npm run dev                # http://localhost:5173
```

Skill collegate: `stack-frontend`, `nuova-dashboard`, `database-d1`, `deploy-dashboard`.
