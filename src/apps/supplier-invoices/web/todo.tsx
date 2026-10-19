import { Alert, Box, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { OPEN_VERDICTS } from "../api/types";
import { GapCard, isOpenGap } from "./agreements";
import { date, eur, monthName, supplierPath } from "./format";
import { MonthStatus, useMonth } from "./month";
import { QueueCards } from "./queue";
import { ROLES, type Role, useRole } from "./roles";
import { useGetAgreementsQuery, useGetQueueQuery } from "./store";

function Section({ title, help, children }: { title: string; help: string; children: ReactNode }) {
	return (
		<Box component="section" sx={{ mb: 3 }}>
			<Typography variant="h2" component="h2">{title}</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{help}</Typography>
			{children}
		</Box>
	);
}

const linkSx = { color: "inherit", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;

export function TodoPage() {
	const [role, setRole] = useRole();
	const { view } = useMonth();
	const queue = useGetQueueQuery(true);
	const agreements = useGetAgreementsQuery();

	if (queue.isLoading || agreements.isLoading || view.isLoading) return <CircularProgress />;
	const open = (queue.data ?? []).filter((q) => OPEN_VERDICTS.includes(q.verdict));
	// Il responsabile vede tutto, dalla differenza più grande; la gestione operativa solo le richieste di supporto.
	const all = [...open].sort((x, y) => Math.abs(y.amount ?? 0) - Math.abs(x.amount ?? 0));
	const cs = all.filter((q) => q.owner === "CS");
	const states = agreements.data?.states ?? {};
	const gaps = (agreements.data?.suppliers ?? []).flatMap((a) => a.gaps.filter((g) => isOpenGap(g, states)).map((g) => ({ g, supplier: a.supplier })));
	const v = view.data;
	const ready = v?.suppliers.filter((s) => s.costState === "actual_ready") ?? [];
	const expectedOnly = v?.suppliers.filter((s) => s.costState === "expected_only") ?? [];
	const missing = v?.suppliers.filter((s) => s.costState === "no_invoice") ?? [];
	// Scostamenti e punti dell'accordo dello stesso fornitore stanno insieme: spesso sono la stessa questione vista dal mese e dalla regola.
	const supplierNames = [...new Set([...all.map((q) => q.supplier), ...gaps.map((x) => x.supplier)])];
	const bySupplier = supplierNames.map((supplier) => {
		const items = all.filter((q) => q.supplier === supplier);
		return {
			supplier, items, gapsOf: gaps.filter((x) => x.supplier === supplier).map((x) => x.g),
			total: items.reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0),
		};
	}).sort((a, b) => b.total - a.total || b.gapsOf.length - a.gapsOf.length || a.supplier.localeCompare(b.supplier, "it"));
	const show = (r: Role) => role === r || role === "referente";
	const count: Record<Role, number> = { responsabile: all.length + gaps.length, cs: cs.length, amministrazione: ready.length, referente: all.length + gaps.length };

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Chi sei? La pagina mostra solo quello che tocca a te.</Typography>
			<ToggleButtonGroup exclusive size="small" value={role} onChange={(_, r: Role | null) => r && setRole(r)} aria-label="Ruolo" sx={{ flexWrap: "wrap", mb: 0.5 }}>
				{(Object.keys(ROLES) as Role[]).map((r) => <ToggleButton key={r} value={r}>{ROLES[r].label} ({count[r]})</ToggleButton>)}
			</ToggleButtonGroup>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>{ROLES[role].help}</Typography>

			{v && <MonthStatus v={v} />}

			{show("responsabile") && (
				<Section
					title="Da decidere, fornitore per fornitore"
					help="Per ogni fornitore: gli scostamenti delle fatture e i punti aperti dell'accordo, dal fornitore che pesa di più. Per verificare una consegna si può chiedere supporto alla gestione operativa."
				>
					{bySupplier.length ? (
						<Box sx={{ display: "grid", gap: 2.5 }}>
							{bySupplier.map(({ supplier, items, gapsOf, total }) => (
								<Box key={supplier}>
									<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 1 }}>
										<Typography variant="h2" component="h3" sx={{ fontSize: 17 }}>
											<Box component={Link} to={supplierPath(supplier)} sx={linkSx}>{supplier}</Box>
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{[items.length ? `${items.length} ${items.length === 1 ? "scostamento" : "scostamenti"}` : "", gapsOf.length ? `${gapsOf.length} ${gapsOf.length === 1 ? "punto aperto" : "punti aperti"}` : "", total ? `${eur(total)} in fattura` : ""].filter(Boolean).join(" · ")}
										</Typography>
									</Box>
									<Box sx={{ display: "grid", gap: 1.5 }}>
										{items.length > 0 && <QueueCards items={items} showSupplier={false} showMonth empty="" />}
										{gapsOf.map((g) => <GapCard key={g.id} g={g} state={states[g.id]} />)}
									</Box>
								</Box>
							))}
						</Box>
					) : <Typography variant="body2" color="text.secondary">Niente da decidere.</Typography>}
				</Section>
			)}
			{role === "cs" && (
				<Section title="Richieste di supporto" help="Verifiche per cui il responsabile fornitori ha chiesto aiuto: di solito una consegna da controllare (note, chat, farmacia). Si scrive cosa si è trovato e si sceglie il verdetto, oppure si riporta la riga al responsabile.">
					<QueueCards items={cs} showMonth empty="Nessuna richiesta di supporto aperta." />
				</Section>
			)}
			{show("amministrazione") && v && (
				<Section title={`Costi di ${monthName(v.month)}`} help="Il costo effettivo si carica nel backadmin solo quando la fattura torna o tutti i suoi scostamenti sono decisi; altrimenti resta il previsto.">
					<Paper sx={{ p: 2 }}>
						<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Costo effettivo pronto da caricare ({ready.length})</Typography>
						{ready.length ? (
							<Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
								{ready.map((s) => (
									<Typography key={s.supplier} component="li" variant="body2">
										<Box component={Link} to={supplierPath(s.supplier)} sx={linkSx}>{s.supplier}</Box>: {eur(s.invoiced)}
										{s.invoices.length ? ` (fattura ${s.invoices.map((i) => `${i.number} del ${date(i.date)}`).join(", ")})` : ""}
									</Typography>
								))}
							</Box>
						) : <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Nessuno.</Typography>}
						<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Resta il costo previsto ({expectedOnly.length})</Typography>
						{expectedOnly.length ? (
							<Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
								{expectedOnly.map((s) => (
									<Typography key={s.supplier} component="li" variant="body2">
										<Box component={Link} to={supplierPath(s.supplier)} sx={linkSx}>{s.supplier}</Box>: previsto {eur(s.expected)}, fattura {eur(s.invoiced)}, {s.openItems} da decidere
									</Typography>
								))}
							</Box>
						) : <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Nessuno.</Typography>}
						<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Fatture che aspettiamo ({missing.length})</Typography>
						<Typography variant="body2" color="text.secondary">{missing.map((s) => s.supplier).join(", ") || "Nessuna."}</Typography>
					</Paper>
				</Section>
			)}
			{!v && <Alert severity="info">Non è ancora stato caricato nessun mese.</Alert>}
		</Box>
	);
}
