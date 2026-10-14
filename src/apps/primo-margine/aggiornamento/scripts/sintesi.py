"""Tabelle di sintesi del primo margine dalla base dati (output/base_primo_margine.json).

Uso: PHARMERCURE_PRIMO_MARGINE=<cartella dati> python -I scripts/sintesi.py [mese_ultimo_chiuso]
Scrive output/sintesi.json e stampa le tabelle. I mesi dopo l'ultimo chiuso si mostrano solo
per consegne e farmacie, non per il margine (costi non ancora caricati).
"""
import json, sys, collections
import os
from pathlib import Path

BASE = Path(os.environ['PHARMERCURE_PRIMO_MARGINE']).expanduser()
ULTIMO_CHIUSO = sys.argv[1] if len(sys.argv) > 1 else '2026-09'
b = json.load(open(BASE / 'output' / 'base_primo_margine.json', encoding='utf-8'))
F, A = b['farmacie'], b['fornitori']
RIC = lambda r: sum(v for k, v in r.items() if k.startswith('r_'))
COS = lambda r: r.get('c_effettivo', 0) + r.get('c_ordine', 0) + r.get('c_listino', 0)


def vuoto():
    return collections.defaultdict(float)


def aggrega(chiave):
    out = collections.defaultdict(vuoto)
    farm = collections.defaultdict(set)
    for r in b['righe']:
        k = chiave(r)
        if k is None:
            continue
        t = out[k]
        t['ricavo'] += RIC(r)
        t['costo'] += COS(r)
        t['consegne'] += r.get('consegne', 0)
        t['senza_costo'] += r.get('cons_senza_costo', 0)
        t['costo_effettivo'] += r.get('c_effettivo', 0)
        for k2, v in r.items():
            if k2.startswith('r_'):
                t[k2] += v
        if RIC(r) > 0 or r.get('consegne'):
            farm[k].add(r['farmacia'])
    for k, t in out.items():
        t['farmacie'] = len(farm[k])
        t['margine'] = t['ricavo'] - t['costo']
        t['margine_pct'] = t['margine'] / t['ricavo'] if t['ricavo'] else None
        t['ricavo_per_consegna'] = t['ricavo'] / t['consegne'] if t['consegne'] else None
        t['costo_per_consegna'] = t['costo'] / t['consegne'] if t['consegne'] else None
    return out


per_mese = aggrega(lambda r: r['mese'])
for x in b['costo_senza_consegne']:  # costo di fornitori senza consegne nel mese: sta nel totale del mese
    t = per_mese[x['mese']]
    t['costo'] += x['c_effettivo']
    t['margine'] = t['ricavo'] - t['costo']
    t['margine_pct'] = t['margine'] / t['ricavo'] if t['ricavo'] else None
    t['costo_per_consegna'] = t['costo'] / t['consegne'] if t['consegne'] else None

chiusi = lambda r: r['mese'] <= ULTIMO_CHIUSO
per_categoria = aggrega(lambda r: (r['mese'], F[r['farmacia']]['categoria']) if chiusi(r) else None)
per_citta = aggrega(lambda r: F[r['farmacia']]['citta'] if chiusi(r) else None)
per_tipo_fornitore = aggrega(lambda r: (r['mese'], 'interni' if A.get(r['fornitore'], {}).get('interno') else 'esterni') if chiusi(r) else None)
periodo = aggrega(lambda r: 'mar-' + ULTIMO_CHIUSO if chiusi(r) else None)
for x in b['costo_senza_consegne']:
    if x['mese'] <= ULTIMO_CHIUSO:
        t = periodo['mar-' + ULTIMO_CHIUSO]
        t['costo'] += x['c_effettivo']
        t['margine'] = t['ricavo'] - t['costo']
        t['margine_pct'] = t['margine'] / t['ricavo']
        t['costo_per_consegna'] = t['costo'] / t['consegne']

sint = dict(meta=b['meta'] | {'ultimo_chiuso': ULTIMO_CHIUSO},
            per_mese={k: dict(v) for k, v in sorted(per_mese.items())},
            periodo={k: dict(v) for k, v in periodo.items()},
            per_categoria={f'{k[0]}|{k[1]}': dict(v) for k, v in sorted(per_categoria.items())},
            per_tipo_fornitore={f'{k[0]}|{k[1]}': dict(v) for k, v in sorted(per_tipo_fornitore.items())},
            per_citta={k: dict(v) for k, v in sorted(per_citta.items(), key=lambda x: -x[1]['ricavo'])},
            non_attribuito=b['non_attribuito'])
json.dump(sint, open(BASE / 'output' / 'sintesi.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def riga(nome, t):
    pct = f"{t['margine_pct'] * 100:.1f}%" if t.get('margine_pct') is not None else '-'
    rpc = f"{t['ricavo_per_consegna']:.2f}" if t.get('ricavo_per_consegna') else '-'
    cpc = f"{t['costo_per_consegna']:.2f}" if t.get('costo_per_consegna') else '-'
    print(f"{nome:<34}{t['farmacie']:>6}{t['consegne']:>8.0f}{t['ricavo']:>10.0f}{t['costo']:>10.0f}{t['margine']:>10.0f}{pct:>8}{rpc:>8}{cpc:>8}{t['senza_costo']:>6.0f}")


print(f"{'':<34}{'farm':>6}{'cons':>8}{'ricavo':>10}{'costo':>10}{'margine':>10}{'marg%':>8}{'r/cons':>8}{'c/cons':>8}{'s.c.':>6}")
for k, t in sorted(per_mese.items()):
    riga(k + (' (parziale)' if k > ULTIMO_CHIUSO else ''), t)
for k, t in periodo.items():
    riga('TOTALE ' + k, t)
print('\nper categoria')
for k, t in sorted(per_categoria.items(), key=lambda x: (x[0][1], x[0][0])):
    riga(f'{k[1][:22]} {k[0]}', t)
print('\nper tipo di fornitore')
for k, t in sorted(per_tipo_fornitore.items(), key=lambda x: (x[0][1], x[0][0])):
    riga(f'{k[1]} {k[0]}', t)
print('\nprime 15 citta per ricavo, mar-' + ULTIMO_CHIUSO)
for k, t in list(sorted(per_citta.items(), key=lambda x: -x[1]['ricavo']))[:15]:
    riga(k[:34], t)
print('citta totali', len(per_citta))
