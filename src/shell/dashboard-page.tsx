import { Alert, Box, CircularProgress } from "@mui/material";
import { Suspense } from "react";
import { Link, useParams } from "react-router";
import { pages } from "./registry";

// La dashboard gestisce da sola le proprie sottopagine (/<nome>/...) con <Routes> relative
export function DashboardPage() {
	const Page = pages[useParams().name!];
	if (!Page) {
		return (
			<Alert severity="warning" sx={{ mt: 2 }}>
				Dashboard non trovata. <Link to="/">Torna all'elenco</Link>
			</Alert>
		);
	}
	return (
		<Suspense fallback={<Box sx={{ display: "grid", placeItems: "center", py: 10 }}><CircularProgress aria-label="Caricamento" /></Box>}>
			<Page />
		</Suspense>
	);
}
