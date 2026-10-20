import { createContext, useContext } from "react";

// Indirizzo della dashboard, ricavato dal router nella rotta di layout (index.tsx): così i link verso
// le pagine interne non contengono il nome della dashboard e funzionano da qualunque sottopagina.
export const BaseContext = createContext("");

export function usePaths() {
	const base = useContext(BaseContext);
	return {
		page: (name: string) => `${base}/${name}`,
		supplier: (supplier: string) => `${base}/suppliers/${encodeURIComponent(supplier)}`,
	};
}
