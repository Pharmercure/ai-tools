import { Alert, Box, Chip, CircularProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router";
import { type MonthView, OPEN_VERDICTS } from "../api/types";
import { COST, dateTime, eur, monthName, signedEur, supplierPath } from "./format";
import { useGetMonthQuery, useGetMonthsQuery } from "./store";

type Supplier = MonthView["suppliers"][number];

export const diffOf = (s: Supplier) => (s.invoiced !== null && s.expected !== null ? s.invoiced - s.expected : null);

/** Il mese più recente caricato, o quello scelto. */
export function useMonth(picked = "") {
	const months = useGetMonthsQuery();
	const month = picked || months.data?.[0]?.month || "";
	const view = useGetMonthQuery(month, { skip: !month });
	return { months, month, view };
}

/** Una riga che dice a che punto è il mese. */
export function MonthStatus({ v }: { v: MonthView }) {
	const s = v.suppliers;
	const arrived = s.filter((x) => x.invoiced !== null).length;
	const ok = s.filter((x) => x.outcome === "ok").length;
	const open = v.queue.filter((q) => OPEN_VERDICTS.includes(q.verdict));
	const openEur = open.reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0);
	const ready = s.filter((x) => x.costState === "actual_ready").length;
	const items: [string, string][] = [
		["Fatture arrivate", `${arrived} su ${s.length}`],
		["Tornano", `${ok} su ${arrived}`],
		["Da decidere", `${open.length}${openEur ? ` · ${eur(openEur)}` : ""}`],
		["Costo effettivo pronto", `${ready} fornitori`],
	];
	return (
		<Paper sx={{ p: 1.5, mb: 2, display: "flex", flexWrap: "wrap", gap: { xs: 1.5, sm: 3 }, alignItems: "baseline" }}>
			<Typography sx={{ fontWeight: 700 }}>Consegne di {monthName(v.month)}</Typography>
			{items.map(([t, val]) => (
				<Box key={t}>
					<Typography component="span" variant="caption" color="text.secondary">{t} </Typography>
					<Typography component="span" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{val}</Typography>
				</Box>
			))}
		</Paper>
	);
}

function SupplierRow({ s }: { s: Supplier }) {
	const diff = diffOf(s);
	return (
		<Box
			component={Link} to={supplierPath(s.supplier)}
			sx={{
				display: "grid", gridTemplateColumns: { xs: "1fr auto", sm: "minmax(160px, 1.4fr) 1fr 1fr 1fr auto" }, gap: 1, alignItems: "center",
				px: 1.5, py: 1, color: "inherit", textDecoration: "none", borderTop: 1, borderColor: "divider",
				"&:hover": { bgcolor: "action.hover" },
			}}
		>
			<Box sx={{ minWidth: 0 }}>
				<Typography variant="body2" sx={{ fontWeight: 600 }}>{s.supplier}</Typography>
				<Typography variant="caption" color="text.secondary">Binario {s.track}{s.openItems ? ` · ${s.openItems} da decidere` : ""}</Typography>
			</Box>
			<Box sx={{ display: { xs: "none", sm: "block" } }}>
				<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Previsto</Typography>
				<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{eur(s.expected)}</Typography>
			</Box>
			<Box sx={{ display: { xs: "none", sm: "block" } }}>
				<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Fattura</Typography>
				<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{eur(s.invoiced)}</Typography>
			</Box>
			<Box sx={{ display: { xs: "none", sm: "block" } }}>
				<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Differenza</Typography>
				<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: diff ? 700 : 400 }}>{diff === null ? "–" : signedEur(diff)}</Typography>
			</Box>
			<Chip size="small" color={COST[s.costState].tone} variant={s.costState === "no_invoice" ? "outlined" : "filled"} label={COST[s.costState].label} />
		</Box>
	);
}

const GROUPS: { key: string; title: string; help: string; test: (s: Supplier) => boolean }[] = [
	{ key: "open", title: "Da decidere", help: "La fattura non coincide e c'è almeno uno scostamento aperto: per ora si carica solo il costo previsto.", test: (s) => s.invoiced !== null && s.openItems > 0 },
	{ key: "ok", title: "Pronti", help: "La fattura torna, o tutti gli scostamenti sono decisi: si può caricare il costo effettivo.", test: (s) => s.costState === "actual_ready" },
	{ key: "missing", title: "In attesa della fattura", help: "La fattura del mese non è ancora arrivata.", test: (s) => s.invoiced === null },
];

export function MonthPage() {
	const [picked, setPicked] = useState("");
	const { months, month, view } = useMonth(picked);

	if (months.isLoading) return <CircularProgress />;
	if (months.isError) return <Alert severity="error">Impossibile caricare i mesi.</Alert>;
	if (!months.data?.length) return <Alert severity="info">Non è ancora stato caricato nessun mese.</Alert>;
	if (view.isFetching && !view.data) return <CircularProgress />;
	if (view.isError || !view.data) return <Alert severity="error">Impossibile caricare il mese.</Alert>;
	const v = view.data;
	const seen = new Set<string>();

	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 1.5 }}>
				<TextField select label="Mese delle consegne" value={month} onChange={(e) => setPicked(e.target.value)} sx={{ minWidth: 220 }}>
					{months.data.map((m) => <MenuItem key={m.month} value={m.month}>{monthName(m.month)}{m.openItems ? ` · ${m.openItems} da decidere` : ""}</MenuItem>)}
				</TextField>
				<Typography variant="caption" color="text.secondary">
					Dati del {dateTime(v.extractedAt)}. Importi senza IVA. Il previsto è il nostro calcolo dalle consegne con l'accordo del fornitore.
				</Typography>
			</Box>
			<MonthStatus v={v} />
			{GROUPS.map((g) => {
				const list = v.suppliers.filter((s) => !seen.has(s.supplier) && g.test(s));
				list.forEach((s) => seen.add(s.supplier));
				if (!list.length) return null;
				list.sort((a, b) => Math.abs(diffOf(b) ?? 0) - Math.abs(diffOf(a) ?? 0) || a.supplier.localeCompare(b.supplier, "it"));
				return (
					<Box key={g.key} sx={{ mb: 2.5 }}>
						<Typography variant="h2" component="h2">{g.title} ({list.length})</Typography>
						<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{g.help}</Typography>
						<Paper sx={{ overflow: "hidden", "& > a:first-of-type": { borderTop: 0 } }}>
							{list.map((s) => <SupplierRow key={s.supplier} s={s} />)}
						</Paper>
					</Box>
				);
			})}
			{v.suppliers.some((s) => !seen.has(s.supplier)) && (
				<Box sx={{ mb: 2 }}>
					<Typography variant="h2" component="h2">Altri</Typography>
					<Paper sx={{ overflow: "hidden" }}>
						{v.suppliers.filter((s) => !seen.has(s.supplier)).map((s) => <SupplierRow key={s.supplier} s={s} />)}
					</Paper>
				</Box>
			)}
		</Box>
	);
}
