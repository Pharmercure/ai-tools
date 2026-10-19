import {
	Alert, Box, Chip, CircularProgress, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
	TextField, Typography,
} from "@mui/material";
import { useState } from "react";
import type { MonthView } from "../api/types";
import { COST, OUTCOME, date, dateTime, eur, monthName, signedEur } from "./format";
import { QueueList } from "./queue";
import { useGetMonthQuery, useGetMonthsQuery } from "./store";

function Kpi({ title, value, note }: { title: string; value: string; note?: string }) {
	return (
		<Paper sx={{ p: "12px 14px" }}>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{title}</Typography>
			<Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
			{note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
		</Paper>
	);
}

function Month({ v }: { v: MonthView }) {
	const s = v.suppliers;
	const arrived = s.filter((x) => x.invoiced !== null);
	const ok = s.filter((x) => x.outcome === "ok").length;
	const open = v.queue.filter((q) => q.verdict === "da_verificare" || q.verdict === "non_verificabile");
	const missing = s.filter((x) => x.outcome === "missing");
	const expected = s.reduce((a, x) => a + (x.expected ?? 0), 0);
	const invoiced = arrived.reduce((a, x) => a + (x.invoiced ?? 0), 0);
	const sorted = [...s].sort((a, b) => Math.abs(b.invoiced !== null && b.expected !== null ? b.invoiced - b.expected : 0)
		- Math.abs(a.invoiced !== null && a.expected !== null ? a.invoiced - a.expected : 0) || a.supplier.localeCompare(b.supplier, "it"));

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				Consegne di {monthName(v.month)}. Dati calcolati il {dateTime(v.extractedAt)} ({v.source}), caricati da {v.loadedBy}.
				Gli importi sono imponibili, senza IVA.
			</Typography>

			<Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1.5, mb: 2 }}>
				<Kpi title="Fatture arrivate" value={`${arrived.length} su ${s.length}`} note={missing.length ? `${missing.length} ancora da ricevere` : "tutte arrivate"} />
				<Kpi title="Tornano col previsto" value={`${ok} su ${arrived.length}`} />
				<Kpi title="Scostamenti da decidere" value={String(open.length)}
					note={`CS ${open.filter((q) => q.owner === "CS").length} · Logistica ${open.filter((q) => q.owner === "Logistica").length}`} />
				<Kpi title="Previsto del mese" value={eur(expected)} note="fornitori con formula" />
				<Kpi title="Fatturato finora" value={eur(invoiced)} />
			</Box>

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Fornitori</Typography>
			<TableContainer component={Paper} sx={{ mb: 3 }}>
				<Table size="small" aria-label="Fornitori del mese">
					<TableHead>
						<TableRow>
							<TableCell>Fornitore</TableCell>
							<TableCell>Binario</TableCell>
							<TableCell align="right">Previsto</TableCell>
							<TableCell align="right">Fatturato</TableCell>
							<TableCell align="right">Differenza</TableCell>
							<TableCell>Esito</TableCell>
							<TableCell>Costo da caricare</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{sorted.map((x) => {
							const diff = x.invoiced !== null && x.expected !== null ? x.invoiced - x.expected : null;
							return (
								<TableRow key={x.supplier} hover>
									<TableCell sx={{ whiteSpace: "normal", minWidth: 170 }}>
										<Typography variant="body2" sx={{ fontWeight: 600 }}>{x.supplier}</Typography>
										<Typography variant="caption" color="text.secondary">
											{x.invoices.length ? x.invoices.map((i) => `${i.number} del ${date(i.date)}`).join(", ") : x.invoiceName}
										</Typography>
									</TableCell>
									<TableCell>{x.track}</TableCell>
									<TableCell align="right" title={x.expectedNote}>{eur(x.expected)}</TableCell>
									<TableCell align="right">{eur(x.invoiced)}</TableCell>
									<TableCell align="right" sx={{ fontWeight: diff ? 700 : 400 }}>{diff === null ? "–" : signedEur(diff)}</TableCell>
									<TableCell title={x.outcomeNote}>
										<Chip size="small" color={OUTCOME[x.outcome].tone} variant="outlined" label={OUTCOME[x.outcome].label} />
										{x.openItems > 0 && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{x.openItems} da decidere</Typography>}
									</TableCell>
									<TableCell>
										<Chip size="small" color={COST[x.costState].tone} label={COST[x.costState].label} />
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Coda di verifica del mese</Typography>
			<QueueList items={v.queue} />
		</Box>
	);
}

export function MonthPage() {
	const months = useGetMonthsQuery();
	const [picked, setPicked] = useState("");
	const month = picked || months.data?.[0]?.month || "";
	const view = useGetMonthQuery(month, { skip: !month });

	if (months.isLoading) return <CircularProgress />;
	if (months.isError) return <Alert severity="error">Impossibile caricare i mesi.</Alert>;
	if (!months.data?.length) return <Alert severity="info">Non è ancora stato caricato nessun mese.</Alert>;

	return (
		<Box>
			<TextField select label="Mese delle consegne" value={month} onChange={(e) => setPicked(e.target.value)} sx={{ minWidth: 220, mb: 2 }}>
				{months.data.map((m) => (
					<MenuItem key={m.month} value={m.month}>
						{monthName(m.month)}{m.openItems ? ` · ${m.openItems} da decidere` : ""}
					</MenuItem>
				))}
			</TextField>
			{view.isFetching && !view.data ? <CircularProgress /> : view.isError || !view.data ? (
				<Alert severity="error">Impossibile caricare il mese.</Alert>
			) : <Month v={view.data} />}
		</Box>
	);
}
