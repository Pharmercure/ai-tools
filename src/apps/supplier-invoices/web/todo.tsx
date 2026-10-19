import { Alert, Box, Chip, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { type AgreementGap, type AgreementItemState, type MonthView, OPEN_VERDICTS, type QueueItem } from "../api/types";
import { GapCard, ITEM_STATUS, isOpenGap } from "./agreements";
import { COST, date, eur, monthName, supplierPath } from "./format";
import { useMonth } from "./month";
import { QueueCards } from "./queue";
import { ROLES, type Role, useRole } from "./roles";
import { useGetAgreementsQuery, useGetQueueQuery } from "./store";

const linkSx = { color: "inherit", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
const num = { fontVariantNumeric: "tabular-nums" } as const;
const anchorOf = (supplier: string) => "f-" + supplier.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Section({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
	return (
		<Box component="section" sx={{ mb: 4 }}>
			<Typography variant="h2" component="h2">{title}</Typography>
			{help && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{help}</Typography>}
			{!help && <Box sx={{ mb: 1 }} />}
			{children}
		</Box>
	);
}

/** Un numero grande con la sua etichetta: si legge da lontano. */
function Tile({ label, value, sub, strong, to }: { label: string; value: string; sub?: string; strong?: boolean; to?: string }) {
	const body = (
		<>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</Typography>
			<Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2, ...num, color: strong ? "warning.main" : "text.primary" }}>{value}</Typography>
			{sub && <Typography variant="body2" color="text.secondary">{sub}</Typography>}
		</>
	);
	const sx = { p: 2, height: "100%", borderLeft: 4, borderColor: strong ? "warning.main" : "divider", display: "block", color: "inherit", textDecoration: "none" } as const;
	return to
		? <Paper component={Link} to={to} sx={{ ...sx, "&:hover": { bgcolor: "action.hover" } }}>{body}</Paper>
		: <Paper sx={sx}>{body}</Paper>;
}

const Tiles = ({ n, children }: { n: number; children: ReactNode }) => (
	<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: `repeat(${n}, 1fr)` }, gap: 1.5, mb: 3 }}>{children}</Box>
);

type Group = { supplier: string; items: QueueItem[]; gaps: AgreementGap[]; total: number };

// Scostamenti e punti dell'accordo dello stesso fornitore stanno insieme: spesso sono la stessa questione vista dal mese e dalla regola.
function groupBySupplier(items: QueueItem[], gaps: { g: AgreementGap; supplier: string }[]): Group[] {
	const names = [...new Set([...items.map((q) => q.supplier), ...gaps.map((x) => x.supplier)])];
	return names.map((supplier) => {
		const mine = items.filter((q) => q.supplier === supplier).sort((x, y) => Math.abs(y.amount ?? 0) - Math.abs(x.amount ?? 0));
		return { supplier, items: mine, gaps: gaps.filter((x) => x.supplier === supplier).map((x) => x.g), total: mine.reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0) };
	}).sort((a, b) => b.total - a.total || b.gaps.length - a.gaps.length || a.supplier.localeCompare(b.supplier, "it"));
}

// Il titolo breve di una riga di fattura: la prima frase del testo, senza i dettagli.
const shortTitle = (q: QueueItem) => {
	const first = q.check.split(/[.:;]/)[0].trim();
	return first.length > 70 ? first.slice(0, 67) + "…" : first;
};

