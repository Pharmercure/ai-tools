import { Alert, Box, Button, Chip, CircularProgress, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router";
import { OPEN_VERDICTS, type Owner, type QueueItem, type Verdict } from "../api/types";
import { OWNER_LABEL, VERDICT, VERDICT_ORDER, dateTime, monthName, signedEur } from "./format";
import { usePaths } from "./links";
import { useGetLogQuery, useUpdateItemMutation } from "./store";

const FIELD_LABEL: Record<string, string> = { verdict: "verdetto", owner: "in mano a", note: "nota" };
const valueLabel = (field: string, v: string | null) =>
	v === null || v === "" ? "vuoto" : field === "verdict" ? VERDICT[v as Verdict]?.label ?? v : field === "owner" ? OWNER_LABEL[v as Owner] ?? v : v;

function History({ id }: { id: string }) {
	const { data, isLoading, isError } = useGetLogQuery(id);
	if (isLoading) return <CircularProgress size={16} />;
	if (isError || !data) return <Typography variant="body2" color="error">Storico non disponibile.</Typography>;
	if (!data.length) return <Typography variant="body2" color="text.secondary">Nessuna modifica: la riga è come l'ha creata la routine.</Typography>;
	return (
		<Box component="ul" sx={{ m: 0, pl: 2.5 }}>
			{data.map((l, i) => (
				<Typography key={i} component="li" variant="body2">
					{dateTime(l.changedAt)}, {l.changedBy}: {FIELD_LABEL[l.field] ?? l.field} da «{valueLabel(l.field, l.oldValue)}» a «{valueLabel(l.field, l.newValue)}»
				</Typography>
			))}
		</Box>
	);
}

// Importo letto dal punto di vista di chi decide: quanto ci chiede il fornitore in più (o in meno) del nostro calcolo.
export function amountLabel(amount: number | null) {
	if (amount === null) return "importo da capire";
	if (amount === 0) return "nessuna differenza di importo";
	return amount > 0 ? `${signedEur(amount)} in fattura` : `${signedEur(amount)}, a nostro favore`;
}

const linkSx = { color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
const textButtonSx = { all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 } as const;

/** Una riga della coda: il problema con i fatti, poi la decisione in un clic. */
export function QueueCard({ item, showSupplier = true, showMonth = false }: { item: QueueItem; showSupplier?: boolean; showMonth?: boolean }) {
	const [update, { isLoading: saving, error }] = useUpdateItemMutation();
	const paths = usePaths();
	const [note, setNote] = useState(item.note);
	const [noteOpen, setNoteOpen] = useState(false);
	const [showLog, setShowLog] = useState(false);
	const open = OPEN_VERDICTS.includes(item.verdict);
	const save = (body: { verdict?: Verdict; owner?: Owner; note?: string }) => void update({ id: item.id, ...body });

	return (
		<Paper sx={{ p: 2, opacity: item.verdict === "ignored" ? 0.65 : 1 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 0.75 }}>
				{showSupplier && (
					<Typography variant="h2" component="h3">
						<Box component={Link} to={paths.supplier(item.supplier)} sx={linkSx}>{item.supplier}</Box>
					</Typography>
				)}
				<Typography variant="body2" color="text.secondary">
					{[showMonth ? monthName(item.month) : "", item.invoice ? "fattura " + item.invoice : ""].filter(Boolean).join(" · ")}
				</Typography>
				<Box sx={{ flex: 1 }} />
				<Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{amountLabel(item.amount)}</Typography>
			</Box>
			<Typography variant="body2" sx={{ mb: item.deliveries ? 0.75 : 1.5, whiteSpace: "pre-wrap" }}>{item.check}</Typography>
			{item.deliveries && (
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5, wordBreak: "break-word" }}>
					Consegne: {item.deliveries}
				</Typography>
			)}

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }} role="group" aria-label="Verdetto">
				{VERDICT_ORDER.filter((v) => v !== "to_check" || item.verdict === "to_check").map((v) => (
					<Chip
						key={v} label={VERDICT[v].label} title={VERDICT[v].help} disabled={saving}
						color={item.verdict === v ? VERDICT[v].tone : "default"} variant={item.verdict === v ? "filled" : "outlined"}
						onClick={item.verdict === v ? undefined : () => save({ verdict: v })}
					/>
				))}
			</Box>
			{!open && (
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>{VERDICT[item.verdict].help}</Typography>
			)}

			{(noteOpen || item.note) && (
				<Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap", mt: 1.5 }}>
					<TextField
						label="Nota" placeholder="Cosa hai verificato, con chi hai parlato" value={note}
						onChange={(e) => setNote(e.target.value)} multiline minRows={1} sx={{ flex: 1, minWidth: 220 }}
					/>
					<Button variant="outlined" disabled={saving || note.trim() === item.note} onClick={() => save({ note })}>Salva</Button>
				</Box>
			)}
			{error && <Alert severity="error" sx={{ mt: 1 }}>Modifica non salvata: riprova o ricarica la pagina.</Alert>}

			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 1.25 }}>
				{item.owner === "operations" ? (
					<>
						<Chip size="small" color="info" label="Supporto chiesto alla gestione operativa" />
						<Box component="button" type="button" sx={textButtonSx} disabled={saving} onClick={() => save({ owner: "supplier_owner" })}>Riporta al responsabile</Box>
					</>
				) : (
					<Box component="button" type="button" sx={textButtonSx} disabled={saving} onClick={() => save({ owner: "operations" })}>Chiedi supporto alla gestione operativa</Box>
				)}
				{!noteOpen && !item.note && <Box component="button" type="button" sx={textButtonSx} onClick={() => setNoteOpen(true)}>Aggiungi una nota</Box>}
				<Box component="button" type="button" sx={textButtonSx} onClick={() => setShowLog((v) => !v)}>{showLog ? "Nascondi storico" : "Storico"}</Box>
				<Box sx={{ flex: 1 }} />
				<Typography variant="caption" color="text.secondary">
					{item.updatedBy ? `${dateTime(item.updatedAt)}, ${item.updatedBy}` : `Creata il ${dateTime(item.createdAt)}`}
				</Typography>
			</Box>
			{showLog && <Box sx={{ mt: 1 }}><History id={item.id} /></Box>}
		</Paper>
	);
}

export function QueueCards({ items, showSupplier, showMonth, empty }: { items: QueueItem[]; showSupplier?: boolean; showMonth?: boolean; empty: string }) {
	if (!items.length) return <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{empty}</Typography>;
	return (
		<Box sx={{ display: "grid", gap: 1.5 }}>
			{items.map((i) => <QueueCard key={i.id} item={i} showSupplier={showSupplier} showMonth={showMonth} />)}
		</Box>
	);
}
