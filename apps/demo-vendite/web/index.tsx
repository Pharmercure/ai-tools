import { useEffect, useState } from "react";

type Summary = { categoria: string; ordini: number; totale: number };
type Order = { id: number; data: string; categoria: string; importo: number };

const euro = (n: number) =>
	n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export default function DemoVendite() {
	const [summary, setSummary] = useState<Summary[]>();
	const [orders, setOrders] = useState<Order[]>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		Promise.all([
			fetch("/api/demo-vendite/summary").then((r) => r.json()),
			fetch("/api/demo-vendite/orders?limit=5").then((r) => r.json()),
		])
			.then(([s, o]) => {
				setSummary(s as Summary[]);
				setOrders(o as Order[]);
			})
			.catch(() => setError("Impossibile caricare i dati"));
	}, []);

	if (error) return <p>{error}</p>;
	if (!summary || !orders) return <p>Caricamento dati…</p>;

	const max = Math.max(...summary.map((s) => s.totale));
	return (
		<>
			<h1>Demo vendite</h1>
			<h2>Totale per categoria</h2>
			{summary.map((s) => (
				<div key={s.categoria} style={{ margin: "0.5rem 0" }}>
					{s.categoria}: {euro(s.totale)} ({s.ordini} ordini)
					<div
						style={{
							background: "#0b5fff",
							height: 10,
							width: `${(s.totale / max) * 100}%`,
						}}
					/>
				</div>
			))}
			<h2>Ultimi ordini</h2>
			<table>
				<tbody>
					{orders.map((o) => (
						<tr key={o.id}>
							<td>{o.data}</td>
							<td>{o.categoria}</td>
							<td>{euro(o.importo)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
