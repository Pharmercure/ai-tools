import { lazy, type ComponentType } from "react";

// Le dashboard si scoprono da sole: basta creare src/apps/<nome>/meta.ts e src/apps/<nome>/web/index.tsx
export type Meta = { title: string; description: string };
export const nameOf = (path: string) => path.match(/apps\/([^/]+)\//)![1];

const metaModules = import.meta.glob<Meta>("../apps/*/meta.ts", {
	eager: true,
	import: "meta",
});
export const dashboards = Object.entries(metaModules)
	.map(([path, meta]) => ({ name: nameOf(path), ...meta }))
	.sort((a, b) => a.title.localeCompare(b.title, "it"));

export const pages: Record<string, ComponentType> = Object.fromEntries(
	Object.entries(
		import.meta.glob<{ default: ComponentType }>("../apps/*/web/index.tsx"),
	).map(([path, load]) => [nameOf(path), lazy(load)]),
);
