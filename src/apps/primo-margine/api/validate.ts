// Controlli prima di salvare un nuovo snapshot (portati da aggiornamento/scripts/controlla.py).
// Se c'è anche un solo problema lo snapshot viene scartato e resta quello precedente.
import type { Dati } from "./types";

function totals(d: Dati) {
	const I = Object.fromEntries(d.colonne_righe.map((c, i) => [c, i]));
	const t: Record<string, [number, number, number]> = {};
	for (const r of d.righe) {
		const row = (t[d.mesi[r[0]]] ??= [0, 0, 0]);
		row[0] += d.componenti.reduce((s, c) => s + r[I["r_" + c]], 0);
		row[1] += r[I.c_effettivo] + r[I.c_ordine] + r[I.c_listino];
		row[2] += r[I.consegne];
	}
	return t;
}

export function validateSnapshot(next: Dati, previous: Dati | null) {
	const problems: string[] = [];
	const notes: string[] = [];
	if (!next.righe.length) problems.push("nessuna riga calcolata");
	if (!previous) {
		notes.push("nessuno snapshot precedente da confrontare");
		return { problems, notes };
	}
	const tn = totals(next);
	const tp = totals(previous);
	if (next.righe.length < 0.9 * previous.righe.length) {
		problems.push(`righe scese da ${previous.righe.length} a ${next.righe.length}`);
	}
	const lastMonth = +next.ultimo_chiuso.slice(5);
	// i mesi chiusi da almeno due mesi non dovrebbero cambiare molto
	const threshold = lastMonth > 1 ? next.ultimo_chiuso.slice(0, 5) + String(lastMonth - 1).padStart(2, "0") : null;
	for (const m of Object.keys(tp).sort()) {
		if (!tn[m]) {
			problems.push(`mese ${m} sparito`);
			continue;
		}
		const closed = threshold !== null && m < threshold;
		(["ricavo", "costo", "consegne"] as const).forEach((name, i) => {
			const a = tp[m][i];
			const b = tn[m][i];
			if (a && Math.abs(b - a) / Math.abs(a) > (closed ? 0.03 : 0.25)) {
				(closed ? problems : notes).push(`${m} ${name}: da ${Math.round(a)} a ${Math.round(b)}`);
			}
		});
	}
	return { problems, notes };
}
