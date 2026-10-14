"""Costruisce la base dati del primo margine: una riga per mese x farmacia x fornitore.

Ricavi: fatture emesse e note di credito di Fatture in Cloud (imponibile di riga), piu' le
fatture del DB emesse prima di marzo 2026 il cui periodo arriva dopo marzo. Ogni riga e'
ripartita per giorni sui mesi del suo periodo (decisione di Gianluca del 12/10/2026).
Le righe di un gruppo fatturato come gruppo si dividono in parti uguali fra le farmacie del
gruppo con un contratto in corso nel mese.

Costi: costo effettivo caricato nel backadmin (DeliveryAgencyInvoice) per fornitore e mese,
diviso fra le farmacie in proporzione alle consegne; dove manca, costo scritto sull'ordine;
poi listino del fornitore esterno; altrimenti mancante (contato, mai stimato).

Ricavo della farmacia nel mese diviso fra i fornitori in proporzione alle consegne del mese
(decisione di Gianluca del 12/10/2026).

Uso: PHARMERCURE_PRIMO_MARGINE=<cartella dati> python -I scripts/costruisci.py
"""
import json, re, sys, collections, datetime as dt
from pathlib import Path

import os

# I dati grezzi (estrazioni da MongoDB e da Fatture in Cloud) contengono anagrafiche e restano
# fuori dal repo: la cartella arriva dalla variabile d'ambiente PHARMERCURE_PRIMO_MARGINE.
_cartella = os.environ.get('PHARMERCURE_PRIMO_MARGINE')
if not _cartella:
    sys.exit('Manca la variabile PHARMERCURE_PRIMO_MARGINE: deve puntare alla cartella che contiene '
             'grezzi/ con le estrazioni (vedi README). Esempio: export PHARMERCURE_PRIMO_MARGINE=~/pharmercure-output/primo-margine')
BASE = Path(_cartella).expanduser()
G = BASE / 'grezzi'
OUT = BASE / 'output'
OUT.mkdir(exist_ok=True)
MESE_INIZIO = '2026-03'
OGGI = dt.date.today()

GRUPPO_DRMAX = '68e77069bf13a54e2b1c6939'
GRUPPO_HIPPO = '68d68e7dc57d5d17ed527d1a'
GRUPPO_FI = '68385ba685464847ec67b9e5'
# piccoli gruppi dello stesso titolare senza PharmaciesGroup (regole-business pmc-mongodb)
PSEUDO_GRUPPI = {
    'm:cannata': ['61267327f93bca9bba16bd19', '61cc35170654f678c09f009d', '6703bc174d55c9d1c96d02eb'],
    'm:villaggio': ['6915bbe9fe4bec6852d2ff5f', '6915b9fbfe4bec6852d2f31d'],
}
ESCLUSI_RICAVO = ['BLUE HEALTH CENTER']  # decisione di Gianluca del 12/10/2026


def j(nome):
    return json.load(open(G / nome, encoding='utf-8'))


def data(x):
    if x is None:
        return None
    if isinstance(x, dict):
        x = x['$date']
    return dt.datetime.fromisoformat(x.replace('Z', '+00:00'))


def giorno_roma(x):
    """Data di calendario italiana di un istante UTC (CET/CEST approssimato: +2 da fine marzo a fine ottobre)."""
    d = data(x)
    if d is None:
        return None
    off = 2 if (d.month, d.day) >= (3, 29) and (d.month, d.day) < (10, 25) else 1
    return (d + dt.timedelta(hours=off)).date()


def mese(d):
    return f'{d.year:04d}-{d.month:02d}'


def ripartisci(inizio, fine, importo):
    """Ripartisce un importo per giorni sui mesi di calendario fra inizio e fine compresi."""
    if fine < inizio:
        fine = inizio
    giorni = (fine - inizio).days + 1
    out = collections.defaultdict(float)
    d = inizio
    while d <= fine:
        prossimo = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        ultimo = min(fine, prossimo - dt.timedelta(days=1))
        out[mese(d)] += importo * ((ultimo - d).days + 1) / giorni
        d = prossimo
    return out


