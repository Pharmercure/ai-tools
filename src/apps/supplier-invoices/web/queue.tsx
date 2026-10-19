import {
	Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, TextField,
	ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { useState } from "react";
import { OPEN_VERDICTS, OWNERS, type Owner, type QueueItem, VERDICTS, type Verdict } from "../api/types";
import { OWNER_HELP, VERDICT, dateTime, monthName, signedEur } from "./format";
import { useGetLogQuery, useGetQueueQuery, useUpdateItemMutation } from "./store";

const FIELD_LABEL: Record<string, string> = { verdict: "verdetto", owner: "chi", note: "nota" };
const valueLabel = (field: string, v: string | null) =>
	v === null || v === "" ? "vuoto" : field === "verdict" ? VERDICT[v as Verdict]?.label ?? v : v;

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

export function QueueCard({ item, showMonth }: { item: QueueItem; showMonth?: boolean }) {
	const [update, { isLoading: saving, error }] = useUpdateItemMutation();
	const [note, setNote] = useState(item.note);
	const [showLog, setShowLog] = useState(false);
	const closed = !OPEN_VERDICTS.includes(item.verdict);
	const save = (body: { verdict?: Verdict; owner?: Owner; note?: string }) => void update({ id: item.id, ...body });

	return (
		<Paper sx={{ p: 2, opacity: item.verdict === "ignorato" ? 0.6 : 1 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 0.5 }}>
				<Typography variant="h2" component="h3" sx={{ textDecoration: item.verdict === "ignorato" ? "line-through" : "none" }}>
					{item.supplier}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{[showMonth ? monthName(item.month) : "", item.invoice ? "fattura " + item.invoice : ""].filter(Boolean).join(" · ")}
				</Typography>
				<Box sx={{ flex: 1 }} />
				<Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} title="Positivo: il fornitore chiede più di quanto calcolato da noi">
					{item.amount === null ? "importo da capire" : signedEur(item.amount)}
				</Typography>
			</Box>
			<Typography variant="body2" sx={{ mb: 1, whiteSpace: "pre-wrap" }}>{item.check}</Typography>
			{item.deliveries && (
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, wordBreak: "break-word" }}>
					Consegne: {item.deliveries}
				</Typography>
			)}

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1 }}>
				<TextField
					select label="Chi controlla" value={item.owner} disabled={saving} sx={{ minWidth: 150 }}
					onChange={(e) => save({ owner: e.target.value as Owner })}
					helperText={OWNER_HELP[item.owner]}
				>
					{OWNERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
				</TextField>
			</Box>

			<ToggleButtonGroup
				exclusive size="small" value={item.verdict} disabled={saving} aria-label="Verdetto"
				onChange={(_, v: Verdict | null) => v && v !== item.verdict && save({ verdict: v })}
				sx={{ flexWrap: "wrap", mb: 0.5 }}
			>
				{VERDICTS.map((v) => <ToggleButton key={v} value={v} title={VERDICT[v].help}>{VERDICT[v].label}</ToggleButton>)}
			</ToggleButtonGroup>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
				{VERDICT[item.verdict].help}
			</Typography>

			<Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
				<TextField
					label="Nota" placeholder="Cosa hai verificato, con chi hai parlato, cosa si fa adesso"
					value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={1} sx={{ flex: 1, minWidth: 220 }}
				/>
				<Button variant="outlined" disabled={saving || note.trim() === item.note} onClick={() => save({ note })}>
					Salva nota
				</Button>
			</Box>
			{error && <Alert severity="error" sx={{ mt: 1 }}>Modifica non salvata: riprova o ricarica la pagina.</Alert>}

			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
				<Typography variant="caption" color="text.secondary">
					{item.updatedBy ? `Ultima modifica ${dateTime(item.updatedAt)} di ${item.updatedBy}` : `Creata ${dateTime(item.createdAt)}`}
					{closed ? " · decisa" : ""}
				</Typography>
				<Box component="button" type="button" onClick={() => setShowLog((s) => !s)}
					sx={{ all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 }}>
					{showLog ? "Nascondi storico" : "Storico"}
				</Box>
			</Box>
			{showLog && <Box sx={{ mt: 1 }}><History id={item.id} /></Box>}
		</Paper>
	);
}