/** La mappa di quello che c'è da fare: un fornitore per riga, cosa riguarda e quanto vale. */
function Overview({ groups, states, linkToDetail }: { groups: Group[]; states: Record<string, AgreementItemState>; linkToDetail: boolean }) {
	const go = (supplier: string) => document.getElementById(anchorOf(supplier))?.scrollIntoView({ behavior: "smooth", block: "start" });
	const cols = { xs: "1fr", md: "minmax(180px, 1.2fr) 3fr 120px 170px" };
	return (
		<Paper sx={{ overflow: "hidden" }}>
			<Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, gap: 2, px: 2, py: 1, bgcolor: "action.hover" }}>
				{["Fornitore", "Di cosa si tratta", "Da chiarire", "Stato"].map((h, i) => (
					<Typography key={h} variant="caption" color="text.secondary" sx={{ fontWeight: 700, textAlign: i === 2 ? "right" : "left" }}>{h}</Typography>
				))}
			</Box>
			{groups.map(({ supplier, items, gaps, total }) => {
				const topics = [...gaps.map((g) => g.topic), ...(gaps.length ? [] : items.map(shortTitle))];
				const support = items.filter((q) => q.owner === "CS").length;
				const talking = gaps.filter((g) => states[g.id]?.status === "in_discussione").length;
				return (
					<Box
						key={supplier} onClick={linkToDetail ? () => go(supplier) : undefined}
						sx={{
							display: "grid", gridTemplateColumns: cols, gap: { xs: 0.5, md: 2 }, alignItems: "center", px: 2, py: 1.25,
							borderTop: 1, borderColor: "divider", cursor: linkToDetail ? "pointer" : "default", "&:hover": linkToDetail ? { bgcolor: "action.hover" } : {},
						}}
					>
						<Box>
							<Box component={Link} to={supplierPath(supplier)} onClick={(e) => e.stopPropagation()} sx={linkSx}>{supplier}</Box>
							<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
								{[items.length ? plural(items.length, "riga di fattura", "righe di fattura") : "", gaps.length ? plural(gaps.length, "punto dell'accordo", "punti dell'accordo") : ""].filter(Boolean).join(" · ")}
							</Typography>
						</Box>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
							{topics.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
						</Box>
						<Typography sx={{ fontWeight: 700, textAlign: { md: "right" }, ...num }}>{total ? eur(total) : "–"}</Typography>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
							{support > 0 && <Chip size="small" color="info" label="Supporto chiesto" />}
							{talking > 0 && <Chip size="small" color={ITEM_STATUS.in_discussione.tone} label="In discussione" />}
							{!support && !talking && <Chip size="small" variant="outlined" color="warning" label="Aperto" />}
						</Box>
					</Box>
				);
			})}
		</Paper>
	);
}

/** Le schede complete, fornitore per fornitore: per approfondire e decidere. */
function Details({ groups, states }: { groups: Group[]; states: Record<string, AgreementItemState> }) {
	return (
		<Box sx={{ display: "grid", gap: 3 }}>
			{groups.map(({ supplier, items, gaps, total }) => (
				<Box key={supplier} id={anchorOf(supplier)} sx={{ scrollMarginTop: 72 }}>
					<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 1, pb: 0.5, borderBottom: 1, borderColor: "divider" }}>
						<Typography variant="h2" component="h3" sx={{ fontSize: 18 }}>
							<Box component={Link} to={supplierPath(supplier)} sx={linkSx}>{supplier}</Box>
						</Typography>
						<Typography variant="body2" color="text.secondary">
							{[items.length ? plural(items.length, "riga di fattura", "righe di fattura") : "", gaps.length ? plural(gaps.length, "punto dell'accordo", "punti dell'accordo") : "", total ? `${eur(total)} da chiarire` : ""].filter(Boolean).join(" · ")}
						</Typography>
						<Box sx={{ flex: 1 }} />
						<Box component="button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} sx={{ all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 }}>Torna al riepilogo</Box>
					</Box>
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5, alignItems: "start" }}>
						{items.length > 0 && <QueueCards items={items} showSupplier={false} showMonth empty="" />}
						{gaps.length > 0 && <Box sx={{ display: "grid", gap: 1.5 }}>{gaps.map((g) => <GapCard key={g.id} g={g} state={states[g.id]} />)}</Box>}
					</Box>
				</Box>
			))}
		</Box>
	);
}

function MonthTiles({ v, open, openEur, support }: { v: MonthView; open: number; openEur: number; support: number }) {
	const s = v.suppliers;
	const arrived = s.filter((x) => x.invoiced !== null).length;
	const ok = s.filter((x) => x.outcome === "ok").length;
	const ready = s.filter((x) => x.costState === "actual_ready").length;
	return (
		<Tiles n={5}>
			<Tile strong={open > 0} label="Da decidere" value={String(open)} sub={openEur ? `${eur(openEur)} in fattura da chiarire` : "niente in fattura da chiarire"} />
			<Tile label="Supporto chiesto" value={String(support)} sub="righe in mano alla gestione operativa" />
			<Tile label="Fatture arrivate" value={`${arrived}/${s.length}`} sub={`di ${monthName(v.month)}`} to="/supplier-invoices/month" />
			<Tile label="Tornano al primo colpo" value={`${ok}/${arrived}`} sub="fattura uguale al previsto" to="/supplier-invoices/month" />
			<Tile label="Costo effettivo pronto" value={String(ready)} sub="fornitori da caricare nel backadmin" />
		</Tiles>
	);
}

