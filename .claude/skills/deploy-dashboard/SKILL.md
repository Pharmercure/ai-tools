---
name: deploy-dashboard
description: Come pubblicare le dashboard su Cloudflare (deploy unico, migrazioni D1 in produzione, accesso con Cloudflare Access). Usala quando l'utente vuole mettere online o aggiornare le dashboard.
---

# Deploy

Un solo Worker `ai-tools` ospita tutte le dashboard: ogni deploy pubblica tutto il repo. Per questo, prima di pubblicare, il lavoro va condiviso e controllato (pull request), non rilasciato da soli.

## Prima di pubblicare

```bash
npm run lint && npm run check   # tipi, build e prova di deploy senza pubblicare
```

Se qualcosa fallisce, correggi. Non pubblicare con errori noti.

## Pubblicare

Conferma con l'utente (il deploy è visibile a tutti), poi:

```bash
npm run db:migrate   # applica in produzione le nuove migrazioni D1
npm run deploy       # pubblica il Worker
```

Ordine: prima le migrazioni, poi il codice. Le migrazioni devono essere compatibili con la versione precedente (aggiungi colonne/tabelle; evita rinominare o eliminare nello stesso rilascio).

Alla prima volta, wrangler crea da solo il database D1 `ai-tools-db` e aggiorna il binding. Servono login (`npx wrangler login`) e i permessi sull'account Cloudflare: se mancano, chiedi a chi amministra Cloudflare.

## Accesso (Cloudflare Access)

Chi può aprire le dashboard si configura nel pannello Cloudflare (Zero Trust → Access → Applications) sul dominio del Worker, non nel codice. Dashboard con dati sensibili: verificare con chi amministra Cloudflare che la policy sia attiva prima di pubblicarla. Non aggiungere login nel codice.

## Dopo il deploy

Apri `/` e `/<nome>/` in produzione e verifica che l'indice e la dashboard funzionino. Comunica agli utenti cosa è cambiato.
