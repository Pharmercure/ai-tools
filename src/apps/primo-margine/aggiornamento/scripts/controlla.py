"""Controlli prima di pubblicare un nuovo api/dati.json.

Confronta il file appena generato con quello pubblicato (ultimo commit) e con le estrazioni grezze.
Esce con codice 1 e stampa i motivi se qualcosa non torna: in quel caso non si pubblica.
Uso: PHARMERCURE_PRIMO_MARGINE=<cartella dati> python -I scripts/controlla.py
"""
import json, os, subprocess, sys, collections
from pathlib import Path

QUI = Path(__file__).resolve().parents[1]
G = Path(os.environ['PHARMERCURE_PRIMO_MARGINE']).expanduser() / 'grezzi'
problemi, note = [], []

# 1. nessuna estrazione troncata dal connettore
for f in ['ordini.json', 'costi_caricati.json', 'anagrafiche.json', 'fatture_prima_di_marzo.json', 'fatture_non_su_fic.json']:
    try:
        d = json.load(open(G / f, encoding='utf-8'))
    except Exception as e:
        problemi.append(f'{f}: non leggibile ({e})')
        continue
    if d.get('appliedLimits'):
        problemi.append(f'{f}: risultato troncato dal connettore ({d["appliedLimits"]})')
    if not d.get('documents'):
        problemi.append(f'{f}: nessun documento')
for f in ['emesse.json', 'nc.json']:
    try:
        d = json.load(open(G / f, encoding='utf-8'))
        if d.get('righe') != d.get('id_distinti'):
            problemi.append(f'{f}: righe e id distinti diversi, estrazione FIC da rifare')
    except Exception as e:
        problemi.append(f'{f}: non leggibile ({e})')


def totali(d):
    I = {c: i for i, c in enumerate(d['colonne_righe'])}
    t = collections.defaultdict(lambda: [0.0, 0.0, 0])
    for r in d['righe']:
        m = d['mesi'][r[0]]
        t[m][0] += sum(r[I['r_' + c]] for c in d['componenti'])
        t[m][1] += r[I['c_effettivo']] + r[I['c_ordine']] + r[I['c_listino']]
        t[m][2] += r[I['consegne']]
    return t


nuovo = json.load(open(QUI.parent / 'api' / 'dati.json', encoding='utf-8'))
try:
    vecchio = json.loads(subprocess.run(['git', 'show', 'HEAD:src/apps/primo-margine/api/dati.json'], cwd=QUI, capture_output=True, check=True).stdout.decode('utf-8'))
except Exception:
    vecchio = None
    note.append('nessuna versione pubblicata da confrontare')

tn = totali(nuovo)
if vecchio:
    tv = totali(vecchio)
    if len(nuovo['righe']) < 0.9 * len(vecchio['righe']):
        problemi.append(f"righe scese da {len(vecchio['righe'])} a {len(nuovo['righe'])}")
    for m in sorted(tv):
        if m not in tn:
            problemi.append(f'mese {m} sparito')
            continue
        # i mesi chiusi da almeno due mesi non dovrebbero cambiare molto
        chiuso_da_tempo = m < nuovo['ultimo_chiuso'][:5] + f"{int(nuovo['ultimo_chiuso'][5:]) - 1:02d}" if int(nuovo['ultimo_chiuso'][5:]) > 1 else False
        for i, nome in ((0, 'ricavo'), (1, 'costo'), (2, 'consegne')):
            a, b = tv[m][i], tn[m][i]
            if a and abs(b - a) / abs(a) > (0.03 if chiuso_da_tempo else 0.25):
                (problemi if chiuso_da_tempo else note).append(f'{m} {nome}: da {a:,.0f} a {b:,.0f}')

print('Totali per mese (ricavo, costo, consegne):')
for m in sorted(tn):
    r, c, n = tn[m]
    print(f'  {m}: {r:>10,.0f} {c:>10,.0f} {n:>7,}  margine {((r - c) / r * 100) if r else 0:5.1f}%')
for x in note:
    print('NOTA:', x)
if problemi:
    print('NON PUBBLICARE:')
    for x in problemi:
        print('  -', x)
    sys.exit(1)
print('Controlli superati.')
