import { useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { type Acc, type Dati, eur, nomeMese, pct } from "./calcoli";

type Tip = { x: number; y: number; titolo: string; righe: [string, string, string][] };
type Evento = MouseEvent<SVGElement> | FocusEvent<SVGElement>;

function scalaNice(max: number) {
	if (max <= 0) return { top: 1, passo: 1 };
	const e = Math.pow(10, Math.floor(Math.log10(max)));
	const n = max / e;
	const passo = (n <= 2 ? 0.5 : n <= 5 ? 1 : 2) * e;
	return { top: Math.ceil(max / passo) * passo, passo };
}

/** Barra con angoli arrotondati solo in alto, appoggiata alla base. */
function Barra({ x, y, w, h, fill, opacity }: { x: number; y: number; w: number; h: number; fill: string; opacity: number }) {
	const r = Math.min(4, w / 2, h);
	const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
	return <path d={d} fill={fill} opacity={opacity} />;
}

const passi = (da: number, a: number, passo: number) => {
	const out: number[] = [];
	for (let v = da; v <= a + 1e-9; v += passo) out.push(v);
	return out;
};

export default function Grafici({ d, pm }: { d: Dati; pm: [string, Acc][] }) {
	const [tip, setTip] = useState<Tip | null>(null);
	const mostra = (ev: Evento, titolo: string, righe: Tip["righe"]) => {
		const rc = ev.currentTarget.getBoundingClientRect();
		const mouse = "clientX" in ev;
		setTip({ x: mouse ? ev.clientX : rc.left + rc.width / 2, y: mouse ? ev.clientY : rc.top, titolo, righe });
	};
	const nascondi = () => setTip(null);
	const gestori = (titolo: string, righe: Tip["righe"]) => ({
		onPointerMove: (ev: MouseEvent<SVGElement>) => mostra(ev, titolo, righe),
		onFocus: (ev: FocusEvent<SVGElement>) => mostra(ev, titolo, righe),
		onPointerLeave: nascondi,
		onBlur: nascondi,
	});
	const parziale = (m: string) => m > d.ultimo_chiuso;
	const titoloMese = (m: string) => nomeMese(m) + (parziale(m) ? " (in corso, costi incompleti)" : "");

	// Ricavo e costo per mese
	const W1 = 640, H1 = 260, L1 = 52, R1 = 8, T1 = 10, B1 = 28;
	const { top, passo } = scalaNice(Math.max(1, ...pm.flatMap(([, a]) => [a.ricavo, a.costo])));
	const y1 = (v: number) => T1 + (H1 - T1 - B1) * (1 - v / top);
	const gw1 = (W1 - L1 - R1) / Math.max(1, pm.length);
	const bw = Math.min(28, (gw1 - 14) / 2);

	// Percentuale per mese
	const W2 = 420, H2 = 260, L2 = 40, R2 = 12, T2 = 10, B2 = 28;
	const vals = pm.map(([, a]) => (a.ricavo ? (a.ricavo - a.costo) / a.ricavo : null));
	const finiti = vals.filter((v): v is number => v !== null);
	const lo = Math.min(0, Math.floor(Math.min(...finiti, 0) * 10) / 10);
	const hi = Math.max(0.1, Math.ceil(Math.max(...finiti, 0.1) * 10) / 10);
	const y2 = (v: number) => T2 + (H2 - T2 - B2) * (hi - v) / (hi - lo);
	const gw2 = (W2 - L2 - R2) / Math.max(1, pm.length);
	const xs = pm.map((_, i) => L2 + i * gw2 + gw2 / 2);
	const linea = pm
		.map(([m], i) => ({ m, v: vals[i], x: xs[i] }))
		.filter((p): p is { m: string; v: number; x: number } => p.v !== null && !parziale(p.m))
		.map((p, i) => `${i ? "L" : "M"}${p.x},${y2(p.v)}`)
		.join("");

	return (
		<div className="grafici">
			<section className="card">
				<h2>Ricavo e costo logistica per mese</h2>
				<div className="legenda">
					<span><i style={{ background: "var(--series-1)" }} />Ricavo</span>
					<span><i style={{ background: "var(--series-2)" }} />Costo logistica</span>
				</div>
				<svg viewBox={`0 0 ${W1} ${H1}`} role="img" aria-label="Ricavo e costo logistica per mese">
					{passi(0, top, passo).map((v) => (
						<g key={v}>
							<line x1={L1} x2={W1 - R1} y1={y1(v)} y2={y1(v)} stroke="var(--grid)" />
							<text x={L1 - 6} y={y1(v) + 4} textAnchor="end">{eur(v / 1000)}k</text>
						</g>
					))}
					{pm.map(([m, a], i) => {
						const x0 = L1 + i * gw1 + gw1 / 2;
						const op = parziale(m) ? 0.45 : 1;
						return (
							<g
								key={m}
								tabIndex={0}
								aria-label={`${nomeMese(m)}: ricavo ${eur(a.ricavo)} euro, costo ${eur(a.costo)} euro`}
								{...gestori(titoloMese(m), [
									["var(--series-1)", "Ricavo", eur(a.ricavo) + " €"],
									["var(--series-2)", "Costo logistica", eur(a.costo) + " €"],
									["", "Primo margine", eur(a.ricavo - a.costo) + " €"],
									["", "Consegne", eur(a.consegne)],
									["", "Coin usate", eur(a.coin)],
								])}
							>
								<rect x={L1 + i * gw1} y={T1} width={gw1} height={H1 - T1 - B1} fill="transparent" />
								<Barra x={x0 - bw - 1} y={y1(a.ricavo)} w={bw} h={Math.max(0, y1(0) - y1(a.ricavo))} fill="var(--series-1)" opacity={op} />
								<Barra x={x0 + 1} y={y1(a.costo)} w={bw} h={Math.max(0, y1(0) - y1(a.costo))} fill="var(--series-2)" opacity={op} />
								<text x={x0} y={H1 - 10} textAnchor="middle">{nomeMese(m) + (parziale(m) ? "*" : "")}</text>
							</g>
						);
					})}
					<line x1={L1} x2={W1 - R1} y1={y1(0)} y2={y1(0)} stroke="var(--text-muted)" />
				</svg>
			</section>

			<section className="card">
				<h2>Primo margine % per mese</h2>
				<svg viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="Primo margine percentuale per mese">
					{passi(lo, hi, hi - lo > 0.6 ? 0.2 : 0.1).map((v) => (
						<g key={v}>
							<line x1={L2} x2={W2 - R2} y1={y2(v)} y2={y2(v)} stroke={Math.abs(v) < 1e-9 ? "var(--text-muted)" : "var(--grid)"} />
							<text x={L2 - 6} y={y2(v) + 4} textAnchor="end">{Math.round(v * 100)}%</text>
						</g>
					))}
					{linea && <path d={linea} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />}
					{pm.map(([m, a], i) => {
						const v = vals[i];
						const etichetta = (
							<text x={xs[i]} y={H2 - 10} textAnchor="middle">{nomeMese(m) + (parziale(m) ? "*" : "")}</text>
						);
						if (v === null) return <g key={m}>{etichetta}</g>;
						const ultimoChiuso = !parziale(m) && (i === 0 || i === pm.length - 1 || parziale(pm[i + 1][0]));
						return (
							<g
								key={m}
								tabIndex={0}
								aria-label={`${nomeMese(m)}: margine ${pct(v)}`}
								{...gestori(titoloMese(m), [
									["var(--series-1)", "Primo margine", pct(v)],
									["", "In euro", eur(a.ricavo - a.costo) + " €"],
								])}
							>
								{etichetta}
								<rect x={xs[i] - gw2 / 2} y={T2} width={gw2} height={H2 - T2 - B2} fill="transparent" />
								<circle cx={xs[i]} cy={y2(v)} r={4} fill={parziale(m) ? "var(--surface-1)" : "var(--series-1)"} stroke="var(--series-1)" strokeWidth={2} />
								{ultimoChiuso && (
									<text x={xs[i]} y={y2(v) - 10} textAnchor="middle" style={{ fill: "var(--text-secondary)" }}>{pct(v)}</text>
								)}
							</g>
						);
					})}
				</svg>
			</section>

			{tip && (
				<div className="tooltip" role="status" style={{ left: Math.min(window.innerWidth - 180, tip.x + 12), top: Math.max(8, tip.y - 12) }}>
					<b>{tip.titolo}</b>
					{tip.righe.map(([colore, nome, val]) => (
						<div className="r" key={nome}>
							<span>
								{colore && <i className="k" style={{ background: colore }} />}
								{nome}
							</span>
							<strong>{val}</strong>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
