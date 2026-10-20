import { Alert, Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import type { Import } from "../api/types";
import { useImportDataMutation } from "./store";

// Caricamento dei file JSON prodotti dalla routine di verifica (un mese o i tagliandi UBM).
export function UploadPage() {
	const [importData, { isLoading }] = useImportDataMutation();
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

	async function onFile(file: File | undefined) {
		if (!file) return;
		setMsg(null);
		let body: Import;
		try {
			body = JSON.parse(await file.text());
		} catch {
			setMsg({ ok: false, text: `${file.name} non è un JSON valido.` });
			return;
		}
		try {
			const r = await importData(body).unwrap();
			setMsg({ ok: true, text: r.kind === "month" ? `Mese caricato, ${r.queueRows} righe della coda inviate (verdetti e note esistenti non cambiano).` : r.kind === "ubm" ? "Dati UBM caricati." : "Accordi caricati." });
		} catch (e) {
			const err = (e as { data?: { error?: string } }).data?.error;
			setMsg({ ok: false, text: err ?? "Caricamento non riuscito." });
		}
	}

	return (
		<Box sx={{ maxWidth: 640 }}>
			<Typography variant="body2" sx={{ mb: 2 }}>
				Qui si caricano i file preparati dalla routine di verifica: <code>month-AAAA-MM.json</code> per un mese di consegne,{" "}
				<code>ubm.json</code> per i tagliandi, <code>agreements.json</code> per gli accordi commerciali. Ogni caricamento aggiunge una fotografia: la pagina mostra sempre la più recente. Le
				righe nuove della coda entrano con il verdetto della routine; per quelle già presenti cambiano solo descrizione e importo,
				mai verdetto, chi e nota.
			</Typography>
			<Button variant="contained" component="label" disabled={isLoading}>
				{isLoading ? "Caricamento…" : "Scegli un file JSON"}
				<input hidden type="file" accept="application/json,.json" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
			</Button>
			{msg && <Alert severity={msg.ok ? "success" : "error"} sx={{ mt: 2 }}>{msg.text}</Alert>}
		</Box>
	);
}