# ---------------------------------------------------------------- anagrafiche
an = {x['_id']: x['righe'] for x in j('anagrafiche.json')['documents']}
gruppi = {g['id']: g for g in an['gruppi']}
fornitori = {f['id']: f for f in an['fornitori']}
farmacie = {f['id']: f for f in an['farmacie']}
for gid, ids in PSEUDO_GRUPPI.items():
    for p in ids:
        if p in farmacie:
            farmacie[p]['gruppo'] = farmacie[p]['gruppo'] or gid


def gruppo_di(pid):
    f = farmacie.get(pid)
    return f.get('gruppo') if f else None


def categoria(pid):
    g = gruppo_di(pid)
    return {GRUPPO_HIPPO: 'Hippocrates', GRUPPO_DRMAX: 'Dr. Max', GRUPPO_FI: 'Farmacie Italiane'}.get(g, 'Indipendenti e piccoli gruppi')


# contratti: mesi in cui la farmacia ha un contratto in corso
contratto_mesi = collections.defaultdict(set)
for c in an['contratti']:
    a, e = giorno_roma(c['a']), giorno_roma(c['e'])
    if not a or not e:
        continue
    for m in ripartisci(a, e, 1):
        contratto_mesi[c['p']].add(m)

piva_farmacie = collections.defaultdict(list)
for f in farmacie.values():
    if f.get('piva'):
        piva_farmacie[re.sub(r'\D', '', f['piva'])].append(f['id'])

# ------------------------------------------------------------------- consegne
consegne = collections.defaultdict(lambda: collections.Counter())  # (m, p, a) -> contatori
CAMPI = ['n', 'nAcc', 'dac', 'nDac', 'nS', 'lzS', 'rxS', 'bkS', 'rx', 'lz', 'wa', 'coin']  # coin = Delivery.DetractedDeliveries
for doc in j('ordini.json')['documents']:
    for r in doc['righe']:
        r = r['r']
        k = (doc['_id'], r[0], r[1] or 'senza-fornitore')
        for nome, v in zip(CAMPI, r[2:]):
            consegne[k][nome] += v
cons_fm = collections.defaultdict(dict)  # (m, p) -> {a: n}
cons_am = collections.defaultdict(dict)  # (m, a) -> {p: n}
for (m, p, a), c in consegne.items():
    cons_fm[(m, p)][a] = c['n']
    cons_am[(m, a)][p] = c['n']

# --------------------------------------------------------------------- ricavi
fatt_db = {}  # ExternalId FIC -> fattura del DB
for r in an['fatture']:
    if r.get('x'):
        fatt_db[r['x']] = r
prima_marzo = j('fatture_prima_di_marzo.json')['documents'][0]['righe']

RX_PERIODO = re.compile(r'dal (\d\d/\d\d/\d{4}) al (\d\d/\d\d/\d{4})', re.I)


def periodo_da_testo(*testi):
    for t in testi:
        m = RX_PERIODO.search(t or '')
        if m:
            a, b = (dt.datetime.strptime(x, '%d/%m/%Y').date() for x in m.groups())
            return a, b
    return None


def componente(code, name, subject):
    c, n, s = (code or '').upper(), (name or '').lower(), (subject or '').lower()
    if 'SEPA' in c or 'oneri bancari' in n:
        return 'oneri_sepa'
    if c == 'COMMISSIONI' or 'commissioni pagamenti' in n:
        return 'commissioni_pos'
    if c == '018' or 'ritiro ricetta' in n and c not in ('10004', '10002'):
        return 'ritiro_ricetta'
    if c == '017':
        return 'consegne_a_consumo'
    if c in ('10004', '10002'):
        return 'consegna_cliente_webapp'
    if c == 'UPGRADECONS' or s.startswith('consegne extra'):
        return 'extra'
    if c == 'BO&WA' or s.startswith('attivazione') or 'backoffice' in n:
        return 'attivazione'
    if 'integrazione e-commerce' in n or 'integrazione e-commerce' in s:
        return 'ecommerce'
    if s.startswith('abbonamento') or n.startswith('abbonamento') or re.match(r'(ERCOLE|MERCURIO|GIOVE|OLIMPO|ANNUALE|FARMACIE)', c):
        return 'canone'
    return 'altro'


