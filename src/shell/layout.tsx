import { Box, Breadcrumbs, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { dashboards } from "./registry";

function Brand() {
	return (
		<Box
			component={Link}
			to="/"
			sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, color: "text.primary", textDecoration: "none" }}
		>
			<Box
				aria-hidden
				sx={{
					width: 28, height: 28, borderRadius: "8px", display: "grid", placeItems: "center",
					color: "#fff", fontWeight: 800, fontSize: 15,
					background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
				}}
			>
				P
			</Box>
			<Typography component="span" sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
				Pharmercure
			</Typography>
			<Typography component="span" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
				Dashboard
			</Typography>
		</Box>
	);
}

function Crumbs() {
	const name = useParams().name;
	const current = dashboards.find((d) => d.name === name);
	if (!name) return null;
	return (
		<Breadcrumbs aria-label="Percorso" sx={{ fontSize: 14, minWidth: 0 }}>
			<Box component={Link} to="/" sx={{ color: "text.secondary", textDecoration: "none", "&:hover": { color: "text.primary" } }}>
				Tutte le dashboard
			</Box>
			<Typography color="text.primary" noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
				{current?.title ?? name}
			</Typography>
		</Breadcrumbs>
	);
}

export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
	return (
		<Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
			<Box
				component="header"
				sx={{
					position: "sticky", top: 0, zIndex: 1100, borderBottom: 1, borderColor: "divider",
					bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(18,18,17,0.8)" : "rgba(246,245,242,0.8)"),
					backdropFilter: "blur(10px)",
				}}
			>
				<Container maxWidth={wide ? "xl" : "lg"} sx={{ display: "flex", alignItems: "center", gap: 2, height: 56 }}>
					<Brand />
					<Crumbs />
				</Container>
			</Box>
			<Container component="main" maxWidth={wide ? "xl" : "lg"} sx={{ flex: 1, py: { xs: 2, sm: 3 } }}>
				{children}
			</Container>
		</Box>
	);
}
