import { Alert, Box, Button, Chip, CircularProgress, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router";
import type { AgreementGap, AgreementItemState, AgreementItemStatus, SupplierAgreement } from "../api/types";
import { dateTime } from "./format";
import { usePaths } from "./links";
import { useGetAgreementLogQuery, useUpdateAgreementItemMutation } from "./store";

export const ITEM_STATUS: Record<AgreementItemStatus, { label: string; tone: "warning" | "info" | "success" }> = {
	open: { label: "Aperto", tone: "warning" },
	in_discussion: { label: "In discussione", tone: "info" },
	closed: { label: "Chiuso", tone: "success" },
};

const FIELD_LABEL: Record<string, string> = { status: "stato", outcome: "esito" };
const valueLabel = (field: string, v: string | null) =>
	!v ? "vuoto" : field === "status" ? ITEM_STATUS[v as AgreementItemStatus]?.label ?? v : v;

export const isOpenGap = (g: AgreementGap, states: Record<string, AgreementItemState>) => (states[g.id]?.status ?? "open") !== "closed";

export function Bullets({ items }: { items: string[] }) {
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

const textButtonSx = { all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 } as const;

/** Un punto in cui ciò che applica il fornitore non coincide con il nostro accordo: fatti, domanda aperta, esito. */
export function GapCard({ g, state, supplier }: { g: AgreementGap; state: AgreementItemState | undefined; supplier?: string }) {
	const [update, { isLoading: saving, error }] = useUpdateAgreementItemMutation();
	const paths = usePaths();
	const status = state?.status ?? "open";
	const [outcome, setOutcome] = useState(state?.outcome ?? "");
	const [showLog, setShowLog] = useState(false);
	const errText = error && "data" in error ? (error.data as { error?: string })?.error : undefined;
	const closed = status === "closed";

	return (
		<Paper sx={{ p: 2 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 1 }}>
				{supplier && (
					<Typography variant="h2" component="h3">
						<Box component={Link} to={paths.supplier(supplier)} sx={{ color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{supplier}</Box>
					</Typography>
				)}
				<Typography sx={{ fontWeight: 600 }}>{g.topic}</Typography>
				<Box sx={{ flex: 1 }} />
				<Typography variant="body2" sx={{ fontWeight: 700 }}>{g.impact}</Typography>
			</Box>
			{closed ? (
				<Typography variant="body2" sx={{ mb: 1 }}><b>Esito:</b> {state?.outcome}</Typography>
			) : (
				<>
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 1.5 }}>
						<Fact label="Il nostro accordo">{g.ours}</Fact>
						<Fact label="Cosa applica il fornitore">{g.theirs}</Fact>
					</Box>
					<Typography variant="body2" sx={{ mb: 0.5 }}><b>Domanda aperta:</b> {g.question}</Typography>
					<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>Fonte: {g.evidence}</Typography>
				</>
			)}

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", mb: closed ? 0 : 1.5 }} role="group" aria-label="Stato del punto">
				{(Object.keys(ITEM_STATUS) as AgreementItemStatus[]).map((s) => (
					<Chip
						key={s} label={ITEM_STATUS[s].label} disabled={saving}
						color={status === s ? ITEM_STATUS[s].tone : "default"} variant={status === s ? "filled" : "outlined"}
						onClick={status === s ? undefined : () => void update({ id: g.id, status: s, ...(s === "closed" ? { outcome } : {}) })}
					/>
				))}
			</Box>
			{!closed && (
				<Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
					<TextField
						label="Esito" multiline minRows={1} value={outcome} onChange={(e) => setOutcome(e.target.value)} sx={{ flex: 1, minWidth: 240 }}
						placeholder="Com'è andata: cosa è stato concordato o deciso, con chi e da quando vale"
						helperText="Serve per chiudere il punto: è la regola che va nel Registro Accordi."
					/>
					<Button variant="outlined" disabled={saving || outcome.trim() === (state?.outcome ?? "")} onClick={() => void update({ id: g.id, outcome })}>Salva</Button>
				</Box>
			)}
			{error && <Alert severity="error" sx={{ mt: 1 }}>{errText ?? "Modifica non salvata: riprova o ricarica la pagina."}</Alert>}
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
				<Box component="button" type="button" onClick={() => setShowLog((v) => !v)} sx={textButtonSx}>{showLog ? "Nascondi storico" : "Storico"}</Box>
				<Box sx={{ flex: 1 }} />
				{state?.updatedBy && <Typography variant="caption" color="text.secondary">{dateTime(state.updatedAt)}, {state.updatedBy}</Typography>}
			</Box>
			{showLog && <Box sx={{ mt: 1 }}><History id={g.id} /></Box>}
		</Paper>
	);
}

/** Il nostro accordo e cosa applica il fornitore, uno accanto all'altro. */
export function AgreementSummary({ a }: { a: SupplierAgreement }) {
	return (
		<Paper sx={{ p: 2 }}>
			<Typography variant="body2" sx={{ mb: 1.5 }}>{a.summary}</Typography>
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
				<Box>
					<Typography variant="h2" component="h4" sx={{ mb: 0.5 }}>Il nostro accordo</Typography>
					<Bullets items={a.ours} />
				</Box>
				<Box>
					<Typography variant="h2" component="h4" sx={{ mb: 0.5 }}>Cosa applica il fornitore</Typography>
					<Bullets items={a.observed} />
				</Box>
			</Box>
		</Paper>
	);
}
