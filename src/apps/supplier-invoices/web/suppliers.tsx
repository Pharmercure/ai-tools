import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import { Link, useParams } from "react-router";
import { OPEN_VERDICTS } from "../api/types";
import { AgreementSummary, GapCard, isOpenGap } from "./agreements";
import { COST, OUTCOME, date, dateTime, eur, monthName, signedEur, toClarify } from "./format";
import { usePaths } from "./links";
import { CostStatus } from "./costs";
import { diffOf, useMonth } from "./month";
import { QueueCards } from "./queue";
import { failed, useGetAgreementsQuery, useGetQueueQuery } from "./store";
import { UbmPage } from "./ubm";

const UBM = "UBM Bologna";

export function SuppliersPage() {
	const paths = usePaths();
	const { months, view } = useMonth();
	const queue = useGetQueueQuery(true);
	const agreements = useGetAgreementsQuery();
	if (view.isLoading || queue.isLoading || agreements.isLoading) return <CircularProgress />;
	if ([months, view, queue, agreements].some(failed)) return <Alert severity="error">Impossibile caricare i dati: riprova o ricarica la pagina.</Alert>;
	const states = agreements.data?.states ?? {};
	const names = [...new Set([
		...(view.data?.suppliers.map((s) => s.supplier) ?? []),
		...(agreements.data?.suppliers.map((a) => a.supplier) ?? []),
		...(queue.data?.map((q) => q.supplier) ?? []),
	])].sort((a, b) => a.localeCompare(b, "it"));
	const rows = names.map((n) => {
		const m = view.data?.suppliers.find((s) => s.supplier === n);
		const a = agreements.data?.suppliers.find((x) => x.supplier === n);
		const open = (queue.data ?? []).filter((q) => q.supplier === n && OPEN_VERDICTS.includes(q.verdict)).length
			+ (a?.gaps.filter((g) => isOpenGap(g, states)).length ?? 0);
		return { n, m, a, open };
	}).sort((x, y) => y.open - x.open || x.n.localeCompare(y.n, "it"));

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
				Ogni fornitore ha una pagina con il mese in corso, quello che c'è da decidere, il suo accordo e lo storico delle decisioni.
				{view.data ? ` Stato del mese: ${monthName(view.data.month)}.` : ""}
			</Typography>
			<Paper sx={{ overflow: "hidden" }}>
				{rows.map(({ n, m, a, open }, i) => (
					<Box
						key={n} component={Link} to={paths.supplier(n)}
						sx={{
							display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, px: 1.5, py: 1.1, color: "inherit", textDecoration: "none",
							borderTop: i ? 1 : 0, borderColor: "divider", "&:hover": { bgcolor: "action.hover" },
						}}
					>
						<Box sx={{ flex: 1, minWidth: 180 }}>
							<Typography variant="body2" sx={{ fontWeight: 600 }}>{n}</Typography>
							<Typography variant="caption" color="text.secondary">
								{[m ? `Binario ${m.track}` : "", a && !a.writtenAgreement ? "senza accordo scritto" : "", n === UBM ? "carnet di tagliandi" : ""].filter(Boolean).join(" · ")}
							</Typography>
						</Box>
						{open > 0 && <Chip size="small" color="warning" label={`${open} da decidere`} />}
						{m && <Chip size="small" variant={m.costState === "no_invoice" ? "outlined" : "filled"} color={COST[m.costState].tone} label={COST[m.costState].label} />}
					</Box>
				))}
			</Paper>
		</Box>
	);
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
			<Typography sx={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 700 : 500 }}>{value}</Typography>
		</Box>
	);
}

