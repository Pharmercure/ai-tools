"""Scrive api/dati.json, il file che la dashboard legge, dalla base costruita da costruisci.py.

Formato compatto: dimensioni in elenchi, righe come array di numeri con indici nelle dimensioni.
Uso: PHARMERCURE_PRIMO_MARGINE=<cartella dati> python -I scripts/esporta_dashboard.py [ultimo_mese_chiuso]
Senza argomento l'ultimo mese chiuso e' il mese prima di quello in corso.
"""
import json, os, sys, datetime as dt
from pathlib import Path

QUI = Path(__file__).resolve().parents[1]
BASE = Path(os.environ['PHARMERCURE_PRIMO_MARGINE']).expanduser()
b = json.load(open(BASE / 'output' / 'base_primo_margine.json', encoding='utf-8'))

oggi = dt.date.today()
primo = oggi.replace(day=1) - dt.timedelta(days=1)
ULTIMO_CHIUSO = sys.argv[1] if len(sys.argv) > 1 else f'{primo.year:04d}-{primo.month:02d}'

COMPONENTI = ['canone', 'canone_da_contratto', 'extra', 'attivazione', 'consegne_a_consumo', 'ritiro_ricetta',
              'commissioni_pos', 'oneri_sepa', 'ecommerce', 'consegna_cliente_webapp', 'altro']
mesi = sorted({r['mese'] for r in b['righe']})
farm_ids = sorted(b['farmacie'])
forn_ids = sorted(b['fornitori'])
fi = {x: i for i, x in enumerate(farm_ids)}
ai = {x: i for i, x in enumerate(forn_ids)}
mi = {x: i for i, x in enumerate(mesi)}
r2 = lambda x: round(x or 0, 2)

righe = []
for r in b['righe']:
    righe.append([mi[r['mese']], fi[r['farmacia']], ai[r['fornitore']]]
                 + [r2(r.get('r_' + c)) for c in COMPONENTI]
                 + [r.get('consegne', 0), r2(r.get('c_effettivo')), r2(r.get('c_ordine')), r2(r.get('c_listino')),
                    r.get('cons_effettivo', 0), r.get('cons_ordine', 0), r.get('cons_listino', 0), r.get('cons_senza_costo', 0), r.get('coin', 0)])
senza_consegne = [[mi[x['mese']], ai[x['fornitore']], r2(x['c_effettivo'])] for x in b['costo_senza_consegne'] if x['mese'] in mi]

dati = dict(
    estratto=b['meta']['generato'],
    ultimo_chiuso=ULTIMO_CHIUSO,
    fonti=b['meta']['fonti'],
    mesi=mesi,
    componenti=COMPONENTI,
    colonne_righe=['mese', 'farmacia', 'fornitore'] + ['r_' + c for c in COMPONENTI]
                  + ['consegne', 'c_effettivo', 'c_ordine', 'c_listino', 'cons_effettivo', 'cons_ordine', 'cons_listino', 'cons_senza_costo', 'coin'],
    farmacie=[[b['farmacie'][p]['nome'], b['farmacie'][p]['citta'], b['farmacie'][p]['provincia'],
               b['farmacie'][p]['gruppo'] or '', b['farmacie'][p]['categoria']] for p in farm_ids],
    fornitori=[[b['fornitori'][a]['nome'], 1 if b['fornitori'][a]['interno'] else 0, b['fornitori'][a]['citta']] for a in forn_ids],
    righe=righe,
    costo_senza_consegne=senza_consegne,
    non_attribuito={m: round(sum(v.values()), 2) for m, v in b['non_attribuito'].items() if m in mi},
)
dest = QUI.parent / 'api' / 'dati.json'
json.dump(dati, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{dest} scritto: {len(righe)} righe, {len(farm_ids)} farmacie, {len(forn_ids)} fornitori, mesi {mesi[0]}-{mesi[-1]}, ultimo chiuso {ULTIMO_CHIUSO}, {dest.stat().st_size // 1024} KB')