export function TodoPage() {
	const [role, setRole] = useRole();
	const { view } = useMonth();
	const queue = useGetQueueQuery(true);
	const agreements = useGetAgreementsQuery();

	if (queue.isLoading || agreements.isLoading || view.isLoading) return <CircularProgress />;
	const open = (queue.data ?? []).filter((q) => OPEN_VERDICTS.includes(q.verdict));
	const cs = open.filter((q) => q.owner === "CS");
	const states = agreements.data?.states ?? {};
	const gaps = (agreements.data?.suppliers ?? []).flatMap((a) => a.gaps.filter((g) => isOpenGap(g, states)).map((g) => ({ g, supplier: a.supplier })));
	const groups = groupBySupplier(open, gaps);
	const csGroups = groupBySupplier(cs, []);
	const openEur = open.reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0);
	const toDecide = open.length + gaps.length;
	const v = view.data;
	const ready = v?.suppliers.filter((s) => s.costState === "actual_ready") ?? [];
	const arrivedN = v?.suppliers.filter((s) => s.invoiced !== null).length ?? 0;
	const expectedOnly = v?.suppliers.filter((s) => s.costState === "expected_only") ?? [];
	const missing = v?.suppliers.filter((s) => s.costState === "no_invoice") ?? [];
	const count: Record<Role, string> = { responsabile: String(toDecide), cs: String(cs.length), amministrazione: String(ready.length), referente: "" };

	const headline: Record<Role, string> = {
		responsabile: toDecide
			? `${plural(toDecide, "cosa da decidere", "cose da decidere")} su ${plural(groups.length, "fornitore", "fornitori")}${openEur ? `, ${eur(openEur)} in fattura da chiarire` : ""}.`
			: "Niente da decidere.",
		cs: cs.length ? `${plural(cs.length, "richiesta di supporto", "richieste di supporto")} dal responsabile fornitori.` : "Nessuna richiesta di supporto aperta.",
		amministrazione: v ? `${plural(ready.length, "costo effettivo", "costi effettivi")} da caricare, ${expectedOnly.length} al previsto, ${plural(missing.length, "fattura", "fatture")} in arrivo.` : "",
		referente: v ? `${capitalize(monthName(v.month))}: ${arrivedN} fatture arrivate su ${v.suppliers.length}, ${ready.length} fornitori chiusi, ${plural(toDecide, "cosa", "cose")} da decidere.` : "",
	};

	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
				<ToggleButtonGroup exclusive size="small" value={role} onChange={(_, r: Role | null) => r && setRole(r)} aria-label="Ruolo">
					{(Object.keys(ROLES) as Role[]).map((r) => <ToggleButton key={r} value={r}>{ROLES[r].label}{count[r] ? ` (${count[r]})` : ""}</ToggleButton>)}
				</ToggleButtonGroup>
				<Typography variant="caption" color="text.secondary">{ROLES[role].help}</Typography>
			</Box>

			{!v && <Alert severity="info">Non è ancora stato caricato nessun mese.</Alert>}
			{v && <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 1.5 }}>{headline[role]}</Typography>}

			{role === "responsabile" && (
				<>
					{v && <MonthTiles v={v} open={toDecide} openEur={openEur} support={cs.length} />}
					{groups.length > 0 && (
						<>
							<Section title="Fornitore per fornitore" help="Dal fornitore che pesa di più. Clic su una riga per aprire le schede qui sotto; clic sul nome per la pagina del fornitore.">
								<Overview groups={groups} states={states} linkToDetail />
							</Section>
							<Section title="Nel dettaglio" help="A sinistra le righe di fattura che non tornano, a destra i punti dell'accordo. Per verificare una consegna si può chiedere supporto alla gestione operativa.">
								<Details groups={groups} states={states} />
							</Section>
						</>
					)}
				</>
			)}

			{role === "cs" && (
				<Section title="Richieste di supporto" help="Verifiche per cui il responsabile fornitori ha chiesto aiuto: di solito una consegna da controllare (note, chat, farmacia). Si scrive cosa si è trovato e si sceglie il verdetto, oppure si riporta la riga al responsabile.">
					{csGroups.length ? <Details groups={csGroups} states={states} /> : <QueueCards items={[]} empty="Nessuna richiesta di supporto aperta." />}
				</Section>
			)}

			{role === "amministrazione" && v && (
				<>
					<Tiles n={3}>
						<Tile strong={ready.length > 0} label="Costo effettivo da caricare" value={String(ready.length)} sub={eur(ready.reduce((a, s) => a + (s.invoiced ?? 0), 0))} />
						<Tile label="Resta il previsto" value={String(expectedOnly.length)} sub="scostamenti ancora aperti" />
						<Tile label="Fatture in arrivo" value={String(missing.length)} sub={`di ${monthName(v.month)}`} />
					</Tiles>
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2, alignItems: "start" }}>
						<Section title="Costo effettivo da caricare" help="La fattura torna o tutti i suoi scostamenti sono decisi: si carica nel backadmin l'imponibile della fattura.">
							<CostTable rows={ready.map((s) => [s.supplier, s.invoices.map((i) => `${i.number} del ${date(i.date)}`).join(", ") || "–", eur(s.invoiced)])} head={["Fornitore", "Fattura", "Imponibile"]} />
						</Section>
						<Box>
							<Section title="Resta il costo previsto" help="Finché uno scostamento è aperto si carica il previsto.">
								<CostTable rows={expectedOnly.map((s) => [s.supplier, `${s.openItems} da decidere`, eur(s.expected)])} head={["Fornitore", "", "Previsto"]} />
							</Section>
							<Section title="Fatture in arrivo">
								<Typography variant="body2" color="text.secondary">{missing.map((s) => s.supplier).join(", ") || "Nessuna."}</Typography>
							</Section>
						</Box>
					</Box>
				</>
			)}

			{role === "referente" && v && (
				<>
					<Tiles n={3}>
						<Tile label="Fatture arrivate" value={`${arrivedN}/${v.suppliers.length}`} sub={`di ${monthName(v.month)}`} to="/supplier-invoices/month" />
						<Tile label="Tornano al primo colpo" value={`${v.suppliers.filter((s) => s.outcome === "ok").length}/${arrivedN}`} sub="fattura uguale al previsto" to="/supplier-invoices/month" />
						<Tile label="Costo effettivo pronto" value={`${ready.length}/${v.suppliers.length}`} sub="fornitori chiusi per il mese" />
					</Tiles>
					<Section title="Chi ha in mano cosa">
						<Tiles n={3}>
							<Tile label="Responsabile fornitori" value={String(toDecide - cs.length)} sub={openEur ? `cose da decidere, ${eur(openEur)} in fattura da chiarire` : "cose da decidere"} />
							<Tile label="Gestione operativa" value={String(cs.length)} sub="richieste di supporto" />
							<Tile label="Amministrazione" value={String(ready.length)} sub="costi effettivi da caricare" />
						</Tiles>
					</Section>
					<Section title="Stato dei fornitori" help="Dove è arrivato ogni fornitore del mese. Il dettaglio è nella pagina Mese.">
						<SupplierStates v={v} />
					</Section>
					{groups.length > 0 && (
						<Section title="Questioni aperte" help="Solo la mappa: le decide il responsabile fornitori.">
							<Overview groups={groups} states={states} linkToDetail={false} />
						</Section>
					)}
				</>
			)}
		</Box>
	);
}

