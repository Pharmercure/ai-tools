import { useState } from "react";
import {
	type Acc, type Dati, type Filtrato, type Filtri, type RigaVista, type Vista,
	NOMI_COMP, aggrega, eur, eur2, nomeMese, pct,
} from "./calcoli";

const VISTE: [Vista, string][] = [
	["citta", "Città"], ["farmacia", "Farmacia"], ["fornitore", "Fornitore"],
	["categoria", "Categoria"], ["gruppo", "Gruppo"], ["mese", "Mese"],
];

const NOTE_VISTA: Record<Vista, string> = {
	citta: "Città della farmacia. Clic su una riga per vedere le farmacie di quella città.",
	farmacia: "Il ricavo delle farmacie di un gruppo fatturato come gruppo è la loro quota del canone di gruppo.",
	fornitore: "Ricavo del fornitore = quota del ricavo delle farmacie servite, in proporzione alle consegne del mese. Clic su una riga per vedere le sue farmacie.",
	categoria: "Categorie commerciali: Hippocrates, Dr. Max, Farmacie Italiane, indipendenti e piccoli gruppi. Clic su una riga per filtrare.",
	gruppo: "Gruppi registrati nel database, più i piccoli gruppi dello stesso titolare (Cannata, Del Villaggio e Delle Poste).",
	mese: "",
};

type Colonna = [keyof RigaVista, string];
const COLONNE: Colonna[] = [
	["nome", ""], ["farmacie", "Farmacie"], ["consegne", "Consegne"], ["ricavo", "Ricavo €"], ["costo", "Costo €"],
	["margine", "Margine €"], ["marginePct", "Margine %"], ["coin", "Coin"], ["rpc", "Ricavo/cons."], ["cpc", "Costo/cons."],
	["rpcoin", "Ricavo/coin"], ["cpcoin", "Costo/coin"], ["effPct", "Costo effettivo"], ["senza", "Senza costo"],
];

const num = (v: number | null, f: (n: number) => string) => (v === null ? "–" : f(v));

function valori(r: RigaVista) {
	return [
		eur(r.farmacie), eur(r.consegne), eur(r.ricavo), eur(r.costo), eur(r.margine), num(r.marginePct, pct), eur(r.coin),
		num(r.rpc, eur2), num(r.cpc, eur2), num(r.rpcoin, eur2), num(r.cpcoin, eur2), num(r.effPct, pct), r.senza ? eur(r.senza) : "–",
	];
}

function scaricaCsv(righe: RigaVista[], vista: Vista) {
	const cols: (keyof RigaVista)[] = ["nome", "det", "farmacie", "consegne", "coin", "ricavo", "costo", "margine", "marginePct", "rpc", "cpc", "rpcoin", "cpcoin", "effPct", "senza"];
	const q = (v: unknown) =>
		v === null || v === undefined ? "" : typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : `"${String(v).replace(/"/g, '""')}"`;
	const testo = [cols.join(";"), ...righe.map((r) => cols.map((c) => q(r[c])).join(";"))].join("\n");
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob(["﻿" + testo], { type: "text/csv;charset=utf-8" }));
	a.download = `primo-margine-${vista}.csv`;
	a.click();
}

