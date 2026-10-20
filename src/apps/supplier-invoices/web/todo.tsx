import { Alert, Box, Chip, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { type AgreementGap, type AgreementItemState, type MonthView, OPEN_VERDICTS, type QueueItem } from "../api/types";
import { GapCard, ITEM_STATUS, isOpenGap } from "./agreements";
import { ConfirmCost, CostStatus } from "./costs";
import { COST, date, eur, monthName, signedEur } from "./format";
import { usePaths } from "./links";
import { diffOf, useMonth } from "./month";
import { QueueCards } from "./queue";
import { ROLES, type Role, useRole } from "./roles";
import { failed, useGetAgreementsQuery, useGetQueueQuery } from "./store";

const linkSx = { color: "inherit", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
type Supplier = MonthView["suppliers"][number];
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
	const sx = { p: 2, boxSizing: "border-box", borderLeft: 4, borderColor: strong ? "warning.main" : "divider", display: "block", color: "inherit", textDecoration: "none" } as const;
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
	const paths = usePaths();
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
				const support = items.filter((q) => q.owner === "operations").length;
				const talking = gaps.filter((g) => states[g.id]?.status === "in_discussion").length;
				return (
					<Box
						key={supplier} onClick={linkToDetail ? () => go(supplier) : undefined}
						sx={{
							display: "grid", gridTemplateColumns: cols, gap: { xs: 0.5, md: 2 }, alignItems: "center", px: 2, py: 1.25,
							borderTop: 1, borderColor: "divider", cursor: linkToDetail ? "pointer" : "default", "&:hover": linkToDetail ? { bgcolor: "action.hover" } : {},
						}}
					>
						<Box>
							<Box component={Link} to={paths.supplier(supplier)} onClick={(e) => e.stopPropagation()} sx={linkSx}>{supplier}</Box>
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
							{talking > 0 && <Chip size="small" color={ITEM_STATUS.in_discussion.tone} label="In discussione" />}
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
	const paths = usePaths();
	return (
		<Box sx={{ display: "grid", gap: 3 }}>
			{groups.map(({ supplier, items, gaps, total }) => (
				<Box key={supplier} id={anchorOf(supplier)} sx={{ scrollMarginTop: 72 }}>
					<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1, mb: 1, pb: 0.5, borderBottom: 1, borderColor: "divider" }}>
						<Typography variant="h2" component="h3" sx={{ fontSize: 18 }}>
							<Box component={Link} to={paths.supplier(supplier)} sx={linkSx}>{supplier}</Box>
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
	const paths = usePaths();
	const s = v.suppliers;
	const arrived = s.filter((x) => x.invoiced !== null).length;
	const ok = s.filter((x) => x.outcome === "ok").length;
	const toConfirm = s.filter((x) => x.costState === "to_confirm").length;
	return (
		<Tiles n={5}>
			<Tile strong={open > 0} label="Da decidere" value={String(open)} sub={openEur ? `${eur(openEur)} in fattura da chiarire` : "niente in fattura da chiarire"} />
			<Tile strong={toConfirm > 0} label="Costi da confermare" value={String(toConfirm)} sub="fatture che tornano o già decise" />
			<Tile label="Supporto chiesto" value={String(support)} sub="righe in mano alla gestione operativa" />
			<Tile label="Fatture arrivate" value={`${arrived}/${s.length}`} sub={`di ${monthName(v.month)}`} to={paths.page("month")} />
			<Tile label="Tornano al primo colpo" value={`${ok}/${arrived}`} sub="fattura uguale al previsto" to={paths.page("month")} />
		</Tiles>
	);
}

const invoiceLabel = (s: Supplier) => s.invoices.map((i) => `${i.number} del ${date(i.date)}`).join(", ") || "–";

/** Una tabella a righe di griglia: intestazione, poi una riga per fornitore con il nome che apre la sua pagina. */
function Rows({ cols, head, rows }: { cols: string; head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
	if (!rows.length) return <Typography variant="body2" color="text.secondary">Nessuno.</Typography>;
	const right = (j: number) => head[j].startsWith("€");
	return (
		<Paper sx={{ overflow: "hidden" }}>
			<Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, gap: 2, px: 2, py: 1, bgcolor: "action.hover" }}>
				{head.map((h, j) => <Typography key={j} variant="caption" color="text.secondary" sx={{ fontWeight: 700, textAlign: right(j) ? "right" : "left" }}>{h.replace(/^€ ?/, "")}</Typography>)}
			</Box>
			{rows.map((r) => (
				<Box key={r.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: cols }, gap: { xs: 0.5, md: 2 }, alignItems: "center", px: 2, py: 1.25, borderTop: 1, borderColor: "divider" }}>
					{r.cells.map((c, j) => (
						<Box key={j} sx={{ textAlign: { md: right(j) ? "right" : "left" }, ...num, fontSize: 14, minWidth: 0 }}>{c}</Box>
					))}
				</Box>
			))}
		</Paper>
	);
}

function SupplierLink({ name }: { name: string }) {
	const paths = usePaths();
	return <Box component={Link} to={paths.supplier(name)} sx={linkSx}>{name}</Box>;
}

export function TodoPage() {
	const [role, setRole] = useRole();
	const paths = usePaths();
	const { months, view } = useMonth();
	const queue = useGetQueueQuery(true);
	const agreements = useGetAgreementsQuery();

	if (queue.isLoading || agreements.isLoading || view.isLoading) return <CircularProgress />;
	if ([months, view, queue, agreements].some(failed)) return <Alert severity="error">Impossibile caricare i dati: riprova o ricarica la pagina.</Alert>;
	const open = (queue.data ?? []).filter((q) => OPEN_VERDICTS.includes(q.verdict));
	const cs = open.filter((q) => q.owner === "operations");
	const states = agreements.data?.states ?? {};
	const gaps = (agreements.data?.suppliers ?? []).flatMap((a) => a.gaps.filter((g) => isOpenGap(g, states)).map((g) => ({ g, supplier: a.supplier })));
	const groups = groupBySupplier(open, gaps);
	const csGroups = groupBySupplier(cs, []);
	const openEur = open.reduce((a, q) => a + Math.max(0, q.amount ?? 0), 0);
	const toDecide = open.length + gaps.length;
	const v = view.data;
	const by = (k: Supplier["costState"]) => v?.suppliers.filter((s) => s.costState === k) ?? [];
	const toConfirm = by("to_confirm");
	const confirmed = by("confirmed");
	const loaded = by("loaded");
	const expectedOnly = by("expected_only");
	const missing = by("no_invoice");
	const arrivedN = v?.suppliers.filter((s) => s.invoiced !== null).length ?? 0;
	const count: Record<Role, number> = { supplier_owner: toDecide + toConfirm.length, operations: cs.length, administration: 0, referent: confirmed.length };

	const respParts = [
		toDecide ? `${plural(toDecide, "cosa da decidere", "cose da decidere")} su ${plural(groups.length, "fornitore", "fornitori")}${openEur ? ` (${eur(openEur)} in fattura da chiarire)` : ""}` : "",
		toConfirm.length ? plural(toConfirm.length, "costo da confermare", "costi da confermare") : "",
	].filter(Boolean);
	const headline: Record<Role, string> = {
		supplier_owner: respParts.length ? capitalize(respParts.join(" e ")) + "." : "Niente da decidere né da confermare.",
		operations: cs.length ? `${plural(cs.length, "richiesta di supporto", "richieste di supporto")} dal responsabile fornitori.` : "Nessuna richiesta di supporto aperta.",
		administration: v ? `${plural(loaded.length, "costo inserito", "costi inseriti")} nel backadmin, ${confirmed.length} confermati da inserire, ${plural(missing.length, "fattura", "fatture")} in arrivo.` : "",
		referent: v
			? confirmed.length ? `${plural(confirmed.length, "costo confermato", "costi confermati")} da inserire nel backadmin.` : `${capitalize(monthName(v.month))}: nessun costo confermato da inserire.`
			: "",
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

			{role === "supplier_owner" && (
				<>
					{v && <MonthTiles v={v} open={toDecide} openEur={openEur} support={cs.length} />}
					{groups.length > 0 && (
						<Section title="Fornitore per fornitore" help="Dal fornitore che pesa di più. Clic su una riga per aprire le schede più sotto; clic sul nome per la pagina del fornitore.">
							<Overview groups={groups} states={states} linkToDetail />
						</Section>
					)}
					{v && toConfirm.length > 0 && (
						<Section title={`Costi da confermare (${toConfirm.length})`} help="La fattura torna, o tutti i suoi scostamenti sono decisi. Confermando si dice che quel costo si può inserire nel backadmin; se l'importo giusto è diverso dalla fattura si scrive il perché.">
							<Rows
								cols="minmax(170px, 1.2fr) 1.3fr 100px 100px 100px minmax(260px, 2fr)"
								head={["Fornitore", "Fattura", "€ Previsto", "€ Imponibile", "€ Differenza", "Costo effettivo"]}
								rows={toConfirm.map((s) => {
									const d = diffOf(s);
									return {
										key: s.supplier,
										cells: [<SupplierLink name={s.supplier} />, invoiceLabel(s), eur(s.expected), eur(s.invoiced), d === null ? "–" : signedEur(d), <ConfirmCost month={v.month} s={s} />],
									};
								})}
							/>
						</Section>
					)}
					{groups.length > 0 && (
						<Section title="Nel dettaglio" help="A sinistra le righe di fattura che non tornano, a destra i punti dell'accordo. Per verificare una consegna si può chiedere supporto alla gestione operativa.">
							<Details groups={groups} states={states} />
						</Section>
					)}
				</>
			)}

			{role === "operations" && (
				<Section title="Richieste di supporto" help="Verifiche per cui il responsabile fornitori ha chiesto aiuto: di solito una consegna da controllare (note, chat, farmacia). Si scrive cosa si è trovato e si sceglie il verdetto, oppure si riporta la riga al responsabile.">
					{csGroups.length ? <Details groups={csGroups} states={states} /> : <QueueCards items={[]} empty="Nessuna richiesta di supporto aperta." />}
				</Section>
			)}

			{role === "administration" && v && (
				<>
					<Tiles n={4}>
						<Tile label="Inseriti nel backadmin" value={`${loaded.length}/${v.suppliers.length}`} sub={eur(loaded.reduce((a, s) => a + (s.cost?.amount ?? 0), 0))} />
						<Tile label="Confermati, da inserire" value={String(confirmed.length)} sub={eur(confirmed.reduce((a, s) => a + (s.cost?.amount ?? 0), 0))} />
						<Tile label="Da confermare o da decidere" value={String(toConfirm.length + expectedOnly.length)} sub="per ora resta il previsto" />
						<Tile label="Fatture in arrivo" value={String(missing.length)} sub={`di ${monthName(v.month)}`} />
					</Tiles>
					<Section title="Costi del mese" help="Il costo effettivo entra nel backadmin dopo la conferma del responsabile fornitori. Finché non c'è, vale il previsto.">
						<Rows
							cols="minmax(170px, 1.2fr) 1.4fr 110px 110px minmax(200px, 1.2fr)"
							head={["Fornitore", "Fattura", "€ Previsto", "€ Costo effettivo", "Stato"]}
							rows={[...loaded, ...confirmed, ...toConfirm, ...expectedOnly].map((s) => ({
								key: s.supplier,
								cells: [<SupplierLink name={s.supplier} />, invoiceLabel(s), eur(s.expected), s.cost ? eur(s.cost.amount) : "–", <Chip size="small" color={COST[s.costState].tone} label={COST[s.costState].label} />],
							}))}
						/>
					</Section>
					<Section title="Fatture in arrivo">
						<Typography variant="body2" color="text.secondary">{missing.map((s) => s.supplier).join(", ") || "Nessuna."}</Typography>
					</Section>
				</>
			)}

			{role === "referent" && v && (
				<>
					<Section title={`Da inserire nel backadmin (${confirmed.length})`} help="Costi confermati dal responsabile fornitori. Dopo averli inseriti e salvati nel backadmin, si segnano qui come inseriti.">
						<Rows
							cols="minmax(170px, 1.2fr) 1.3fr 120px minmax(320px, 2.2fr)"
							head={["Fornitore", "Fattura", "€ Costo confermato", ""]}
							rows={confirmed.map((s) => ({
								key: s.supplier,
								cells: [<SupplierLink name={s.supplier} />, invoiceLabel(s), <b>{eur(s.cost?.amount)}</b>, <CostStatus month={v.month} s={s} canConfirm={false} />],
							}))}
						/>
					</Section>
					<Tiles n={4}>
						<Tile label="Fatture arrivate" value={`${arrivedN}/${v.suppliers.length}`} sub={`di ${monthName(v.month)}`} to={paths.page("month")} />
						<Tile label="Tornano al primo colpo" value={`${v.suppliers.filter((s) => s.outcome === "ok").length}/${arrivedN}`} sub="fattura uguale al previsto" to={paths.page("month")} />
						<Tile label="Inseriti nel backadmin" value={`${loaded.length}/${v.suppliers.length}`} sub="fornitori chiusi per il mese" />
						<Tile label="Responsabile fornitori" value={String(toDecide - cs.length + toConfirm.length)} sub={`${toDecide - cs.length} da decidere, ${toConfirm.length} costi da confermare`} />
					</Tiles>
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

/** Quanti fornitori in ogni stato del costo, con i nomi. */
function SupplierStates({ v }: { v: MonthView }) {
	const paths = usePaths();
	const order = ["expected_only", "to_confirm", "confirmed", "loaded", "no_invoice"] as const;
	return (
		<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" }, gap: 1.5 }}>
			{order.map((k) => {
				const list = v.suppliers.filter((s) => s.costState === k);
				return (
					<Paper key={k} sx={{ p: 2 }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
							<Chip size="small" color={COST[k].tone} variant={k === "no_invoice" ? "outlined" : "filled"} label={COST[k].label} />
							<Typography sx={{ fontWeight: 700, ...num }}>{list.length}</Typography>
						</Box>
						<Typography variant="body2" color="text.secondary">
							{list.length ? list.map((s, i) => <span key={s.supplier}>{i ? ", " : ""}<Box component={Link} to={paths.supplier(s.supplier)} sx={{ ...linkSx, fontWeight: 400 }}>{s.supplier}</Box></span>) : "Nessuno."}
						</Typography>
					</Paper>
				);
			})}
		</Box>
	);
}
