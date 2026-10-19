import { useState } from "react";

// Chi sta guardando la pagina: decide cosa mostra "Da fare". Si ricorda nel browser.
// L'utente principale è il responsabile dei rapporti con i fornitori: vede e decide tutto; la
// gestione operativa interviene solo sulle righe per cui lui chiede supporto.
export const ROLES = {
	responsabile: { label: "Responsabile fornitori", help: "Tutto quello che c'è da decidere (scostamenti del mese e punti aperti con i fornitori) e i costi da confermare." },
	cs: { label: "Gestione operativa", help: "Le verifiche per cui il responsabile fornitori ha chiesto supporto." },
	amministrazione: { label: "Amministrazione", help: "A che punto sono i costi del mese: inseriti, confermati, ancora al previsto, fatture in arrivo." },
	referente: { label: "Referente", help: "I costi confermati da inserire nel backadmin e l'avanzamento del mese." },
} as const;
export type Role = keyof typeof ROLES;

const KEY = "supplier-invoices-role";

export function useRole(): [Role, (r: Role) => void] {
	const [role, setRole] = useState<Role>(() => {
		try {
			const saved = localStorage.getItem(KEY);
			return saved && saved in ROLES ? (saved as Role) : "responsabile";
		} catch {
			return "responsabile";
		}
	});
	const save = (r: Role) => {
		setRole(r);
		try {
			localStorage.setItem(KEY, r);
		} catch {
			// senza localStorage il ruolo vale solo per questa visita
		}
	};
	return [role, save];
}
