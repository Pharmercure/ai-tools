import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useParams } from "react-router";
import "./index.css";

// Le dashboard si scoprono da sole: basta creare src/apps/<nome>/meta.ts e src/apps/<nome>/web/index.tsx
type Meta = { title: string; description: string };
const nameOf = (path: string) => path.match(/apps\/([^/]+)\//)![1];

const metas = import.meta.glob<Meta>("../apps/*/meta.ts", {
	eager: true,
	import: "meta",
});
const pages: Record<string, ComponentType> = Object.fromEntries(
	Object.entries(
		import.meta.glob<{ default: ComponentType }>("../apps/*/web/index.tsx"),
	).map(([path, load]) => [nameOf(path), lazy(load)]),
);

function Home() {
	return (
		<>
			<h1>Dashboard</h1>
			<ul>
				{Object.entries(metas).map(([path, meta]) => (
					<li key={path}>
						<Link to={`/${nameOf(path)}`}>{meta.title}</Link> — {meta.description}
					</li>
				))}
			</ul>
		</>
	);
}

// La dashboard gestisce da sola le proprie sottopagine (/<nome>/...) con <Routes> relative
function Dashboard() {
	const Page = pages[useParams().name!];
	return Page ? (
		<Suspense fallback="Caricamento…">
			<Link to="/">← Tutte le dashboard</Link>
			<Page />
		</Suspense>
	) : (
		<p>
			Dashboard non trovata. <Link to="/">Torna all'elenco</Link>
		</p>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/:name/*" element={<Dashboard />} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);
