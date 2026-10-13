import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Le dashboard si scoprono da sole: basta creare apps/<nome>/meta.ts e apps/<nome>/web/index.tsx
type Meta = { title: string; description: string };
const nameOf = (path: string) => path.match(/apps\/([^/]+)\//)![1];

const metas = import.meta.glob<Meta>("../../apps/*/meta.ts", {
	eager: true,
	import: "meta",
});
const pages = import.meta.glob<{ default: ComponentType }>(
	"../../apps/*/web/index.tsx",
);

function Home() {
	return (
		<>
			<h1>Dashboard</h1>
			<ul>
				{Object.entries(metas).map(([path, meta]) => (
					<li key={path}>
						<a href={`/${nameOf(path)}/`}>{meta.title}</a> — {meta.description}
					</li>
				))}
			</ul>
		</>
	);
}

const name = location.pathname.split("/")[1];
const load = pages[`../../apps/${name}/web/index.tsx`];
const Page = load ? lazy(load) : null;

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		{!name ? (
			<Home />
		) : Page ? (
			<Suspense fallback="Caricamento…">
				<a href="/">← Tutte le dashboard</a>
				<Page />
			</Suspense>
		) : (
			<p>
				Dashboard non trovata. <a href="/">Torna all'elenco</a>
			</p>
		)}
	</StrictMode>,
);