def destinatario(doc):
    """('p', id farmacia) | ('g', id gruppo) | ('escluso', motivo) | ('cliente', None) | ('?', nome)."""
    ent = doc.get('entity') or {}
    nome = (ent.get('name') or '').upper()
    if any(e in nome for e in ESCLUSI_RICAVO):
        return ('escluso', 'Blue Health Center')
    if 'autofattura' in (doc.get('visible_subject') or '').lower() or ent.get('country') not in (None, '', 'Italia'):
        return ('escluso', 'storni di autofatture e controparti estere')
    if 'DRMAX ECOMM' in nome:
        return ('g', GRUPPO_DRMAX)
    if 'FARMACIE ITALIANE' in nome:
        return ('g', GRUPPO_FI)
    r = fatt_db.get(doc['id'])
    if r:
        if r.get('gb') and r.get('g'):
            return ('g', r['g'])
        if r.get('p'):
            return ('p', r['p'])
    piva = re.sub(r'\D', '', ent.get('vat_number') or '')
    ids = piva_farmacie.get(piva, []) if piva else []
    if len(ids) == 1:
        return ('p', ids[0])
    if ids:
        gs = {gruppo_di(i) for i in ids}
        if len(gs) == 1 and None not in gs:
            return ('g', gs.pop())
        attive = [i for i in ids if farmacie[i].get('aff') == 2]
        if len(attive) == 1:
            return ('p', attive[0])
        return ('piva', piva)
    chiave = norm_nome(ent.get('name'))
    if chiave in nome_farmacie and len(nome_farmacie[chiave]) == 1:
        return ('p', nome_farmacie[chiave][0])
    if ent.get('type') == 'person' or not piva:
        return ('cliente', ent.get('name'))
    return ('?', ent.get('name'))


def norm_nome(x):
    x = (x or '').lower()
    x = re.sub(r'(farmacia|farmacie|dott?\.?|dr\.?|s\.?r\.?l\.?s?|s\.?n\.?c\.?|s\.?a\.?s\.?|di|del|della|dei|allo|alla)', ' ', x)
    return re.sub(r'[^a-z0-9]+', '', x)


nome_farmacie = collections.defaultdict(list)
for f in farmacie.values():
    for k in {norm_nome(f.get('nome')), norm_nome(f.get('rs'))}:
        if k and f['id'] not in nome_farmacie[k]:
            nome_farmacie[k].append(f['id'])

righe_ricavo = []  # dict: dest, comp, inizio, fine, importo, fonte, doc


def aggiungi(dest, comp, inizio, fine, importo, fonte, rif):
    righe_ricavo.append(dict(dest=dest, comp=comp, inizio=inizio, fine=fine, importo=importo, fonte=fonte, rif=rif))


for nomefile, segno in (('emesse.json', 1), ('nc.json', -1)):
    for doc in j(nomefile)['documenti']:
        dest = destinatario(doc)
        dd = dt.date.fromisoformat(doc['date'])
        r = fatt_db.get(doc['id'])
        for it in doc['items_list']:
            imp = segno * it.get('net_price', 0) * it.get('qty', 1) * (1 - (it.get('discount') or 0) / 100)
            if abs(imp) < 0.005:
                continue
            per = periodo_da_testo(doc.get('visible_subject'), it.get('description'), it.get('name'))
            if not per and r and r.get('f') and r.get('to'):
                per = (giorno_roma(r['f']), giorno_roma(r['to']))
            if not per:
                per = (dd.replace(day=1), (dd.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1))
            comp = componente(it.get('code'), it.get('name'), doc.get('visible_subject'))
            aggiungi(dest, comp, per[0], per[1], imp, 'FIC ' + ('nota di credito' if segno < 0 else 'fattura'),
                     f"{doc['type']} {doc.get('number')}/{doc['date'][:4]} {(doc.get('entity') or {}).get('name', '')}")

