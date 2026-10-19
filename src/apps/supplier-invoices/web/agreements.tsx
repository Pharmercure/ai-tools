import {
	Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Paper, TextField,
	ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { useState } from "react";
import type { AgreementGap, AgreementItemState, AgreementItemStatus, SupplierAgreement } from "../api/types";
import { dateTime } from "./format";
import { useGetAgreementLogQuery, useGetAgreementsQuery, useUpdateAgreementItemMutation } from "./store";

const STATUS: Record<AgreementItemStatus, { label: string; tone: "warning" | "info" | "success" }> = {
	aperto: { label: "Aperto", tone: "warning" },
	in_discussione: { label: "In discussione", tone: "info" },
	chiuso: { label: "Chiuso", tone: "success" },
};

const FIELD_LABEL: Record<string, string> = { status: "stato", outcome: "esito" };
const valueLabel = (field: string, v: string | null) =>
	!v ? "vuoto" : field === "status" ? STATUS[v as AgreementItemStatus]?.label ?? v : v;

function Bullets({ items }: { items: string[] }) {
	if (!items.length) return <Typography variant="body2" color="text.secondary">–</Typography>;
	return (
		<Box component="ul" sx={{ m: 0, pl: 2.5 }}>
			{items.map((t) => <Typography key={t} component="li" variant="body2" sx={{ mb: 0.5 }}>{t}</Typography>)}
		</Box>
	);
}

function Fact({ label, children }: { label: string; children: string }) {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
			<Typography variant="body2">{children}</Typography>
		</Box>
	);
}

function History({ id }: { id: string }) {
	const { data, isLoading, isError } = useGetAgreementLogQuery(id);
	if (isLoading) return <CircularProgress size={16} />;
	if (isError || !data) return <Typography variant="body2" color="error">Storico non disponibile.</Typography>;
	if (!data.length) return <Typography variant="body2" color="text.secondary">Nessuna modifica.</Typography>;
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

function Gap({ g, state }: { g: AgreementGap; state: AgreementItemState | undefined }) {
	const [update, { isLoading: saving, error }] = useUpdateAgreementItemMutation();
	const status = state?.status ?? "aperto";
	const [outcome, setOutcome] = useState(state?.outcome ?? "");
	const [showLog, setShowLog] = useState(false);
	const errText = error && "data" in error ? (error.data as { error?: string })?.error : undefined;

	return (
		<Paper sx={{ p: 2 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
				<Typography sx={{ fontWeight: 600 }}>{g.topic}</Typography>
				<Chip size="small" color={STATUS[status].tone} label={STATUS[status].label} />
			</Box>
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 1.5 }}>
				<Fact label="Il nostro accordo">{g.ours}</Fact>
				<Fact label="Cosa applica il fornitore">{g.theirs}</Fact>
				<Fact label="Quanto vale">{g.impact}</Fact>
				<Fact label="Da dove lo sappiamo">{g.evidence}</Fact>
			</Box>
			<Typography variant="body2" sx={{ mb: 1.5 }}><b>Domanda aperta:</b> {g.question}</Typography>

			<ToggleButtonGroup
				exclusive size="small" value={status} disabled={saving} aria-label="Stato del punto" sx={{ mb: 1 }}
				onChange={(_, v: AgreementItemStatus | null) => v && v !== status && void update({ id: g.id, status: v, ...(v === "chiuso" ? { outcome } : {}) })}
			>
				{(Object.keys(STATUS) as AgreementItemStatus[]).map((s) => <ToggleButton key={s} value={s}>{STATUS[s].label}</ToggleButton>)}
			</ToggleButtonGroup>
			<Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
				<TextField
					label="Esito" multiline minRows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} sx={{ flex: 1, minWidth: 240 }}
					placeholder="Com'è andata: cosa è stato concordato o deciso, con chi e da quando vale"
					helperText="Serve per chiudere il punto. L'esito è la regola da riportare nel Registro Accordi."
				/>
				<Button variant="outlined" disabled={saving || outcome.trim() === (state?.outcome ?? "")} onClick={() => void update({ id: g.id, outcome })}>
					Salva esito
				</Button>
			</Box>
			{error && <Alert severity="error" sx={{ mt: 1 }}>{errText ?? "Modifica non salvata: riprova o ricarica la pagina."}</Alert>}
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
				{state?.updatedBy && (
					<Typography variant="caption" color="text.secondary">Ultima modifica {dateTime(state.updatedAt)} di {state.updatedBy}</Typography>
				)}
				<Box component="button" type="button" onClick={() => setShowLog((v) => !v)}
					sx={{ all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 }}>
					{showLog ? "Nascondi storico" : "Storico"}
				</Box>
			</Box>
			{showLog && <Box sx={{ mt: 1 }}><History id={g.id} /></Box>}
		</Paper>
	);
}