export function SupplierPage() {
	const name = useParams()["*"] ?? "";
	const paths = usePaths();
	const { months, view } = useMonth();
	const queue = useGetQueueQuery(false);
	const agreements = useGetAgreementsQuery();
	if (view.isLoading || queue.isLoading || agreements.isLoading) return <CircularProgress />;
	if ([months, view, queue, agreements].some(failed)) return <Alert severity="error">Impossibile caricare i dati: riprova o ricarica la pagina.</Alert>;

	const m = view.data?.suppliers.find((s) => s.supplier === name);
	const a = agreements.data?.suppliers.find((x) => x.supplier === name);
	const states = agreements.data?.states ?? {};
	const items = (queue.data ?? []).filter((q) => q.supplier === name);
	const openItems = items.filter((q) => OPEN_VERDICTS.includes(q.verdict));
	const doneItems = items.filter((q) => !OPEN_VERDICTS.includes(q.verdict));
	const openGaps = a?.gaps.filter((g) => isOpenGap(g, states)) ?? [];
	const doneGaps = a?.gaps.filter((g) => !isOpenGap(g, states)) ?? [];
	if (!m && !a && !items.length) return <Alert severity="info">Nessun dato per «{name}». <Link to={paths.page("suppliers")}>Torna ai fornitori</Link></Alert>;
	const diff = m ? diffOf(m) : null;
	const clarify = m && view.data ? toClarify(view.data.queue, m.supplier) : 0;

	return (
		<Box>
			<Box component={Link} to={paths.page("suppliers")} sx={{ fontSize: 13, color: "text.secondary", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>← Tutti i fornitori</Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: 0.5, mb: 2 }}>
				<Typography variant="h1" component="h2" sx={{ fontSize: 22 }}>{name}</Typography>
				{m && <Chip size="small" variant="outlined" label={`Binario ${m.track}`} title={m.track === "A" ? "Il 1° del mese gli mandiamo noi il riepilogo da fatturare" : "Aspettiamo la fattura e la confrontiamo con il nostro calcolo"} />}
				{a && !a.writtenAgreement && <Chip size="small" color="info" variant="outlined" label="Senza accordo scritto" />}
			</Box>

			{m && view.data && (
				<Box component="section" sx={{ mb: 3 }}>
					<Typography variant="h2" component="h3" sx={{ mb: 1 }}>Consegne di {monthName(view.data.month)}</Typography>
					<Paper sx={{ p: 2 }}>
						<Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 2, mb: 1.5 }}>
							<Line label="Previsto (nostro calcolo)" value={eur(m.expected)} />
							<Line label="Fattura" value={eur(m.invoiced)} />
							<Line label={diff !== null && diff < 0 ? "Differenza (a nostro favore)" : "Differenza"} value={diff === null ? "–" : signedEur(diff)} />
							<Line label="Da chiarire" value={clarify ? eur(clarify) : "–"} strong={clarify > 0} />
						</Box>
						<Box sx={{ mb: 1.5, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
							<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>Costo effettivo</Typography>
							<CostStatus month={view.data.month} s={m} />
						</Box>
						<Typography variant="body2" sx={{ mb: 0.5 }}>
							<b>{OUTCOME[m.outcome].label}.</b>{" "}
							{m.invoices.length ? `Fattura ${m.invoices.map((i) => `${i.number} del ${date(i.date)}`).join(", ")}, intestata a ${m.invoiceName}.` : `Fattura intestata a ${m.invoiceName || "–"}.`}
						</Typography>
						{Object.keys(m.deliveries).length > 0 && (
							<Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
								Consegne: {Object.entries(m.deliveries).map(([k, n]) => `${n} ${k}`).join(" · ")}
							</Typography>
						)}
						{m.expectedNote && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Come si calcola: {m.expectedNote}</Typography>}
					</Paper>
				</Box>
			)}

			<Box component="section" sx={{ mb: 3 }}>
				<Typography variant="h2" component="h3" sx={{ mb: 1 }}>Da decidere ({openItems.length + openGaps.length})</Typography>
				{!openItems.length && !openGaps.length && <Typography variant="body2" color="text.secondary">Niente di aperto per questo fornitore.</Typography>}
				<Box sx={{ display: "grid", gap: 1.5 }}>
					{openItems.length > 0 && <QueueCards items={openItems} showSupplier={false} showMonth empty="" />}
					{openGaps.map((g) => <GapCard key={g.id} g={g} state={states[g.id]} />)}
				</Box>
			</Box>

			{a && (
				<Box component="section" sx={{ mb: 3 }}>
					<Typography variant="h2" component="h3" sx={{ mb: 1 }}>Accordo</Typography>
					<AgreementSummary a={a} />
					{agreements.data && <Typography variant="caption" color="text.secondary">Analisi del {dateTime(agreements.data.extractedAt)}.</Typography>}
				</Box>
			)}

			{name === UBM && (
				<Box component="section" sx={{ mb: 3 }}>
					<Typography variant="h2" component="h3" sx={{ mb: 1 }}>Tagliandi</Typography>
					<UbmPage />
				</Box>
			)}

			{(doneItems.length > 0 || doneGaps.length > 0) && (
				<Accordion disableGutters>
					<AccordionSummary><Typography variant="body2" sx={{ fontWeight: 600 }}>Già deciso ({doneItems.length + doneGaps.length})</Typography></AccordionSummary>
					<AccordionDetails>
						<Box sx={{ display: "grid", gap: 1.5 }}>
							{doneItems.length > 0 && <QueueCards items={doneItems} showSupplier={false} showMonth empty="" />}
							{doneGaps.map((g) => <GapCard key={g.id} g={g} state={states[g.id]} />)}
						</Box>
					</AccordionDetails>
				</Accordion>
			)}
		</Box>
	);
}