TIPO_COMP = {1: 'canone', 2: 'extra', 5: 'attivazione'}
# fatture create nel DB e non ancora inviate a FIC (State 1), per esempio le trattenute del mese appena chiuso
non_inviate = [r for r in j('fatture_non_su_fic.json')['documents'][0]['righe'] if r.get('st') == 1]
for r in prima_marzo + non_inviate:
    if not r.get('to') or not r.get('f'):
        continue
    dest = ('g', r['g']) if r.get('gb') and r.get('g') else ('p', r.get('p'))
    if not dest[1]:
        continue
    ini, fin = giorno_roma(r['f']), giorno_roma(r['to'])
    if r['t'] == 3:
        for pr in r.get('prod') or []:
            imp = float(pr.get('TotalToBePaid') or 0) / 1.22
            aggiungi(dest, componente(pr.get('ProductCode'), '', 'trattenute'), ini, fin, imp, 'DB fattura prima di marzo', str(r.get('x')))
    else:
        aggiungi(dest, TIPO_COMP.get(r['t'], 'altro'), ini, fin, float(r.get('net') or 0), 'DB fattura prima di marzo' if r.get('x') else 'DB fattura non ancora su FIC', str(r.get('x')))

# ripartizione per mese e per farmacia
ricavo_fm = collections.defaultdict(lambda: collections.defaultdict(float))  # (m, p) -> comp -> euro
non_attribuito = collections.defaultdict(lambda: collections.defaultdict(float))  # m -> chiave -> euro
esclusi = collections.defaultdict(lambda: collections.defaultdict(float))  # m -> motivo -> euro
mese_oggi = mese(OGGI)


def membri_gruppo(gid, m):
    ids = PSEUDO_GRUPPI.get(gid) or [f['id'] for f in farmacie.values() if f.get('gruppo') == gid]
    attivi = [p for p in ids if m in contratto_mesi.get(p, ())]
    return attivi


for rr in righe_ricavo:
    for m, imp in ripartisci(rr['inizio'], rr['fine'], rr['importo']).items():
        if m < MESE_INIZIO or m > mese_oggi:
            continue
        tipo, val = rr['dest']
        if tipo == 'p':
            ricavo_fm[(m, val)][rr['comp']] += imp
        elif tipo in ('g', 'piva'):
            membri = membri_gruppo(val, m) if tipo == 'g' else [p for p in piva_farmacie[val] if m in contratto_mesi.get(p, ())]
            if rr['comp'] == 'ecommerce':
                membri = membri_gruppo(GRUPPO_DRMAX, m)
            if not membri:
                non_attribuito[m][f"{tipo}:{val}:{rr['comp']}"] += imp
                continue
            for p in membri:
                ricavo_fm[(m, p)][rr['comp']] += imp / len(membri)
        elif tipo == 'escluso':
            esclusi[m][val] += imp
        elif tipo == 'cliente' and rr['comp'] == 'consegna_cliente_webapp':
            non_attribuito[m]['clienti webapp:consegna_cliente_webapp'] += imp
        elif rr['comp'] != 'altro':
            non_attribuito[m][f"farmacia non riconosciuta: {rr['rif'][:60]}:{rr['comp']}"] += imp
        elif tipo == 'cliente':
            non_attribuito[m]['clienti webapp:consegna_cliente_webapp'] += imp
        else:
            esclusi[m][f"altri ricavi ({rr['rif'][:60]})"] += imp

