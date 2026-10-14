import { useState } from "react";
import { Provider } from "react-redux";
import { type Dati, type Filtri, eur, eur2, filtra, nomeForn, nomeMese, pct, perMese, totale } from "./calcoli";
import Grafici from "./grafici";
import { stile } from "./stile";
import { useGetDatiQuery, store } from "./store";
import { TabellaComponenti, TabellaQualita, TabellaVista } from "./tabelle";

const METODO = [
	"Ricavo: imponibile delle fatture emesse e delle note di credito di Fatture in Cloud, ripartito per giorni sui mesi del periodo fatturato. Comprende canone, coin extra, attivazione backoffice, consegne a consumo, ritiro ricetta, commissioni POS, oneri SEPA e integrazione e-commerce per le farmacie Dr. Max. Esclusi Blue Health Center e i ricavi che non vengono dalle farmacie.",
	"Per i periodi fatturati prima di marzo 2026, quando Fatture in Cloud non ha storico, si usano le fatture del database. Le fatture create nel database e non ancora inviate a Fatture in Cloud (per esempio le trattenute dell'ultimo mese) si contano già.",
	"Canone da contratto: se nel mese una farmacia non ha un canone fatturato ma il contratto ha un prezzo, si usa il prezzo dei blocchi del contratto (succede con abbonamenti pagati prima di marzo 2026). Si può escludere con la casella nei filtri.",
	"Gruppi fatturati come gruppo (per esempio Farmacie Italiane, Farmiss, CoFa): il canone di gruppo si divide in parti uguali fra le farmacie del gruppo con un contratto in corso nel mese.",
	"Costo logistica: costo effettivo caricato nel backadmin per fornitore e mese, diviso fra le farmacie in proporzione alle consegne. Dove il costo effettivo non c'è ancora: costo scritto sull'ordine, poi listino del fornitore. Le consegne senza nessuno dei tre restano senza costo e sono contate qui sotto: non si stima.",
	"Fornitore: il ricavo di una farmacia nel mese si divide fra i fornitori che l'hanno servita, in proporzione alle consegne. Se in un mese la farmacia non ha consegne, si usa il fornitore del mese più vicino.",
	"Coin: le coin scalate alla farmacia per ogni consegna (1 in zona base, 2 in zona estesa o voluminosa), lette su ogni ordine. Ricavo e costo per coin si calcolano sulle coin usate, non su quelle del pacchetto.",
	"Il costo azienda dei corrieri interni è visibile per decisione D-2026-10-13-01. Restano fuori retribuzioni e accordi individuali.",
	"I mesi dopo l'ultimo mese chiuso sono parziali: i costi non sono ancora caricati e il margine è sovrastimato.",
	"Esclusi: provvigioni e costi commerciali, costi fissi, IVA.",
];

const filtriIniziali = (d: Dati): Filtri => ({
	da: d.mesi[0],
	a: d.mesi.includes(d.ultimo_chiuso) ? d.ultimo_chiuso : d.mesi[d.mesi.length - 1],
	cat: "",
	citta: "",
	tipo: "",
	forn: "",
	testo: "",
	conContratto: true,
});

const unici = (v: string[]) => [...new Set(v)].filter(Boolean).sort((x, y) => x.localeCompare(y, "it"));