type Filter = { owner: "" | Owner; open: boolean; supplier: string };

export function QueueList({ items, showMonth }: { items: QueueItem[]; showMonth?: boolean }) {
	const [f, setF] = useState<Filter>({ owner: "", open: true, supplier: "" });
	const suppliers = [...new Set(items.map((i) => i.supplier))].sort((a, b) => a.localeCompare(b, "it"));
	const shown = items.filter(
		(i) => (!f.owner || i.owner === f.owner) && (!f.open || OPEN_VERDICTS.includes(i.verdict)) && (!f.supplier || i.supplier === f.supplier),
	);
	const count = (o: Owner) => items.filter((i) => i.owner === o && OPEN_VERDICTS.includes(i.verdict)).length;

	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
				<ToggleButtonGroup exclusive size="small" value={f.owner} onChange={(_, v) => v !== null && setF({ ...f, owner: v })} aria-label="Chi controlla">
					<ToggleButton value="">Tutti</ToggleButton>
					<ToggleButton value="CS">CS ({count("CS")})</ToggleButton>
					<ToggleButton value="Logistica">Logistica ({count("Logistica")})</ToggleButton>
				</ToggleButtonGroup>
				<ToggleButtonGroup exclusive size="small" value={f.open} onChange={(_, v) => v !== null && setF({ ...f, open: v })} aria-label="Stato">
					<ToggleButton value={true}>Da decidere</ToggleButton>
					<ToggleButton value={false}>Tutte</ToggleButton>
				</ToggleButtonGroup>
				<TextField select label="Fornitore" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}
					sx={{ minWidth: 200 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
					<MenuItem value="">Tutti</MenuItem>
					{suppliers.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
				</TextField>
			</Box>
			{!shown.length ? (
				<Alert severity="success">
					{f.open ? "Niente da decidere con questi filtri." : "Nessuna riga con questi filtri."}
				</Alert>
			) : (
				<Box sx={{ display: "grid", gap: 1.5 }}>
					{shown.map((i) => <QueueCard key={i.id} item={i} showMonth={showMonth} />)}
				</Box>
			)}
		</Box>
	);
}

export function QueuePage() {
	const { data, isLoading, isError } = useGetQueueQuery(false);
	if (isLoading) return <CircularProgress />;
	if (isError || !data) return <Alert severity="error">Impossibile caricare la coda di verifica.</Alert>;
	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				Ogni scostamento fra una fattura e il nostro calcolo, di tutti i mesi. La riga dice chi deve controllarlo; se non è la
				persona giusta si cambia. Il verdetto e la nota li vedono tutti.
			</Typography>
			<Accordion disableGutters sx={{ mb: 2 }}>
				<AccordionSummary>
					<Typography variant="body2" sx={{ fontWeight: 600 }}>Cosa significano i verdetti</Typography>
				</AccordionSummary>
				<AccordionDetails>
					{VERDICTS.map((v) => (
						<Typography key={v} variant="body2" sx={{ mb: 0.5 }}>
							<Chip size="small" label={VERDICT[v].label} sx={{ mr: 1 }} />{VERDICT[v].help}
						</Typography>
					))}
					<Typography variant="body2" sx={{ mt: 1 }}>
						Finché un fornitore ha una riga "Da verificare" o "Serve il dettaglio" per un mese, per quel mese si carica solo il
						costo previsto, non quello effettivo. Non c'è una soglia sotto la quale si ignora: lo decide una persona.
					</Typography>
				</AccordionDetails>
			</Accordion>
			<QueueList items={data} showMonth />
		</Box>
	);
}