const openCount = (a: SupplierAgreement, states: Record<string, AgreementItemState>) =>
	a.gaps.filter((g) => (states[g.id]?.status ?? "aperto") !== "chiuso").length;

function Supplier({ a, states }: { a: SupplierAgreement; states: Record<string, AgreementItemState> }) {
	const open = openCount(a, states);
	return (
		<Accordion disableGutters sx={{ "&:before": { display: "none" } }}>
			<AccordionSummary sx={{ "& .MuiAccordionSummary-content": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 } }}>
				<Typography sx={{ fontWeight: 600 }}>{a.supplier}</Typography>
				{!a.writtenAgreement && <Chip size="small" color="info" variant="outlined" label="Senza accordo scritto" />}
				{a.gaps.length > 0 && (
					<Chip size="small" color={open ? "warning" : "success"}
						label={open ? `${open} ${open === 1 ? "punto aperto" : "punti aperti"}` : "Tutti i punti chiusi"} />
				)}
			</AccordionSummary>
			<AccordionDetails>
				<Typography variant="body2" sx={{ mb: 2 }}>{a.summary}</Typography>
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2 }}>
					<Box>
						<Typography variant="h2" component="h4" sx={{ mb: 0.5 }}>Cosa prevede il nostro accordo</Typography>
						<Bullets items={a.ours} />
					</Box>
					<Box>
						<Typography variant="h2" component="h4" sx={{ mb: 0.5 }}>Cosa applica il fornitore</Typography>
						<Bullets items={a.observed} />
					</Box>
				</Box>
				{a.gaps.length > 0 && (
					<Box sx={{ display: "grid", gap: 1.5 }}>
						{a.gaps.map((g) => <Gap key={g.id} g={g} state={states[g.id]} />)}
					</Box>
				)}
			</AccordionDetails>
		</Accordion>
	);
}

export function AgreementsPage() {
	const { data: d, isLoading, isError, error } = useGetAgreementsQuery();
	const [onlyOpen, setOnlyOpen] = useState(true);
	if (isLoading) return <CircularProgress />;
	if (isError || !d) {
		const notYet = error && "status" in error && error.status === 404;
		return <Alert severity={notYet ? "info" : "error"}>{notYet ? "Non sono ancora stati caricati gli accordi." : "Impossibile caricare gli accordi."}</Alert>;
	}
	const withOpen = d.suppliers.filter((a) => openCount(a, d.states) > 0 || !a.writtenAgreement);
	const suppliers = [...(onlyOpen ? withOpen : d.suppliers)]
		.sort((x, y) => openCount(y, d.states) - openCount(x, d.states) || x.supplier.localeCompare(y.supplier, "it"));

	return (
		<Box>
			<Typography variant="body2" sx={{ mb: 1 }}>
				Per il responsabile dei rapporti con i fornitori. Qui ci sono i punti in cui quello che il fornitore applica non coincide
				con il nostro accordo scritto, con i fatti e quanto valgono. Finché un punto è aperto non possiamo prevedere il costo
				esatto di quel fornitore.
			</Typography>
			<Typography variant="body2" sx={{ mb: 1 }}>
				Quando un punto è chiarito, scrivi l'esito e chiudilo. L'esito chiuso è la regola che vale da lì in avanti: va riportata
				nel Registro Accordi, da cui si calcola il previsto dei mesi successivi.
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
				Analisi del {dateTime(d.extractedAt)}. Fonti: {d.source}.
			</Typography>

			{d.themes.length > 0 && (
				<>
					<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Problemi che riguardano più fornitori</Typography>
					<Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1.5, mb: 3 }}>
						{d.themes.map((t) => (
							<Paper key={t.title} sx={{ p: 2 }}>
								<Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t.title}</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}>{t.detail}</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}><b>Quanto vale:</b> {t.impact}</Typography>
								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
									{t.suppliers.map((s) => <Chip key={s} size="small" variant="outlined" label={s} />)}
								</Box>
							</Paper>
						))}
					</Box>
				</>
			)}

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Fornitore per fornitore</Typography>
			<ToggleButtonGroup exclusive size="small" value={onlyOpen} onChange={(_, v) => v !== null && setOnlyOpen(v)} aria-label="Quali fornitori" sx={{ mb: 1.5 }}>
				<ToggleButton value={true}>Con punti aperti ({withOpen.length})</ToggleButton>
				<ToggleButton value={false}>Tutti ({d.suppliers.length})</ToggleButton>
			</ToggleButtonGroup>
			{suppliers.length ? (
				<Paper>{suppliers.map((a) => <Supplier key={a.supplier} a={a} states={d.states} />)}</Paper>
			) : (
				<Alert severity="success">Nessun punto aperto.</Alert>
			)}
		</Box>
	);
}
