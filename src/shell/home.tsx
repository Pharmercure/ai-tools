import { Box, Paper, Typography } from "@mui/material";
import { Link } from "react-router";
import { dashboards } from "./registry";

export function Home() {
	return (
		<Box sx={{ pt: { xs: 1, sm: 3 } }}>
			<Typography variant="h1" component="h1" sx={{ fontSize: { xs: 28, sm: 34 }, letterSpacing: "-0.02em" }}>
				Dashboard
			</Typography>
			<Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
				Gli strumenti interni di Pharmercure. Scegli una dashboard per aprirla.
			</Typography>
			<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
				{dashboards.map((d) => (
					<Paper
						key={d.name}
						component={Link}
						to={`/${d.name}`}
						sx={{
							p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, color: "text.primary", textDecoration: "none",
							transition: "transform .15s, border-color .15s, box-shadow .15s",
							"&:hover, &:focus-visible": {
								transform: "translateY(-2px)", borderColor: "primary.main", boxShadow: 3, outline: "none",
							},
						}}
					>
						<Box
							aria-hidden
							sx={{
								width: 40, height: 40, borderRadius: "10px", display: "grid", placeItems: "center",
								fontWeight: 700, fontSize: 18, color: "primary.main",
								bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(57,135,229,0.16)" : "rgba(42,120,214,0.1)"),
							}}
						>
							{d.title.charAt(0).toUpperCase()}
						</Box>
						<Box sx={{ flex: 1 }}>
							<Typography variant="h6" component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>
								{d.title}
							</Typography>
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ mt: 0.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
							>
								{d.description}
							</Typography>
						</Box>
						<Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
							Apri →
						</Typography>
					</Paper>
				))}
			</Box>
		</Box>
	);
}
