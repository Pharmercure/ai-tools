import { createTheme, useMediaQuery } from "@mui/material";
import { useMemo } from "react";

// Tema MUI della dashboard, applicato solo qui dentro (ThemeProvider in index.tsx): nessuno stile globale.
// Chiaro/scuro seguono le impostazioni del sistema; i colori sono quelli della vecchia pagina.
const palettes = {
	light: {
		background: { default: "#f6f5f2", paper: "#fcfcfb" },
		text: { primary: "#0b0b0b", secondary: "#52514e" },
		primary: { main: "#2a78d6" },
		secondary: { main: "#eb6834" },
		error: { main: "#c42e2e" },
		warning: { main: "#8a6400", light: "#fff4d6" },
		divider: "#e2e0da",
	},
	dark: {
		background: { default: "#121211", paper: "#1a1a19" },
		text: { primary: "#ffffff", secondary: "#c3c2b7" },
		primary: { main: "#3987e5" },
		secondary: { main: "#d95926" },
		error: { main: "#e66767" },
		warning: { main: "#f3d27a", light: "#3a3012" },
		divider: "#34332f",
	},
} as const;

export function useAppTheme() {
	const dark = useMediaQuery("(prefers-color-scheme: dark)");
	return useMemo(() => {
		const mode = dark ? "dark" : "light";
		return createTheme({
			palette: { mode, ...palettes[mode] },
			shape: { borderRadius: 10 },
			typography: {
				fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
				fontSize: 14,
				h1: { fontSize: 24, fontWeight: 700 },
				h2: { fontSize: 15, fontWeight: 600 },
				button: { textTransform: "none", fontWeight: 600 },
			},
			components: {
				MuiPaper: {
					defaultProps: { variant: "outlined" },
					styleOverrides: { root: { backgroundImage: "none" } },
				},
				MuiButton: { defaultProps: { disableElevation: true } },
				MuiTextField: { defaultProps: { size: "small" } },
				MuiTableCell: {
					styleOverrides: {
						root: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", padding: "6px 10px" },
						head: { fontSize: 12, fontWeight: 600 },
					},
				},
			},
		});
	}, [dark]);
}
