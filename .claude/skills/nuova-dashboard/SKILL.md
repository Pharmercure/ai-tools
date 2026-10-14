---
name: nuova-dashboard
description: Procedura per creare una nuova dashboard (o una nuova pagina/funzione in una esistente) in src/apps/<nome>. Usala quando l'utente chiede una nuova dashboard, tool, report o pagina.
---

# Creare una nuova dashboard

Leggi prima `architettura-dashboard` e `stack-frontend`.

## 1. Chiarisci con l'utente (poche domande, solo se mancano)

- Quale decisione o attività deve supportare la dashboard, e chi la usa? (definisci l'obiettivo)
- Quali dati servono e da dove arrivano? Serve salvarne di nuovi (→ D1)?
- Il nome breve: minuscolo, senza spazi, es. `ordini-fornitori`. Controlla che `src/apps/<nome>` non esista già.

Proponi una prima versione piccola e funzionante, poi si migliora insieme: meglio tempo fisso e perimetro variabile.

## 2. Parti dall'esempio

Copia `src/apps/esempio` in `src/apps/<nome>` e rinomina:

1. `meta.ts` → `title` e `description` chiari (appaiono nell'indice).
2. `web/store.ts` → endpoint RTK Query con `baseUrl: "/api/<nome>"` (lo store è separato per ogni dashboard).
3. `web/index.tsx` → il componente React: `<Provider>` + `<Routes>`, stile con `css`, dati con gli hook RTK Query. Segui `stack-frontend`.
4. `api/index.ts` → rotte Hono. Se la dashboard non ha backend, elimina la cartella `api`.
5. Se servono tabelle: segui `database-d1` (prefisso `<nome>_`). Non lasciare in giro la tabella `esempio_*`: nella copia usa il nuovo prefisso.

Non servono registrazioni altrove: indice e API si aggiornano da soli.

## 3. Verifica

```bash
npm run db:migrate:local   # se hai aggiunto migrazioni
npm run lint && npm run build
npm run dev                # apri http://localhost:5173/<nome> e prova davvero
```

L'indice (`/`) deve mostrare la nuova dashboard. Se qualcosa non va, leggi l'errore, correggi e riprova prima di chiedere aiuto.

## 4. Consegna

Riassumi all'utente cosa è stato creato, dove, e come provarlo. Per pubblicare: skill `deploy-dashboard`.

## Eliminare una dashboard

Cancella `src/apps/<nome>`. Le sue tabelle D1 restano: chiedi all'utente se vanno rimosse con una nuova migrazione (`DROP TABLE`), mai a mano in produzione.
