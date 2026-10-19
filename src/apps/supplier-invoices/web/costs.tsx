import { Alert, Box, Button, Chip, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { MonthView } from "../api/types";
import { COST, dateTime, eur } from "./format";
import { useCostActionMutation } from "./store";

type Supplier = MonthView["suppliers"][number];

// "1.750,08" o "1750.08" → 1750.08; null se non è un numero.
function parseEur(t: string): number | null {
	const clean = t.replace(/[€\s]/g, "");
	const n = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
	return Number.isFinite(n) && n > 0 ? n : null;
}
const plain = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

const textButtonSx = { all: "unset", cursor: "pointer", color: "primary.main", fontSize: 12, fontWeight: 600 } as const;

function errorText(error: unknown) {
	if (!error) return "";
	const data = (error as { data?: { error?: string } }).data;
	return data?.error ?? "Modifica non salvata: riprova o ricarica la pagina.";
}

/** Il responsabile fornitori conferma il costo effettivo: di norma l'imponibile della fattura. */
export function ConfirmCost({ month, s }: { month: string; s: Supplier }) {
	const [act, { isLoading, error }] = useCostActionMutation();
	const [amount, setAmount] = useState(plain(s.invoiced));
	const [note, setNote] = useState("");
	const value = parseEur(amount);
	const differs = value !== null && Math.abs(value - (s.invoiced ?? 0)) > 0.005;
	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
				<TextField
					label="Costo effettivo (€)" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ width: 150 }}
					error={amount !== "" && value === null} slotProps={{ htmlInput: { inputMode: "decimal" } }}
				/>
				{differs && (
					<TextField label="Perché è diverso dalla fattura" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1, minWidth: 220 }} placeholder="Per esempio: nota di credito n. … in arrivo" />
				)}
				<Button
					variant="contained" disabled={isLoading || value === null || (differs && !note.trim())}
					onClick={() => void act({ month, supplier: s.supplier, action: "confirm", amount: value ?? 0, note })}
				>
					Confermo
				</Button>
			</Box>
			{error && <Alert severity="error" sx={{ mt: 1 }}>{errorText(error)}</Alert>}
		</Box>
	);
}

/** Dove è arrivato il costo effettivo e il passo successivo, per chi tocca. */
export function CostState({ month, s, canConfirm = true, canLoad = true }: { month: string; s: Supplier; canConfirm?: boolean; canLoad?: boolean }) {
	const [act, { isLoading, error }] = useCostActionMutation();
	const c = s.cost;
	const run = (action: "unconfirm" | "loaded" | "unloaded") => void act({ month, supplier: s.supplier, action });
	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
				<Chip size="small" color={COST[s.costState].tone} label={COST[s.costState].label} />
				{c && (
					<Typography variant="body2">
						<b>{eur(c.amount)}</b>, confermato da {c.confirmedBy} il {dateTime(c.confirmedAt)}
						{c.loadedAt ? `; inserito da ${c.loadedBy} il ${dateTime(c.loadedAt)}` : ""}
					</Typography>
				)}
			</Box>
			{c?.note && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Nota: {c.note}</Typography>}
			{s.costState === "to_confirm" && canConfirm && <Box sx={{ mt: 1 }}><ConfirmCost month={month} s={s} /></Box>}
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 0.75 }}>
				{s.costState === "confirmed" && canLoad && <Button size="small" variant="contained" disabled={isLoading} onClick={() => run("loaded")}>Inserito nel backadmin</Button>}
				{s.costState === "confirmed" && canConfirm && <Box component="button" type="button" sx={textButtonSx} disabled={isLoading} onClick={() => run("unconfirm")}>Annulla la conferma</Box>}
				{s.costState === "loaded" && canLoad && <Box component="button" type="button" sx={textButtonSx} disabled={isLoading} onClick={() => run("unloaded")}>Non è inserito</Box>}
			</Box>
			{error && <Alert severity="error" sx={{ mt: 1 }}>{errorText(error)}</Alert>}
		</Box>
	);
}