function CostTable({ head, rows }: { head: string[]; rows: string[][] }) {
	if (!rows.length) return <Typography variant="body2" color="text.secondary">Nessuno.</Typography>;
	return (
		<Paper sx={{ overflow: "hidden" }}>
			{[head, ...rows].map((r, i) => (
				<Box key={i} sx={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 110px", gap: 2, px: 2, py: 1, borderTop: i ? 1 : 0, borderColor: "divider", bgcolor: i ? undefined : "action.hover" }}>
					{r.map((c, j) => (
						<Typography key={j} variant={i ? "body2" : "caption"} color={i ? "text.primary" : "text.secondary"} sx={{ fontWeight: i && j ? 400 : i ? 600 : 700, textAlign: j === 2 ? "right" : "left", ...num }}>
							{i && j === 0 ? <Box component={Link} to={supplierPath(c)} sx={linkSx}>{c}</Box> : c}
						</Typography>
					))}
				</Box>
			))}
		</Paper>
	);
}

/** Quanti fornitori in ogni stato del costo, con i nomi. */
function SupplierStates({ v }: { v: MonthView }) {
	const order = ["actual_ready", "expected_only", "no_invoice"] as const;
	return (
		<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
			{order.map((k) => {
				const list = v.suppliers.filter((s) => s.costState === k);
				return (
					<Paper key={k} sx={{ p: 2 }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
							<Chip size="small" color={COST[k].tone} variant={k === "no_invoice" ? "outlined" : "filled"} label={COST[k].label} />
							<Typography sx={{ fontWeight: 700, ...num }}>{list.length}</Typography>
						</Box>
						<Typography variant="body2" color="text.secondary">
							{list.length ? list.map((s, i) => <span key={s.supplier}>{i ? ", " : ""}<Box component={Link} to={supplierPath(s.supplier)} sx={{ ...linkSx, fontWeight: 400 }}>{s.supplier}</Box></span>) : "Nessuno."}
						</Typography>
					</Paper>
				);
			})}
		</Box>
	);
}
