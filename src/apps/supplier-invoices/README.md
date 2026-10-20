# supplier-invoices

Verifica mensile delle fatture dei fornitori esterni di consegne. Serve a pagare il giusto e a saperlo prima.
Lo usa soprattutto il responsabile dei rapporti con i fornitori. La gestione operativa (CS) interviene quando lui
chiede supporto; l'amministrazione e il referente seguono i costi. Sostituisce il Controllo Mensile Fornitori su
Firebase. Referente: Gianluca Abate.

Per ogni fornitore e mese la dashboard mostra:
- previsto, fatturato e differenza;
- gli scostamenti da decidere;
- gli accordi commerciali e i punti aperti;
- il costo effettivo, dalla conferma all'inserimento nel backadmin;
- per UBM Bologna, i tagliandi.

Il procedimento è nella KB, pagina "Verifica mensile delle fatture dei fornitori esterni".

## Le pagine

- **Da fare** (pagina iniziale). Mostra cosa tocca a ciascun ruolo; il ruolo scelto lo ricorda il browser.
  In testa c'è un riepilogo a colpo d'occhio, sotto il dettaglio:
  - il responsabile fornitori vede cosa c'è da decidere, fornitore per fornitore, e i costi da confermare;
  - la gestione operativa vede solo le righe per cui il responsabile ha chiesto supporto;
  - l'amministrazione vede a che punto sono i costi del mese;
  - il referente vede i costi confermati da inserire nel backadmin e l'avanzamento del mese.
- **Mese**: i fornitori raggruppati per stato del costo.
- **Fornitori**: l'elenco dei fornitori, poi una pagina per ciascuno con il mese e il costo effettivo, cosa
  decidere, l'accordo, i tagliandi (solo UBM) e lo storico delle decisioni.
- **Come funziona**: scopo, ruoli, verdetti e regola del costo, per chi apre lo strumento la prima volta.
- **Carica dati**: solo per il referente.

Il ragionamento dietro questa struttura è in `PIANO-UX.md`, nella cartella di lavoro del referente.

## Come funziona

1. **Il calcolo.** I numeri li calcola la routine di verifica, cioè i task programmati di Claude:
   - il previsto dal DB di produzione, con le regole del Registro Accordi e le note degli ordini;
   - le fatture da Fatture in Cloud;
   - gli scostamenti, isolati con il dettaglio del fornitore.

   Il calcolo resta fuori dal Worker perché le regole sono ancora in revisione e alcune voci si leggono
   dalle note libere degli ordini.
2. **Il caricamento.** La routine produce `month-AAAA-MM.json`, `ubm.json` e `agreements.json` (formato in
   `api/types.ts`) e li carica con `POST /api/supplier-invoices/import`.
3. **Le fotografie.** Ogni caricamento aggiunge una fotografia in `supplier_invoices_snapshots` e la pagina
   mostra la più recente. Le righe nuove della coda (`supplier_invoices_queue`) entrano con il verdetto
   della routine. Di quelle già presenti cambiano solo descrizione, consegne e importo, mai verdetto, chi
   e nota.
4. **Le modifiche delle persone.** Verdetto, chi e nota li cambia chiunque abbia accesso
   (`PATCH /queue/:id`). Ogni modifica va in `supplier_invoices_log`, con l'email di chi l'ha fatta.
5. **Gli accordi.** Ogni differenza fra il nostro accordo e quello che applica il fornitore è un punto in
   `supplier_invoices_agreement_items`. La pagina descrive il problema con i fatti, quanto vale e la
   domanda aperta, senza indicare la soluzione: la trova il responsabile fornitori. Un punto si chiude solo
   con un esito scritto, che è la regola da riportare nel Registro Accordi.
6. **Il costo effettivo** (`supplier_invoices_costs`) segue questi stati:

   | Stato | Valore | Quando |
   | --- | --- | --- |
   | Fattura non arrivata | `no_invoice` | la fattura del mese non c'è ancora |
   | Resta il previsto | `expected_only` | ci sono scostamenti ancora aperti |
   | Da confermare | `to_confirm` | la fattura torna, o gli scostamenti sono tutti decisi |
   | Confermato | `confirmed` | il responsabile fornitori ha confermato l'importo |
   | Inserito | `loaded` | il costo è stato inserito nel backadmin |

   - Il responsabile conferma l'importo, di norma l'imponibile. Se è diverso dalla fattura, la nota è obbligatoria.
   - Chi inserisce il costo nel backadmin lo segna come inserito.
   - Ogni passaggio va nello storico.

I valori salvati sono in inglese:
- verdetti: `to_check`, `needs_detail`, `dispute`, `invoice_correct`, `ignored`;
- chi ha in mano la riga: `supplier_owner`, `operations`;
- stato di un punto: `open`, `in_discussion`, `closed`.

Le etichette in pagina sono in `web/format.ts` e `web/agreements.tsx`.

## Rotte

| Metodo | Rotta | Cosa fa |
| --- | --- | --- |
| GET | `/me` | email di chi guarda e se può caricare dati |
| GET | `/months`, `/months/:month` | mesi caricati; dettaglio di un mese con coda e stato dei costi |
| GET | `/queue` (`?open=1`) | coda di tutti i mesi |
| PATCH | `/queue/:id` | verdetto, chi, nota |
| GET | `/queue/:id/log` | storico delle modifiche di una riga |
| GET | `/ubm` | ultimo caricamento dei tagliandi UBM |
| GET | `/agreements` | ultimo caricamento degli accordi, con stato ed esito di ogni punto |
| PATCH | `/agreements/items/:id` | stato ed esito di un punto |
| GET | `/agreements/items/:id/log` | storico di un punto |
| GET | `/agreements/outcomes` | punti chiusi con l'esito, da riportare nel Registro Accordi |
| POST | `/costs/:month` | ciclo del costo: `confirm` (con importo e nota), `unconfirm`, `loaded`, `unloaded` |
| GET | `/costs/:month/log?supplier=` | storico del costo di un fornitore nel mese |
| POST | `/import` | caricamento di un mese, di UBM o degli accordi (solo il referente) |

## Da sapere

- **Chi è l'utente.** L'email di chi lavora viene dall'intestazione `Cf-Access-Authenticated-User-Email`, che
  aggiunge Cloudflare Access.
- **Chi può caricare i dati.** Per ora è un elenco scritto in `api/index.ts`. Va concordato con chi
  amministra Cloudflare come gestirlo: la routine avrà bisogno di un accesso suo.
- **Sviluppo locale.** In locale Access non c'è: per provare come referente metti
  `DEV_USER_EMAIL=<email>` in `.dev.vars` (ignorato da git). In produzione la variabile non esiste e conta
  solo l'intestazione di Access.
- **Link interni.** Partono dall'indirizzo che il router ricava nella rotta di layout (`web/links.ts`): il
  nome della dashboard non è scritto nel codice.
- **Dati personali.** Nei dati non entrano indirizzi o nomi di clienti finali: la coda riporta codici
  ordine e date, la sezione UBM solo totali per giorno, mese e farmacia.
- **Nessun secret.** La dashboard non legge MongoDB né Fatture in Cloud.