# Canone senza fattura: contratti pagati prima di marzo 2026 fuori dal DB e da FIC (per esempio
# annuali anticipati nel 2025) non hanno una fattura nel periodo. Per le farmacie non fatturate
# come gruppo, se nel mese non c'e' canone fatturato si usa il prezzo dei blocchi del contratto,
# ripartito per giorni, in una voce a parte (canone_da_contratto) che la board puo' escludere.
FATTURATI_COME_GRUPPO = {g['id'] for g in gruppi.values() if g.get('fatt') == 0 and g.get('canone')}
canone_contratto = collections.defaultdict(float)
for c in an['contratti']:
    if gruppo_di(c['p']) in FATTURATI_COME_GRUPPO:
        continue
    for b in c['b']:
        if b['pr'] > 0:
            for m, v in ripartisci(giorno_roma(b['s']), giorno_roma(b['e']), b['pr']).items():
                canone_contratto[(m, c['p'])] += v
for (m, p), v in canone_contratto.items():
    if MESE_INIZIO <= m <= mese_oggi and ricavo_fm.get((m, p), {}).get('canone', 0) <= 0.5:
        ricavo_fm[(m, p)]['canone_da_contratto'] += v

# ---------------------------------------------------------------------- costi
costo_am = collections.defaultdict(float)  # (m, a) -> costo effettivo
righe_costo_am = collections.defaultdict(int)
for r in j('costi_caricati.json')['documents'][0]['righe']:
    try:
        act = float(str(r.get('act') or '0').replace(',', '.'))
    except ValueError:
        act = 0.0
    if act <= 0:
        continue
    da, a = giorno_roma(r['from']), giorno_roma(r['to'])
    if da.day >= 28 and da.month != a.month:  # i periodi partono dall'ultimo giorno del mese prima
        da = da + dt.timedelta(days=1)
    for m, v in ripartisci(da, a, act).items():
        costo_am[(m, r['a'])] += v
        righe_costo_am[(m, r['a'])] += 1


def num(x):
    try:
        return float(x or 0)
    except ValueError:
        return 0.0


righe = []
chiavi_fm = set(ricavo_fm) | set(cons_fm)
for (m, p) in sorted(chiavi_fm):
    if m < MESE_INIZIO:
        continue
    mix = cons_fm.get((m, p))
    if not mix:  # nessuna consegna nel mese: si usa il mix del mese piu' vicino
        vicini = sorted((abs(int(mm[:4]) * 12 + int(mm[5:]) - int(m[:4]) * 12 - int(m[5:])), mm) for (mm, pp) in cons_fm if pp == p)
        mix = cons_fm[(vicini[0][1], p)] if vicini else {'nessun-fornitore': 1}
        senza_consegne = True
    else:
        senza_consegne = False
    tot = sum(mix.values())
    for a, n in mix.items():
        quota = n / tot
        riga = dict(mese=m, farmacia=p, fornitore=a, quota=round(quota, 6))
        for comp, v in ricavo_fm.get((m, p), {}).items():
            riga['r_' + comp] = v * quota
        c = consegne.get((m, p, a)) if not senza_consegne else None
        if c:
            riga['consegne'] = c['n']
            riga['coin'] = c['coin']
            riga['ritiri_ricetta'] = c['rx']
            riga['zona_estesa'] = c['lz']
            riga['webapp'] = c['wa']
            if costo_am.get((m, a)):
                tot_a = sum(cons_am[(m, a)].values())
                riga['c_effettivo'] = costo_am[(m, a)] * c['n'] / tot_a
                riga['cons_effettivo'] = c['n']
            else:
                f = fornitori.get(a, {})
                riga['c_ordine'] = c['dac']
                riga['cons_ordine'] = c['nDac']
                if c['nS']:
                    if f.get('interno') or num(f.get('p')) <= 0:
                        riga['cons_senza_costo'] = c['nS']
                    else:
                        riga['c_listino'] = c['nS'] * num(f.get('p')) + c['lzS'] * num(f.get('pz')) + c['rxS'] * num(f.get('prx')) + c['bkS'] * num(f.get('pbk'))
                        riga['cons_listino'] = c['nS']
        righe.append(riga)

