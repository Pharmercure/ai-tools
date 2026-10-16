import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { api, useGetStatusQuery, useRefreshMutation } from "./store";

const POLL_MS = 3000;
const GIVE_UP_MS = 3 * 60 * 1000;

// Lancia l'aggiornamento dei dati e ne segue l'esito: il server risponde subito e calcola in background,
// quindi si controlla l'ultimo tentativo finché ne compare uno nuovo.
export default function RefreshButton() {
	const dispatch = useDispatch();
	const [refresh, { isLoading: isStarting }] = useRefreshMutation();
	const [waitingFrom, setWaitingFrom] = useState<number | null>(null); // id dell'ultimo tentativo prima del clic
	const [gaveUp, setGaveUp] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);
	const { data: status } = useGetStatusQuery(undefined, { pollingInterval: waitingFrom === null ? 0 : POLL_MS });

	const finished = waitingFrom !== null && !!status && status.id > waitingFrom;
	const waiting = waitingFrom !== null && !finished && !gaveUp;

	useEffect(() => {
		if (finished) dispatch(api.util.invalidateTags(["Dati"])); // ricarica i dati appena c'è uno snapshot nuovo
	}, [finished, dispatch]);

	useEffect(() => {
		if (!waiting) return;
		const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
		return () => clearTimeout(timer);
	}, [waiting]);

	async function start() {
		setStartError(null);
		setGaveUp(false);
		setWaitingFrom(null); // cancella l'esito del tentativo precedente
		const before = status?.id ?? 0;
		try {
			await refresh().unwrap(); // resta in attesa finché l'aggiornamento è finito (anche un paio di minuti)
		} catch (e) {
			const data = (e as { data?: { error?: string } }).data;
			if (data?.error) setStartError(data.error);
			// altrimenti la connessione è caduta: l'esito si legge comunque da /status
		}
		setWaitingFrom(before);
	}

	let message: string | null = startError;
	let severity: "info" | "success" | "warning" | "error" = "error";
	if (isStarting) {
		message = "Aggiornamento in corso: legge MongoDB e Fatture in Cloud, può richiedere un paio di minuti…";
		severity = "info";
	} else if (waiting) {
		message = "Aggiornamento in corso, può richiedere un minuto…";
		severity = "info";
	} else if (gaveUp) {
		message = "L'aggiornamento non ha dato esito entro 3 minuti: potrebbe essere stato interrotto. Controlla i log del Worker.";
		severity = "warning";
	} else if (finished && status) {
		if (status.status === "ok") {
			message = "Dati aggiornati.";
			severity = "success";
		} else if (status.status === "rejected") {
			message = `Aggiornamento scartato dai controlli: ${(status.log.problems ?? []).join("; ")}`;
			severity = "warning";
		} else {
			message = `Aggiornamento fallito: ${status.log.error ?? "errore sconosciuto"}`;
		}
	}

	return (
		<Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
			<Button
				variant="contained"
				size="small"
				disabled={isStarting || waiting}
				onClick={start}
				startIcon={waiting || isStarting ? <CircularProgress size={14} color="inherit" /> : undefined}
			>
				Aggiorna dati
			</Button>
			{message && <Alert severity={severity} role="status" sx={{ py: 0, maxWidth: 560 }}>{message}</Alert>}
		</Box>
	);
}
