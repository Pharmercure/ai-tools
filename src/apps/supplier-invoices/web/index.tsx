import { Box, Tab, Tabs, Typography } from "@mui/material";
import { Provider } from "react-redux";
import { Link, Outlet, Route, Routes, useLocation } from "react-router";
import { HelpPage } from "./help";
import { BaseContext, usePaths } from "./links";
import { MonthPage } from "./month";
import { useGetMeQuery, store } from "./store";
import { SupplierPage, SuppliersPage } from "./suppliers";
import { TodoPage } from "./todo";
import { UploadPage } from "./upload";

function Nav({ base }: { base: string }) {
	const me = useGetMeQuery();
	const paths = usePaths();
	const current = useLocation().pathname.slice(base.length + 1).split("/")[0];
	const tabs = [
		{ to: "", label: "Da fare" },
		{ to: "month", label: "Mese" },
		{ to: "suppliers", label: "Fornitori" },
		{ to: "help", label: "Come funziona" },
		...(me.data?.canImport ? [{ to: "upload", label: "Carica dati" }] : []),
	];
	return (
		<Tabs value={tabs.some((t) => t.to === current) ? current : false} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
			{tabs.map((t) => <Tab key={t.to} value={t.to} label={t.label} component={Link} to={t.to ? paths.page(t.to) : base} />)}
		</Tabs>
	);
}

// Rotta di layout: ricava l'indirizzo della dashboard e lo passa al menu e alle pagine (vedi links.ts).
// La shell monta ogni dashboard su /<nome>/*: con React Router 8 i link relativi dentro una rotta con *
// si sommano all'indirizzo corrente (/month → /month/suppliers), anche in demo-vendite. Per questo i link
// partono dal primo segmento dell'indirizzo, che per regola della shell è il nome della dashboard.
function Frame() {
	const base = "/" + useLocation().pathname.split("/")[1];
	return (
		<BaseContext.Provider value={base}>
			<Nav base={base} />
			<Outlet />
		</BaseContext.Provider>
	);
}

function Dashboard() {
	return (
		<Box>
			<Typography variant="h1" component="h1" sx={{ mb: 0.5 }}>Verifica fatture fornitori</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				Confrontiamo ogni mese le fatture dei fornitori di consegne con il nostro calcolo, per pagare il giusto e saperlo prima.
			</Typography>
			<Routes>
				<Route element={<Frame />}>
					<Route index element={<TodoPage />} />
					<Route path="month" element={<MonthPage />} />
					<Route path="suppliers" element={<SuppliersPage />} />
					{/* Con * il nome può contenere "/" (Plt Express / Eta Shipping), anche quando il browser lo decodifica. */}
					<Route path="suppliers/*" element={<SupplierPage />} />
					<Route path="help" element={<HelpPage />} />
					<Route path="upload" element={<UploadPage />} />
				</Route>
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