export function TabellaVista({ d, F, onFiltra }: { d: Dati; F: Filtrato; onFiltra: (v: Partial<Filtri>) => void }) {
	const [vista, setVista] = useState<Vista>("citta");
	const [ordina, setOrdina] = useState<{ col: keyof RigaVista; dir: 1 | -1 }>({ col: "ricavo", dir: -1 });

	const scegli = (v: Vista) => {
		setVista(v);
		setOrdina(v === "mese" ? { col: "chiave", dir: 1 } : { col: "ricavo", dir: -1 });
	};
	const righe = aggrega(d, F, vista).sort((p, q) => {
		const a = p[ordina.col] as string | number | null;
		const b = q[ordina.col] as string | number | null;
		if (a === b) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return (typeof a === "string" ? a.localeCompare(b as string, "it") : a - (b as number)) * ordina.dir;
	});

	const clicca = (r: RigaVista) => {
		if (r.chiave === "~senza") return;
		if (vista === "citta") onFiltra({ citta: r.nome });
		else if (vista === "fornitore") onFiltra({ forn: r.chiave });
		else if (vista === "categoria") onFiltra({ cat: r.nome });
		else return;
		setVista("farmacia");
		setOrdina({ col: "ricavo", dir: -1 });
	};
	const cliccabile = vista === "citta" || vista === "fornitore" || vista === "categoria";

	const tot = righe.reduce(
		(a, r) => ({ r: a.r + r.ricavo, c: a.c + r.costo, n: a.n + r.consegne, k: a.k + r.coin, s: a.s + r.senza, e: a.e + r.eff }),
		{ r: 0, c: 0, n: 0, k: 0, s: 0, e: 0 },
	);
	const rap = (a: number, b: number, f: (n: number) => string) => (b ? f(a / b) : "–");

	return (
		<section className="card">
			<div className="schede" role="tablist" aria-label="Vista della tabella">
				{VISTE.map(([v, n]) => (
					<button key={v} aria-pressed={v === vista} onClick={() => scegli(v)}>{n}</button>
				))}
				<span className="spazio" />
				<button type="button" onClick={() => scaricaCsv(righe, vista)}>Scarica CSV</button>
			</div>
			<p className="note">{NOTE_VISTA[vista]}</p>
			<div className="tabella">
				<table>
					<thead>
						<tr>
							{COLONNE.map(([c, n]) => {
								const col = c === "nome" && vista === "mese" ? "chiave" : c;
								return (
									<th
										key={c}
										scope="col"
										aria-sort={ordina.col === col ? (ordina.dir > 0 ? "ascending" : "descending") : undefined}
										onClick={() => setOrdina({ col, dir: ordina.col === col ? (-ordina.dir as 1 | -1) : c === "nome" ? 1 : -1 })}
									>
										{c === "nome" ? VISTE.find(([v]) => v === vista)![1] : n}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{righe.map((r) => (
							<tr
								key={r.chiave}
								className={cliccabile && r.chiave !== "~senza" ? "clic" : undefined}
								title={cliccabile && r.chiave !== "~senza" ? "Filtra su questa voce" : undefined}
								onClick={() => clicca(r)}
							>
								<td>
									{r.nome}
									{r.det && <span className="det">{r.det}</span>}
								</td>
								{valori(r).map((v, i) => (
									<td key={i} className={(i === 4 && r.margine < 0) || (i === 5 && r.marginePct !== null && r.marginePct < 0) ? "neg" : undefined}>{v}</td>
								))}
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<td>{`Totale (${righe.length} righe)`}</td>
							<td />
							<td>{eur(tot.n)}</td>
							<td>{eur(tot.r)}</td>
							<td>{eur(tot.c)}</td>
							<td>{eur(tot.r - tot.c)}</td>
							<td>{rap(tot.r - tot.c, tot.r, pct)}</td>
							<td>{eur(tot.k)}</td>
							<td>{rap(tot.r, tot.n, eur2)}</td>
							<td>{rap(tot.c, tot.n, eur2)}</td>
							<td>{rap(tot.r, tot.k, eur2)}</td>
							<td>{rap(tot.c, tot.k, eur2)}</td>
							<td>{rap(tot.e, tot.n, pct)}</td>
							<td>{tot.s ? eur(tot.s) : "–"}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</section>
	);
}

export function TabellaComponenti({ d, F, mesi }: { d: Dati; F: Filtrato; mesi: string[] }) {
	const s: Record<string, Record<string, number>> = {};
	for (const c of F.comp) s[c] = {};
	for (const x of F.righe) for (const c of F.comp) s[c][x.m] = (s[c][x.m] || 0) + x.r[F.I["r_" + c]];
	const somma = (c: string) => mesi.reduce((b, m) => b + (s[c][m] || 0), 0);
	const totale = F.comp.reduce((a, c) => a + somma(c), 0);
	return (
		<section className="card">
			<h2>Da cosa è fatto il ricavo</h2>
			<div className="tabella">
				<table>
					<thead>
						<tr>
							<th>Voce</th>
							{mesi.map((m) => <th key={m}>{nomeMese(m) + (m > d.ultimo_chiuso ? "*" : "")}</th>)}
							<th>Totale</th>
							<th>Quota</th>
						</tr>
					</thead>
					<tbody>
						{F.comp.filter((c) => Math.abs(somma(c)) >= 0.5).map((c) => (
							<tr key={c}>
								<td>{NOMI_COMP[c] || c}</td>
								{mesi.map((m) => <td key={m}>{eur(s[c][m] || 0)}</td>)}
								<td>{eur(somma(c))}</td>
								<td>{totale ? pct(somma(c) / totale) : "–"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function TabellaQualita({ d, pm }: { d: Dati; pm: [string, Acc][] }) {
	const righe: [string, (a: Acc, m: string) => string][] = [
		["Consegne", (a) => eur(a.consegne)],
		["Coin usate", (a) => eur(a.coin)],
		["con costo effettivo", (a) => (a.consegne ? pct(a.eff / a.consegne) : "–")],
		["con costo scritto sull'ordine", (a) => (a.consegne ? pct(a.ord / a.consegne) : "–")],
		["con costo da listino", (a) => (a.consegne ? pct(a.lis / a.consegne) : "–")],
		["senza costo (non stimato)", (a) => (a.senza ? eur(a.senza) : "–")],
		["Ricavo non attribuito a farmacie, €", (_, m) => eur(d.non_attribuito[m] || 0)],
	];
	return (
		<div className="tabella">
			<table>
				<thead>
					<tr>
						<th />
						{pm.map(([m]) => <th key={m}>{nomeMese(m) + (m > d.ultimo_chiuso ? "*" : "")}</th>)}
					</tr>
				</thead>
				<tbody>
					{righe.map(([n, f]) => (
						<tr key={n}>
							<td>{n}</td>
							{pm.map(([m, a]) => <td key={m}>{f(a, m)}</td>)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