# costo effettivo di fornitori che nel mese non hanno consegne (es. corriere interno non chiamato)
costo_senza_consegne = []
for (m, a), v in costo_am.items():
    if m >= MESE_INIZIO and not cons_am.get((m, a)):
        costo_senza_consegne.append(dict(mese=m, fornitore=a, c_effettivo=v))

# ---------------------------------------------------------------- dimensioni
def citta(pid):
    f = farmacie.get(pid) or {}
    return (f.get('citta') or '').strip().title()


dim_farmacie = {}
for p in {r['farmacia'] for r in righe}:
    f = farmacie.get(p, {})
    g = gruppo_di(p)
    dim_farmacie[p] = dict(nome=f.get('nome'), citta=citta(p), provincia=(f.get('prov') or '').strip().upper(),
                           gruppo=(gruppi.get(g) or {}).get('nome') or ({'m:cannata': 'Cannata', 'm:villaggio': 'Del Villaggio e Delle Poste'}.get(g)),
                           categoria=categoria(p))
dim_fornitori = {}
for a in {r['fornitore'] for r in righe} | {r['fornitore'] for r in costo_senza_consegne}:
    f = fornitori.get(a, {})
    dim_fornitori[a] = dict(nome=f.get('nome') or a, interno=bool(f.get('interno')), citta=(f.get('citta') or '').strip().title())

meta = dict(
    generato=dt.datetime.now().isoformat(timespec='minutes'),
    mese_inizio=MESE_INIZIO, mese_parziale=mese_oggi,
    fonti=dict(consegne='MongoDB Order, stato 9, data di consegna (ora italiana)',
               ricavi='Fatture in Cloud: fatture emesse e note di credito, imponibile di riga, ripartito per giorni sul periodo fatturato',
               costi='MongoDB DeliveryAgencyInvoice (costo effettivo) > Order.Payment.DeliveryAgencyCost > listino DeliveryAgency > mancante'),
)
json.dump(dict(meta=meta, righe=righe, costo_senza_consegne=costo_senza_consegne,
               non_attribuito={m: dict(v) for m, v in non_attribuito.items()},
               esclusi={m: dict(v) for m, v in esclusi.items()},
               farmacie=dim_farmacie, fornitori=dim_fornitori),
          open(OUT / 'base_primo_margine.json', 'w', encoding='utf-8'), ensure_ascii=False)

# ------------------------------------------------------------- riepilogo
COMP = sorted({k for r in righe for k in r if k.startswith('r_')})
tot = collections.defaultdict(lambda: collections.defaultdict(float))
for r in righe:
    for k, v in r.items():
        if isinstance(v, (int, float)) and (k.startswith(('r_', 'c_', 'cons')) or k == 'consegne'):
            tot[r['mese']][k] += v
for x in costo_senza_consegne:
    tot[x['mese']]['c_effettivo_senza_consegne'] += x['c_effettivo']
print('mese', 'ricavo', 'costo', 'margine', 'consegne', 'senza costo', *COMP, sep=';')
for m in sorted(tot):
    t = tot[m]
    ric = sum(t[c] for c in COMP)
    cos = t['c_effettivo'] + t['c_ordine'] + t['c_listino'] + t['c_effettivo_senza_consegne']
    print(m, round(ric), round(cos), round(ric - cos), int(t['consegne']), int(t['cons_senza_costo']), *[round(t[c]) for c in COMP], sep=';')
print('\nNON ATTRIBUITO')
for m in sorted(non_attribuito):
    for k, v in sorted(non_attribuito[m].items(), key=lambda x: -abs(x[1]))[:6]:
        print(m, round(v), k)
print('\nESCLUSI')
for m in sorted(esclusi):
    for k, v in sorted(esclusi[m].items(), key=lambda x: -abs(x[1]))[:6]:
        print(m, round(v), k)
