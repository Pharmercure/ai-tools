import { GlobalStyles, ThemeProvider } from "@mui/material";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { DashboardPage } from "./dashboard-page";
import { Home } from "./home";
import "./index.css";
import { Layout } from "./layout";
import { useAppTheme } from "./theme";

// Il tema MUI è della shell e vale per tutte le dashboard. Qui sta anche lo sfondo della pagina.
function App() {
	const theme = useAppTheme();
	return (
		<ThemeProvider theme={theme}>
			<GlobalStyles
				styles={{
					body: { backgroundColor: theme.palette.background.default, color: theme.palette.text.primary, fontFamily: theme.typography.fontFamily },
				}}
			/>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Layout><Home /></Layout>} />
					<Route path="/:name/*" element={<Layout wide><DashboardPage /></Layout>} />
				</Routes>
			</BrowserRouter>
		</ThemeProvider>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
