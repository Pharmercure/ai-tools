import {
	Accordion, AccordionDetails, AccordionSummary, Alert, Box, Checkbox, CircularProgress, FormControlLabel, MenuItem,
	Paper, TextField, Typography,
} from "@mui/material";
import { useState } from "react";
import { Provider } from "react-redux";
import { type Dati, type Filtri, eur, eur2, filtra, nomeForn, nomeMese, pct, perMese, totale } from "./calcoli";
import Grafici from "./grafici";
import RefreshButton from "./refresh-button";
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
		<MenuItem key={m} value={m}>{nomeMese(m) + (m > d.ultimo_chiuso ? " (in corso)" : "")}</MenuItem>
	));
	const fornitori = d.fornitori
		.map((_, i) => i)
		.sort((x, y) => nomeForn(d, x).localeCompare(nomeForn(d, y), "it"));
	// Etichetta sempre sopra anche quando il valore è vuoto ("Tutte"), menu alto al massimo 360 px.
	const select = (label: string, value: string, onChange: (v: string) => void, width: number) => ({
		select: true, label, value, onChange: (e: { target: { value: string } }) => onChange(e.target.value),
		sx: { minWidth: width }, slotProps: { inputLabel: { shrink: true }, select: { displayEmpty: true, MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } } },
	});

	return (
		<Box>
			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 0.5 }}>
				<Typography variant="h1" component="h1">Primo margine</Typography>
				<RefreshButton />
			</Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				Ricavi pagati dalle farmacie meno costo delle loro consegne. Dati estratti il {est.toLocaleDateString("it-IT")} alle{" "}
				{est.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} da MongoDB e Fatture in Cloud. Ultimo mese
				chiuso: {nomeMese(d.ultimo_chiuso)}.
			</Typography>

			<Paper sx={{ p: 2, mb: 2 }}>
				<Box role="group" aria-label="Filtri" sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
					<TextField {...select("Da", f.da, (v) => cambia({ da: v }), 110)}>{mesiOpz}</TextField>
					<TextField {...select("A", f.a, (v) => cambia({ a: v }), 110)}>{mesiOpz}</TextField>
					<TextField {...select("Categoria", f.cat, (v) => cambia({ cat: v }), 190)}>
						<MenuItem value="">Tutte</MenuItem>
						{unici(d.farmacie.map((x) => x[4])).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
					</TextField>
					<TextField {...select("Città", f.citta, (v) => cambia({ citta: v }), 140)}>
						<MenuItem value="">Tutte</MenuItem>
						{unici(d.farmacie.map((x) => x[1])).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
					</TextField>
					<TextField {...select("Fornitori", f.tipo, (v) => cambia({ tipo: v }), 170)}>
						<MenuItem value="">Interni ed esterni</MenuItem>
						<MenuItem value="1">Solo interni</MenuItem>
						<MenuItem value="0">Solo esterni</MenuItem>
					</TextField>
					<TextField {...select("Fornitore", f.forn, (v) => cambia({ forn: v }), 190)}>
						<MenuItem value="">Tutti</MenuItem>
						{fornitori.map((i) => (
							<MenuItem key={i} value={String(i)}>{nomeForn(d, i) + (d.fornitori[i][1] ? " (interno)" : "")}</MenuItem>
						))}
					</TextField>
					<TextField
						type="search"
						label="Farmacia"
						placeholder="Nome o parte del nome"
						value={f.testo}
						onChange={(e) => cambia({ testo: e.target.value })}
						slotProps={{ inputLabel: { shrink: true } }}
						sx={{ minWidth: 200 }}
					/>
					<FormControlLabel
						control={<Checkbox size="small" checked={f.conContratto} onChange={(e) => cambia({ conContratto: e.target.checked })} />}
						label="Canone da contratto dove manca la fattura"
						slotProps={{ typography: { variant: "body2" } }}
					/>
					<Box component="button" type="button" onClick={() => setF(filtriIniziali(d))} sx={{ all: "unset", cursor: "pointer", color: "primary.main", fontSize: 13, fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
						Azzera filtri
					</Box>
				</Box>
			</Paper>

			{parziale && (
				<Alert severity="warning" sx={{ mb: 2 }}>
					Il periodo comprende mesi dopo {nomeMese(d.ultimo_chiuso)}: i costi di quei mesi non sono ancora caricati, quindi costo e
					margine sono incompleti.
				</Alert>
			)}

			<Box component="section" aria-label="Indicatori del periodo" sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1.5, mb: 2 }}>
				{kpi.map(([t, v, n]) => (
					<Paper key={t} sx={{ p: "12px 14px" }}>
						<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{t}</Typography>
						<Typography
							variant="h5"
							component="strong"
							sx={{ display: "block", fontWeight: 700, fontVariantNumeric: "tabular-nums", mt: 0.25, color: t === "Primo margine" && marg < 0 ? "error.main" : "text.primary" }}
						>
							{v}
						</Typography>
						{n && <Typography variant="caption" color="text.secondary">{n}</Typography>}
					</Paper>
				))}
			</Box>

			<Grafici d={d} pm={pm} />
			<TabellaVista d={d} F={F} onFiltra={cambia} />
			<TabellaComponenti d={d} F={F} mesi={pm.map(([m]) => m)} />

			<Paper sx={{ p: 2 }}>
				<Typography variant="h2" gutterBottom>Qualità del dato</Typography>
				<TabellaQualita d={d} pm={pm} />
				<Accordion disableGutters elevation={0} square sx={{ mt: 1.5, bgcolor: "transparent", "&::before": { display: "none" } }}>
					<AccordionSummary expandIcon={<span aria-hidden>▾</span>} sx={{ px: 0, color: "text.secondary" }}>Come si calcola</AccordionSummary>
					<AccordionDetails sx={{ px: 0 }}>
						<Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: "text.secondary", "& li": { mb: 0.5 } }}>
							{METODO.map((t) => <li key={t}>{t}</li>)}
						</Box>
					</AccordionDetails>
				</Accordion>
			</Paper>
		</Box>
	);
}

function Pagina() {
	const { data, error, isLoading } = useGetDatiQuery();
	if (isLoading) return <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress aria-label="Caricamento dei dati" /></Box>;
	if (error && "status" in error && error.status === 404) {
		return (
			<Box sx={{ display: "grid", gap: 2, justifyItems: "start" }}>
				<Alert severity="info">I dati del primo margine non sono ancora stati generati. Si aggiornano ogni lunedì mattina.</Alert>
				<RefreshButton />
			</Box>
		);
	}
	if (error || !data) return <Alert severity="error">Impossibile caricare i dati del primo margine.</Alert>;
	return <Cruscotto d={data} />;
}

export default function PrimoMargine() {
	return (
		<Provider store={store}>
			<Pagina />
		</Provider>
	);
}
