# supplier-invoices

Verifica mensile delle fatture dei fornitori esterni di consegne. Per la gestione operativa (CS) e la logistica:
per ogni fornitore e mese, previsto, fatturato e differenza; la coda degli scostamenti da verificare, con
verdetto, chi controlla e nota; gli accordi commerciali (cosa prevede il nostro accordo, cosa applica il fornitore,
dove non coincidono e con quale esito) per il responsabile dei rapporti con i fornitori; il contatore dei tagliandi UBM Bologna. Sostituisce il Controllo Mensile
Fornitori su Firebase. Referente: Gianluca Abate.

Il procedimento è nella KB, pagina "Verifica mensile delle fatture dei fornitori esterni".

## Le pagine

- **Da fare** (pagina iniziale), filtrata per ruolo, che il browser ricorda:
  - il responsabile fornitori vede tutto quello che c'è da decidere, raggruppato per fornitore;
  - la gestione operativa vede solo le righe per cui il responsabile ha chiesto supporto;
  - l'amministrazione vede i costi effettivi da caricare e le fatture che aspettiamo;
  - il referente vede tutto.
- **Mese**: lo stato del mese e i fornitori raggruppati in da decidere, pronti e in attesa della fattura.
- **Fornitori**: l'elenco, poi la pagina di ogni fornitore con il mese, cosa decidere, l'accordo, i
  tagliandi (UBM) e lo storico delle decisioni.
- **Come funziona**: scopo, ruoli, verdetti e regola del costo, per chi apre lo strumento la prima volta.

Il ragionamento dietro questa struttura è in `PIANO-UX.md` della cartella di lavoro del referente.

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
   Ogni modifica va in `supplier_invoices_log` con l'email di chi l'ha fatta.
5. Ogni differenza fra il nostro accordo e quello che applica il fornitore è un punto in
   `supplier_invoices_agreement_items`. La pagina descrive il problema con i fatti, quanto vale e la
   domanda aperta, senza indicare la soluzione: la trova il responsabile dei rapporti con i fornitori,
   che scrive l'esito e chiude il punto. Un punto si chiude solo con un esito, che è la regola da
   riportare nel Registro Accordi.
6. Il "costo da caricare" di un fornitore è "pronto" solo se la fattura c'è e nessuna sua riga del mese
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
| GET | `/agreements` | ultimo caricamento degli accordi, con stato ed esito di ogni punto |
| PATCH | `/agreements/items/:id` | stato (aperto, in discussione, chiuso) ed esito di un punto |
| GET | `/agreements/items/:id/log` | storico di un punto |
| GET | `/agreements/outcomes` | punti chiusi con l'esito, da riportare nel Registro Accordi |
| POST | `/import` | caricamento di un mese o di UBM (solo il referente) |

## Da sapere

- L'email di chi lavora viene dall'intestazione `Cf-Access-Authenticated-User-Email` che aggiunge
  Cloudflare Access. Il caricamento è riservato al referente con un elenco in `api/index.ts`.
- In locale Access non c'è: per provare come referente metti `DEV_USER_EMAIL=<email>` in `.dev.vars`
  (ignorato da git). In produzione la variabile non esiste e conta solo l'intestazione di Access.
- Nei dati non entrano indirizzi o nomi di clienti finali: la coda riporta codici ordine e date, la
  sezione UBM solo totali per giorno, mese e farmacia.
- Nessun secret: la dashboard non legge MongoDB né Fatture in Cloud.
