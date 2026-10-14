import {
	Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow,
	TableSortLabel, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
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

	const fine = { fontWeight: 600, borderTop: 2, borderColor: "divider" } as const;
	return (
		<Paper sx={{ p: 2, mb: 2 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
				<ToggleButtonGroup
					exclusive
					size="small"
					value={vista}
					aria-label="Vista della tabella"
					onChange={(_, v: Vista | null) => v && scegli(v)}
				>
					{VISTE.map(([v, n]) => (
						<ToggleButton key={v} value={v}>{n}</ToggleButton>
					))}
				</ToggleButtonGroup>
				<Button variant="outlined" size="small" onClick={() => scaricaCsv(righe, vista)}>Scarica CSV</Button>
			</Box>
			{NOTE_VISTA[vista] && (
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{NOTE_VISTA[vista]}</Typography>
			)}
			<TableContainer sx={{ maxHeight: 640 }}>
				<Table size="small" stickyHeader>
					<TableHead>
						<TableRow>
							{COLONNE.map(([c, n]) => {
								const col = c === "nome" && vista === "mese" ? "chiave" : c;
								const attiva = ordina.col === col;
								return (
									<TableCell
										key={c}
										align={c === "nome" ? "left" : "right"}
										sortDirection={attiva ? (ordina.dir > 0 ? "asc" : "desc") : false}
										sx={c === "nome" ? { minWidth: 180 } : undefined}
									>
										<TableSortLabel
											active={attiva}
											direction={ordina.dir > 0 ? "asc" : "desc"}
											onClick={() => setOrdina({ col, dir: attiva ? (-ordina.dir as 1 | -1) : c === "nome" ? 1 : -1 })}
										>
											{c === "nome" ? VISTE.find(([v]) => v === vista)![1] : n}
										</TableSortLabel>
									</TableCell>
								);
							})}
						</TableRow>
					</TableHead>
					<TableBody>
						{righe.map((r) => {
							const cliccabileRiga = cliccabile && r.chiave !== "~senza";
							return (
								<TableRow
									key={r.chiave}
									hover
									title={cliccabileRiga ? "Filtra su questa voce" : undefined}
									onClick={() => clicca(r)}
									sx={{ cursor: cliccabileRiga ? "pointer" : "default" }}
								>
									<TableCell sx={{ whiteSpace: "normal" }}>
										{r.nome}
										{r.det && (
											<Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.det}</Typography>
										)}
									</TableCell>
									{valori(r).map((v, i) => (
										<TableCell
											key={i}
											align="right"
											sx={(i === 4 && r.margine < 0) || (i === 5 && r.marginePct !== null && r.marginePct < 0) ? { color: "error.main" } : undefined}
										>
											{v}
										</TableCell>
									))}
								</TableRow>
							);
						})}
					</TableBody>
					<TableFooter>
						<TableRow>
							{[
								`Totale (${righe.length} righe)`, "", eur(tot.n), eur(tot.r), eur(tot.c), eur(tot.r - tot.c),
								rap(tot.r - tot.c, tot.r, pct), eur(tot.k), rap(tot.r, tot.n, eur2), rap(tot.c, tot.n, eur2),
								rap(tot.r, tot.k, eur2), rap(tot.c, tot.k, eur2), rap(tot.e, tot.n, pct), tot.s ? eur(tot.s) : "–",
							].map((v, i) => (
								<TableCell key={i} align={i === 0 ? "left" : "right"} sx={{ ...fine, color: "text.primary", fontSize: 13 }}>{v}</TableCell>
							))}
						</TableRow>
					</TableFooter>
				</Table>
			</TableContainer>
		</Paper>
	);
}

export function TabellaComponenti({ d, F, mesi }: { d: Dati; F: Filtrato; mesi: string[] }) {
	const s: Record<string, Record<string, number>> = {};
	for (const c of F.comp) s[c] = {};
	for (const x of F.righe) for (const c of F.comp) s[c][x.m] = (s[c][x.m] || 0) + x.r[F.I["r_" + c]];
	const somma = (c: string) => mesi.reduce((b, m) => b + (s[c][m] || 0), 0);
	const totale = F.comp.reduce((a, c) => a + somma(c), 0);
	return (
		<Paper sx={{ p: 2, mb: 2 }}>
			<Typography variant="h2" gutterBottom>Da cosa è fatto il ricavo</Typography>
			<TableContainer>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Voce</TableCell>
							{mesi.map((m) => <TableCell key={m} align="right">{nomeMese(m) + (m > d.ultimo_chiuso ? "*" : "")}</TableCell>)}
							<TableCell align="right">Totale</TableCell>
							<TableCell align="right">Quota</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{F.comp.filter((c) => Math.abs(somma(c)) >= 0.5).map((c) => (
							<TableRow key={c} hover>
								<TableCell>{NOMI_COMP[c] || c}</TableCell>
								{mesi.map((m) => <TableCell key={m} align="right">{eur(s[c][m] || 0)}</TableCell>)}
								<TableCell align="right">{eur(somma(c))}</TableCell>
								<TableCell align="right">{totale ? pct(somma(c) / totale) : "–"}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Paper>
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
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell />
						{pm.map(([m]) => <TableCell key={m} align="right">{nomeMese(m) + (m > d.ultimo_chiuso ? "*" : "")}</TableCell>)}
					</TableRow>
				</TableHead>
				<TableBody>
					{righe.map(([n, f]) => (
						<TableRow key={n} hover>
							<TableCell>{n}</TableCell>
							{pm.map(([m, a]) => <TableCell key={m} align="right">{f(a, m)}</TableCell>)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
