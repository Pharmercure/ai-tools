import { Box, Tab, Tabs, Typography } from "@mui/material";
import { Provider } from "react-redux";
import { Link, Route, Routes, useLocation } from "react-router";
import { MonthPage } from "./month";
import { QueuePage } from "./queue";
import { useGetMeQuery, useGetQueueQuery, store } from "./store";
import { UbmPage } from "./ubm";
import { UploadPage } from "./upload";

function Nav() {
	const me = useGetMeQuery();
	const open = useGetQueueQuery(true);
	// La dashboard è montata su /supplier-invoices/*: la scheda attiva è il primo segmento dopo il nome.
	const current = useLocation().pathname.split("/")[2] || "";
	const tabs = [
		{ to: "", label: "Mese" },
		{ to: "queue", label: `Coda di verifica${open.data?.length ? ` (${open.data.length})` : ""}` },
		{ to: "ubm", label: "Tagliandi UBM" },
		...(me.data?.canImport ? [{ to: "upload", label: "Carica dati" }] : []),
	];
	return (
		<Tabs value={tabs.some((t) => t.to === current) ? current : ""} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
			{tabs.map((t) => <Tab key={t.to} value={t.to} label={t.label} component={Link} to={t.to || "."} />)}
		</Tabs>
	);
}

function Dashboard() {
	return (
		<Box>
			<Typography variant="h1" component="h1" sx={{ mb: 0.5 }}>Verifica fatture fornitori</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				Ogni mese confrontiamo la fattura di ogni fornitore esterno con quanto abbiamo calcolato noi dalle consegne. Il
				procedimento è nella KB, pagina "Verifica mensile delle fatture dei fornitori esterni". Referente: Gianluca Abate.
			</Typography>
			<Nav />
			<Routes>
				<Route index element={<MonthPage />} />
				<Route path="queue" element={<QueuePage />} />
				<Route path="ubm" element={<UbmPage />} />
				<Route path="upload" element={<UploadPage />} />
			</Routes>
		</Box>
	);
}

export default function SupplierInvoices() {
	return (
		<Provider store={store}>
			<Dashboard />
		</Provider>
	);
}
