# primo-margine: aggiornamento dei dati

> Migrata nel monorepo ai-tools: la dashboard è in `../web`, i dati in `../api/dati.json` (servito su `/api/primo-margine/dati`). Questa cartella contiene solo gli script e le estrazioni per rigenerare i dati.

Dashboard del primo margine di Pharmercure: ricavi pagati dalle farmacie meno il costo logistico delle loro consegne, da marzo 2026, per mese, città, farmacia, fornitore, categoria e gruppo. I costi commerciali (provvigioni) non sono ancora inclusi.

Referente: Gianluca Abate (Gianni).

## Cosa c'è nella cartella

| File | Cosa fa |
|---|---|
| `../api/dati.json` | i dati della dashboard, rigenerati a ogni aggiornamento. Contiene nomi di farmacie e fornitori, ricavi e costi: è un dato interno |
| `estrazioni/*.json` | le cinque letture da MongoDB (collection, pipeline e nome del file in cui salvare il risultato). `__A__` va sostituito con la mezzanotte italiana di oggi in UTC |
| `scripts/costruisci.py` | dalle estrazioni costruisce la base: una riga per mese, farmacia e fornitore |
| `scripts/esporta_dashboard.py` | dalla base scrive `../api/dati.json` |
| `scripts/controlla.py` | controlli prima di pubblicare: estrazioni non troncate, mesi chiusi che non cambiano più del 3%, righe che non spariscono. Se fallisce non si pubblica |
| `scripts/sintesi.py` | stampa le tabelle di sintesi (per mese, categoria, interni ed esterni, città), utile per i controlli |

## Come si calcola

Le regole sono scritte anche nella pagina, sotto "Come si calcola". In breve:

- **Ricavo**: imponibile di fatture emesse e note di credito di Fatture in Cloud, ripartito per giorni sui mesi del periodo fatturato. Più le fatture del database emesse prima di marzo 2026 (Fatture in Cloud non ha storico prima) e quelle create nel database ma non ancora inviate. Dove una farmacia non ha un canone fatturato nel mese, si usa il prezzo dei blocchi del contratto, come voce a parte che si può escludere. Esclusi Blue Health Center e i ricavi che non vengono da farmacie.
- **Gruppi fatturati come gruppo**: il canone si divide in parti uguali fra le farmacie del gruppo con un contratto in corso nel mese.
- **Costo**: costo effettivo caricato nel backadmin (`DeliveryAgencyInvoice`), diviso fra le farmacie del fornitore in proporzione alle consegne del mese. Dove manca, il costo scritto sull'ordine, poi il listino del fornitore. Altrimenti la consegna resta senza costo, contata e mai stimata.
- **Fornitore**: il ricavo di una farmacia nel mese si divide fra i fornitori che l'hanno servita, in proporzione alle consegne.

Decisioni di Gianni del 12/10/2026 (voci del ricavo, ripartizione per giorni, attribuzione ai fornitori) e del 13/10/2026 (costo azienda dei corrieri interni visibile, D-2026-10-13-01 nella KB).

## Come si aggiorna

Una volta a settimana, il lunedì mattina, con il task programmato di Claude `aggiorna-primo-margine` sul computer del referente (decisione di Gianni del 13/10/2026). Le estrazioni da MongoDB passano dal connettore MongoDB Atlas di Claude, quelle da Fatture in Cloud dalla skill `fic-persista`, per questo il task gira lì:

1. esegue le cinque pipeline di `estrazioni/` con `aggregate` (progetto `6278dbaf2c05f61a5b134463`, cluster `pmc-prod`, database `Pharmercure`), con `__A__` sostituito dalla mezzanotte italiana di oggi in UTC, e salva ogni risultato in `$PHARMERCURE_PRIMO_MARGINE/grezzi/<file>`;
2. scarica da Fatture in Cloud fatture emesse e note di credito da marzo 2026 a oggi (`fic.py pull emesse` e `pull notecredito-emesse`) in `grezzi/emesse.json` e `grezzi/nc.json`;
3. lancia `scripts/costruisci.py` e `scripts/esporta_dashboard.py`, e confronta i totali con la versione precedente;
4. committa e pubblica solo `src/apps/primo-margine/api/dati.json`: il push fa partire il deploy. Le modifiche al codice della dashboard passano invece dal referente.

La variabile `PHARMERCURE_PRIMO_MARGINE` punta alla cartella dei dati grezzi, fuori dal repo perché contiene anagrafiche e fatture complete.

## Vederla in locale e pubblicare

Dalla radice: `npm run dev` e apri `/primo-margine/`. Si pubblica come tutte le dashboard (skill `deploy-dashboard`).