function Cruscotto({ d }: { d: Dati }) {
	const [f, setF] = useState(() => filtriIniziali(d));
	const cambia = (v: Partial<Filtri>) => setF((p) => ({ ...p, ...v }));

	const F = filtra(d, f);
	const tot = totale(F);
	const pm = perMese(d, f, F);
	const marg = tot.ricavo - tot.costo;
	const parziale = f.a > d.ultimo_chiuso;
	const est = new Date(d.estratto);

	const kpi: [string, string, string][] = [
		["Ricavo", eur(tot.ricavo) + " €", ""],
		["Costo logistica", eur(tot.costo) + " €", ""],
		["Primo margine", eur(marg) + " €", tot.ricavo ? pct(marg / tot.ricavo) + " del ricavo" : ""],
		["Consegne", eur(tot.consegne), tot.senza ? eur(tot.senza) + " senza costo" : "tutte con un costo"],
		["Ricavo per consegna", tot.consegne ? eur2(tot.ricavo / tot.consegne) + " €" : "–", ""],
		["Costo per consegna", tot.consegne ? eur2(tot.costo / tot.consegne) + " €" : "–", ""],
		["Coin usate", eur(tot.coin), tot.consegne ? eur2(tot.coin / tot.consegne) + " per consegna" : ""],
		["Ricavo per coin", tot.coin ? eur2(tot.ricavo / tot.coin) + " €" : "–", "sulle coin usate"],
		["Costo per coin", tot.coin ? eur2(tot.costo / tot.coin) + " €" : "–", "sulle coin usate"],
		["Farmacie", eur(tot.farm.size), "con ricavo o consegne"],
	];

	const mesiOpz = d.mesi.map((m) => (
		<option key={m} value={m}>{nomeMese(m) + (m > d.ultimo_chiuso ? " (in corso)" : "")}</option>
	));
	const fornitori = d.fornitori
		.map((_, i) => i)
		.sort((x, y) => nomeForn(d, x).localeCompare(nomeForn(d, y), "it"));

	return (
		<div css={stile}>
			<h1>Primo margine</h1>
			<p className="sub">
				Ricavi pagati dalle farmacie meno costo delle loro consegne. Dati estratti il {est.toLocaleDateString("it-IT")} alle{" "}
				{est.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} da MongoDB e Fatture in Cloud. Ultimo mese
				chiuso: {nomeMese(d.ultimo_chiuso)}.
			</p>

			<div className="filtri" role="group" aria-label="Filtri">
				<label>Da <select value={f.da} onChange={(e) => cambia({ da: e.target.value })}>{mesiOpz}</select></label>
				<label>A <select value={f.a} onChange={(e) => cambia({ a: e.target.value })}>{mesiOpz}</select></label>
				<label>Categoria
					<select value={f.cat} onChange={(e) => cambia({ cat: e.target.value })}>
						<option value="">Tutte</option>
						{unici(d.farmacie.map((x) => x[4])).map((v) => <option key={v}>{v}</option>)}
					</select>
				</label>
				<label>Città
					<select value={f.citta} onChange={(e) => cambia({ citta: e.target.value })}>
						<option value="">Tutte</option>
						{unici(d.farmacie.map((x) => x[1])).map((v) => <option key={v}>{v}</option>)}
					</select>
				</label>
				<label>Fornitori
					<select value={f.tipo} onChange={(e) => cambia({ tipo: e.target.value })}>
						<option value="">Interni ed esterni</option>
						<option value="1">Solo interni</option>
						<option value="0">Solo esterni</option>
					</select>
				</label>
				<label>Fornitore
					<select value={f.forn} onChange={(e) => cambia({ forn: e.target.value })}>
						<option value="">Tutti</option>
						{fornitori.map((i) => (
							<option key={i} value={i}>{nomeForn(d, i) + (d.fornitori[i][1] ? " (interno)" : "")}</option>
						))}
					</select>
				</label>
				<label>Farmacia
					<input type="search" placeholder="Nome o parte del nome" value={f.testo} onChange={(e) => cambia({ testo: e.target.value })} />
				</label>
				<label className="check">
					<input type="checkbox" checked={f.conContratto} onChange={(e) => cambia({ conContratto: e.target.checked })} />
					Canone da contratto dove manca la fattura
				</label>
				<button type="button" onClick={() => setF(filtriIniziali(d))}>Azzera filtri</button>
			</div>

			{parziale && (
				<div className="avviso">
					Il periodo comprende mesi dopo {nomeMese(d.ultimo_chiuso)}: i costi di quei mesi non sono ancora caricati, quindi costo e
					margine sono incompleti.
				</div>
			)}

			<section className="kpi" aria-label="Indicatori del periodo">
				{kpi.map(([t, v, n]) => (
					<div key={t}>
						<span>{t}</span>
						<strong className={t === "Primo margine" && marg < 0 ? "neg" : undefined}>{v}</strong>
						{n && <em>{n}</em>}
					</div>
				))}
			</section>

			<Grafici d={d} pm={pm} />
			<TabellaVista d={d} F={F} onFiltra={cambia} />
			<TabellaComponenti d={d} F={F} mesi={pm.map(([m]) => m)} />

			<section className="card">
				<h2>Qualità del dato</h2>
				<TabellaQualita d={d} pm={pm} />
				<details style={{ marginTop: 12 }}>
					<summary>Come si calcola</summary>
					<ul className="note">{METODO.map((t) => <li key={t}>{t}</li>)}</ul>
				</details>
			</section>
		</div>
	);
}

function Pagina() {
	const { data, error, isLoading } = useGetDatiQuery();
	if (isLoading) return <p>Caricamento dei dati…</p>;
	if (error && "status" in error && error.status === 404) {
		return <p>I dati del primo margine non sono ancora stati generati. Si aggiornano ogni lunedì mattina.</p>;
	}
	if (error || !data) return <p>Impossibile caricare i dati del primo margine.</p>;
	return <Cruscotto d={data} />;
}

export default function PrimoMargine() {
	return (
		<Provider store={store}>
			<Pagina />
		</Provider>
	);
}
