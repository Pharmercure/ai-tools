# supplier-invoices

Verifica mensile delle fatture dei fornitori esterni di consegne. Per la gestione operativa (CS) e la logistica:
per ogni fornitore e mese, previsto, fatturato e differenza; la coda degli scostamenti da verificare, con
verdetto, chi controlla e nota; gli accordi commerciali (cosa prevediamo noi, cosa applica il fornitore,
cosa va contestato o chiarito) per il responsabile dei rapporti con i fornitori; il contatore dei tagliandi UBM Bologna. Sostituisce il Controllo Mensile
Fornitori su Firebase. Referente: Gianluca Abate.

Il procedimento è nella KB, pagina "Verifica mensile delle fatture dei fornitori esterni".

## Come funziona

1. I numeri li calcola la routine di verifica (task programmati di Claude sul computer del referente):
   previsto dal DB di produzione con le regole del Registro Accordi e le note degli ordini, fatture da
   Fatture in Cloud, scostamenti isolati con il dettaglio del fornitore. Il calcolo resta fuori dal
   Worker perché le regole sono ancora in revisione e alcune voci si leggono dalle note libere.
2. La routine produce `month-AAAA-MM.json`, `ubm.json` e `agreements.json` (formato in `api/types.ts`) e il referente li
   carica dalla scheda "Carica dati" (`POST /api/supplier-invoices/import`).
3. Ogni caricamento aggiunge una fotografia in `supplier_invoices_snapshots`; la pagina mostra la più
   recente. Le righe della coda (`supplier_invoices_queue`) nuove entrano con il verdetto della routine;
   per quelle già presenti cambiano solo descrizione, consegne e importo, mai verdetto, chi e nota.
4. Verdetto, chi e nota li cambia chiunque abbia accesso (`PATCH /api/supplier-invoices/queue/:id`).
   Ogni modifica va in `supplier_invoices_queue_log` con l'email di chi l'ha fatta.
5. Il "costo da caricare" di un fornitore è "pronto" solo se la fattura c'è e nessuna sua riga del mese
   è ancora "Da verificare" o "Serve il dettaglio" (regola della KB).

## Rotte

| Metodo | Rotta | Cosa fa |
| --- | --- | --- |
| GET | `/me` | email di chi guarda e se può caricare dati |
| GET | `/months`, `/months/:mese` | mesi caricati; dettaglio di un mese con la sua coda |
| GET | `/queue` (`?open=1`) | coda di tutti i mesi |
| PATCH | `/queue/:id` | verdetto, chi, nota |
| GET | `/queue/:id/log` | storico delle modifiche di una riga |
| GET | `/ubm` | ultimo caricamento dei tagliandi UBM |
| GET | `/agreements` | ultimo caricamento degli accordi commerciali |
| POST | `/import` | caricamento di un mese o di UBM (solo il referente) |

## Da sapere

- L'email di chi lavora viene dall'intestazione `Cf-Access-Authenticated-User-Email` che aggiunge
  Cloudflare Access. Il caricamento è riservato al referente con un elenco in `api/index.ts`.
- In locale Access non c'è: per provare come referente metti `DEV_USER_EMAIL=<email>` in `.dev.vars`
  (ignorato da git). In produzione la variabile non esiste e conta solo l'intestazione di Access.
- Nei dati non entrano indirizzi o nomi di clienti finali: la coda riporta codici ordine e date, la
  sezione UBM solo totali per giorno, mese e farmacia.
- Nessun secret: la dashboard non legge MongoDB né Fatture in Cloud.
