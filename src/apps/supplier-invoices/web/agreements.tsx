import {
	Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, CircularProgress, Paper, Table, TableBody, TableCell,
	TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { useState } from "react";
import type { AgreementGap, AgreementStatus, SupplierAgreement } from "../api/types";
import { dateTime } from "./format";
import { useGetAgreementsQuery } from "./store";

type Tone = "success" | "warning" | "error" | "info" | "default";
const STATUS: Record<AgreementStatus, { label: string; tone: Tone }> = {
	da_contestare: { label: "Da contestare", tone: "error" },
	da_chiarire: { label: "Da chiarire", tone: "warning" },
	senza_accordo: { label: "Senza accordo scritto", tone: "info" },
	allineato: { label: "Allineato", tone: "success" },
};
const ORDER: AgreementStatus[] = ["da_contestare", "da_chiarire", "senza_accordo", "allineato"];
const GAP_TYPE: Record<AgreementGap["type"], string> = {
	contestare: "Contestare",
	chiarire: "Chiarire",
	aggiornare: "Aggiornare l'accordo",
};

function Bullets({ items }: { items: string[] }) {
	if (!items.length) return <Typography variant="body2" color="text.secondary">–</Typography>;
	return (
		<Box component="ul" sx={{ m: 0, pl: 2.5 }}>
			{items.map((t) => <Typography key={t} component="li" variant="body2" sx={{ mb: 0.5 }}>{t}</Typography>)}
		</Box>
	);
}

function Supplier({ a }: { a: SupplierAgreement }) {
	return (
		<Accordion disableGutters sx={{ "&:before": { display: "none" } }}>
			<AccordionSummary sx={{ "& .MuiAccordionSummary-content": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 } }}>
				<Typography sx={{ fontWeight: 600 }}>{a.supplier}</Typography>
				<Chip size="small" color={STATUS[a.status].tone} label={STATUS[a.status].label} />
				{a.gaps.length > 0 && (
					<Typography variant="caption" color="text.secondary">
						{a.gaps.length} {a.gaps.length === 1 ? "punto" : "punti"} da sistemare
					</Typography>
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
					<TableContainer component={Paper} sx={{ mb: a.ask ? 2 : 0 }}>
						<Table size="small" aria-label={`Punti da sistemare con ${a.supplier}`}>
							<TableHead>
								<TableRow>
									<TableCell>Punto</TableCell>
									<TableCell>Noi</TableCell>
									<TableCell>Loro</TableCell>
									<TableCell>Quanto vale</TableCell>
									<TableCell>Cosa fare</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{a.gaps.map((g) => (
									<TableRow key={g.topic} sx={{ verticalAlign: "top" }}>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 150 }}>
											<Typography variant="body2" sx={{ fontWeight: 600 }}>{g.topic}</Typography>
											<Typography variant="caption" color="text.secondary">Fonte: {g.evidence}</Typography>
										</TableCell>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 120 }}>{g.ours}</TableCell>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 120 }}>{g.theirs}</TableCell>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 120 }}>{g.impact}</TableCell>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 220 }}>
											<Chip size="small" variant="outlined" label={GAP_TYPE[g.type]} sx={{ mb: 0.5 }} />
											<Typography variant="body2">{g.action}</Typography>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
				{a.ask && <Alert severity="info" icon={false}><b>Prossimo passo:</b> {a.ask}</Alert>}
			</AccordionDetails>
		</Accordion>
	);
}

export function AgreementsPage() {
	const { data: d, isLoading, isError, error } = useGetAgreementsQuery();
	const [filter, setFilter] = useState<"" | AgreementStatus>("");
	if (isLoading) return <CircularProgress />;
	if (isError || !d) {
		const notYet = error && "status" in error && error.status === 404;
		return <Alert severity={notYet ? "info" : "error"}>{notYet ? "Non sono ancora stati caricati gli accordi." : "Impossibile caricare gli accordi."}</Alert>;
	}
	const suppliers = [...d.suppliers]
		.sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || y.gaps.length - x.gaps.length || x.supplier.localeCompare(y.supplier, "it"))
		.filter((s) => !filter || s.status === filter);
	const count = (s: AgreementStatus) => d.suppliers.filter((x) => x.status === s).length;

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				Per il responsabile dei rapporti con i fornitori. Per ogni fornitore: cosa prevede il nostro accordo, cosa applica davvero
				(ricavato dalle sue fatture e dai suoi file) e cosa va sistemato. L'obiettivo è poter prevedere il costo esatto di ogni mese e
				ridiscutere le voci che nessuno ha concordato. Le correzioni decise vanno scritte nel Registro Accordi Fornitori.
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
				Analisi del {dateTime(d.extractedAt)}. Fonti: {d.source}.
			</Typography>

			{d.themes.length > 0 && (
				<>
					<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Temi che riguardano più fornitori</Typography>
					<Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1.5, mb: 3 }}>
						{d.themes.map((t) => (
							<Paper key={t.title} sx={{ p: 2 }}>
								<Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t.title}</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}>{t.detail}</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}><b>Quanto vale:</b> {t.impact}</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}><b>Cosa fare:</b> {t.action}</Typography>
								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
									{t.suppliers.map((s) => <Chip key={s} size="small" variant="outlined" label={s} />)}
								</Box>
							</Paper>
						))}
					</Box>
				</>
			)}

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Fornitore per fornitore</Typography>
			<ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v !== null && setFilter(v)} aria-label="Stato" sx={{ flexWrap: "wrap", mb: 1.5 }}>
				<ToggleButton value="">Tutti ({d.suppliers.length})</ToggleButton>
				{ORDER.filter((s) => count(s)).map((s) => <ToggleButton key={s} value={s}>{STATUS[s].label} ({count(s)})</ToggleButton>)}
			</ToggleButtonGroup>
			<Paper>
				{suppliers.map((a) => <Supplier key={a.supplier} a={a} />)}
			</Paper>
		</Box>
	);
}
