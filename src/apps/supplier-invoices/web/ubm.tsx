import {
	Alert, Box, CircularProgress, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
	Typography,
} from "@mui/material";
import { date, dateTime, monthName } from "./format";
import { useGetUbmQuery } from "./store";

const n = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toLocaleString("it-IT"));

export function UbmPage() {
	const { data: d, isLoading, isError, error } = useGetUbmQuery();
	if (isLoading) return <CircularProgress />;
	if (isError || !d) {
		const notYet = error && "status" in error && error.status === 404;
		return <Alert severity={notYet ? "info" : "error"}>{notYet ? "Non sono ancora stati caricati dati sui tagliandi UBM." : "Impossibile caricare i dati UBM."}</Alert>;
	}
	const c = d.current;
	const residual = c ? c.size - c.used : null;

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				UBM Bologna si paga a carnet di tagliandi acquistati in anticipo: ogni consegna ne consuma uno o più secondo le regole qui
				sotto. Il contatore è il nostro calcolo dalle consegne del database; quando UBM manda il suo conteggio, lo confrontiamo.
				Dati calcolati il {dateTime(d.extractedAt)} ({d.source}).
			</Typography>

			{c ? (
				<Paper sx={{ p: 2, mb: 2 }}>
					<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Carnet in corso, dal {date(c.start)}</Typography>
					<Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
						<Typography sx={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n(c.used)}</Typography>
						<Typography color="text.secondary">tagliandi usati su {n(c.size)} al {date(c.asOf)}</Typography>
					</Box>
					<LinearProgress variant="determinate" value={Math.min(100, (c.used / c.size) * 100)} sx={{ height: 8, borderRadius: 4, my: 1.5 }} />
					<Typography variant="body2">
						Ne restano <b>{n(residual)}</b>. Al ritmo delle ultime 8 settimane ({c.dailyAverage.toLocaleString("it-IT", { maximumFractionDigits: 1 })} al
						giorno lavorativo) il carnet finisce {c.forecastEnd ? <>intorno al <b>{date(c.forecastEnd)}</b></> : "in una data non stimabile"}.
					</Typography>
				</Paper>
			) : (
				<Alert severity="warning" sx={{ mb: 2 }}>Non risulta un carnet in corso: serve la data di inizio del nuovo carnet.</Alert>
			)}

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Come si contano i tagliandi</Typography>
			<Paper sx={{ p: 2, mb: 2 }}>
				<Box component="ul" sx={{ m: 0, pl: 2.5 }}>
					{d.rules.map((r) => <Typography key={r} component="li" variant="body2">{r}</Typography>)}
				</Box>
			</Paper>

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Per mese</Typography>
			<TableContainer component={Paper} sx={{ mb: 2 }}>
				<Table size="small" aria-label="Tagliandi per mese">
					<TableHead>
						<TableRow>
							<TableCell>Mese</TableCell>
							<TableCell align="right">Consegne</TableCell>
							<TableCell align="right">Tagliandi (noi)</TableCell>
							<TableCell align="right">Tagliandi (UBM)</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{d.monthly.map((m) => (
							<TableRow key={m.month}>
								<TableCell>{monthName(m.month)}</TableCell>
								<TableCell align="right">{n(m.deliveries)}</TableCell>
								<TableCell align="right">{n(m.tickets)}</TableCell>
								<TableCell align="right">{n(m.supplierTickets)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Carnet</Typography>
			<TableContainer component={Paper} sx={{ mb: 2 }}>
				<Table size="small" aria-label="Carnet">
					<TableHead>
						<TableRow>
							<TableCell>Dal</TableCell>
							<TableCell>Al</TableCell>
							<TableCell align="right">Tagliandi</TableCell>
							<TableCell align="right">Usati (UBM)</TableCell>
							<TableCell align="right">Usati (noi)</TableCell>
							<TableCell>Fattura</TableCell>
							<TableCell>Note</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{d.carnets.map((k) => (
							<TableRow key={k.start}>
								<TableCell>{date(k.start)}</TableCell>
								<TableCell>{k.end ? date(k.end) : "in corso"}</TableCell>
								<TableCell align="right">{n(k.size)}</TableCell>
								<TableCell align="right">{n(k.usedSupplier)}</TableCell>
								<TableCell align="right">{n(k.usedModel)}</TableCell>
								<TableCell>{k.invoice || "–"}</TableCell>
								<TableCell sx={{ whiteSpace: "normal", minWidth: 220 }}>{k.note}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			{d.differences.length > 0 && (
				<>
					<Typography variant="h2" component="h2" sx={{ mb: 1 }}>Confronto consegna per consegna con il file di UBM</Typography>
					{d.comparison && (
						<Typography variant="body2" sx={{ mb: 1 }}>
							{d.comparison.matched} righe su {d.comparison.rows} del file di UBM corrispondono a un nostro ordine (le consegne Unipol si
							confrontano per giorno). Dove i conteggi non coincidono, UBM conta {n(d.comparison.against)} tagliandi più di noi e{" "}
							{n(d.comparison.favour)} meno di noi: nel complesso{" "}
							{d.comparison.favour >= d.comparison.against
								? `il conteggio di UBM è più basso del nostro di ${n(d.comparison.favour - d.comparison.against)} tagliandi.`
								: `il conteggio di UBM è più alto del nostro di ${n(d.comparison.against - d.comparison.favour)} tagliandi.`}
						</Typography>
					)}
					<TableContainer component={Paper}>
						<Table size="small" aria-label="Differenze">
							<TableHead>
								<TableRow>
									<TableCell>Giorno</TableCell>
									<TableCell>Farmacia</TableCell>
									<TableCell>Ordine</TableCell>
									<TableCell>Motivo</TableCell>
									<TableCell align="right">UBM</TableCell>
									<TableCell align="right">Noi</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{d.differences.map((x, i) => (
									<TableRow key={i}>
										<TableCell>{date(x.date)}</TableCell>
										<TableCell sx={{ whiteSpace: "normal" }}>{x.pharmacy}</TableCell>
										<TableCell>{x.order ?? "–"}</TableCell>
										<TableCell sx={{ whiteSpace: "normal", minWidth: 200 }}>{x.reason}</TableCell>
										<TableCell align="right">{x.supplier}</TableCell>
										<TableCell align="right">{x.model}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</>
			)}
		</Box>
	);
}
