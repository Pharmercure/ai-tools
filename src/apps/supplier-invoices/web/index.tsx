import { Box, Tab, Tabs, Typography } from "@mui/material";
import { Provider } from "react-redux";
import { Link, Route, Routes, useLocation } from "react-router";
import { HelpPage } from "./help";
import { MonthPage } from "./month";
import { useGetMeQuery, store } from "./store";
import { SupplierPage, SuppliersPage } from "./suppliers";
import { TodoPage } from "./todo";
import { UploadPage } from "./upload";

// La dashboard è montata su /supplier-invoices/*. I link sono assoluti: dentro una rotta con *
// quelli relativi si sommerebbero all'indirizzo corrente.
const BASE = "/supplier-invoices";

function Nav() {
	const me = useGetMeQuery();
	const current = useLocation().pathname.split("/")[2] || "";
	const tabs = [
		{ to: "", label: "Da fare" },
		{ to: "month", label: "Mese" },
		{ to: "suppliers", label: "Fornitori" },
		{ to: "help", label: "Come funziona" },
		...(me.data?.canImport ? [{ to: "upload", label: "Carica dati" }] : []),
	];
	return (
		<Tabs value={tabs.some((t) => t.to === current) ? current : false} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
			{tabs.map((t) => <Tab key={t.to} value={t.to} label={t.label} component={Link} to={t.to ? `${BASE}/${t.to}` : BASE} />)}
		</Tabs>
	);
}

function Dashboard() {
	return (
		<Box>
			<Typography variant="h1" component="h1" sx={{ mb: 0.5 }}>Verifica fatture fornitori</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				Confrontiamo ogni mese le fatture dei fornitori di consegne con il nostro calcolo, per pagare il giusto e saperlo prima.
			</Typography>
			<Nav />
			<Routes>
				<Route index element={<TodoPage />} />
				<Route path="month" element={<MonthPage />} />
				<Route path="suppliers" element={<SuppliersPage />} />
				<Route path="suppliers/*" element={<SupplierPage />} />
				<Route path="help" element={<HelpPage />} />
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
