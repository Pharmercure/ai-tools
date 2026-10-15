import { Provider } from "react-redux";
import { NavLink, Route, Routes } from "react-router";
import { store, useGetOrdersQuery, useGetSummaryQuery } from "./store";

const euro = (n: number) =>
	n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function Riepilogo() {
	const { data: summary, isLoading, isError } = useGetSummaryQuery();
	const { data: orders } = useGetOrdersQuery(5);
	if (isLoading) return <p>Caricamento dati…</p>;
	if (isError || !summary) return <p>Impossibile caricare i dati</p>;

	const max = Math.max(...summary.map((s) => s.totale));
	return (
		<>
			<h2>Totale per categoria</h2>
			{summary.map((s) => (
				<div key={s.categoria} css={{ margin: "0.5rem 0" }}>
					{s.categoria}: {euro(s.totale)} ({s.ordini} ordini)
					<div
						css={{ background: "#0b5fff", height: 10 }}
						style={{ width: `${(s.totale / max) * 100}%` }}
					/>
				</div>
			))}
			<h2>Ultimi ordini</h2>
			<OrdersTable orders={orders} />
		</>
	);
}

function Ordini() {
	const { data: orders, isError } = useGetOrdersQuery(100);
	return isError ? <p>Impossibile caricare gli ordini</p> : <OrdersTable orders={orders} />;
}

function OrdersTable({ orders }: { orders?: { id: number; data: string; categoria: string; importo: number }[] }) {
	if (!orders) return <p>Caricamento…</p>;
	return (
		<table css={{ borderCollapse: "collapse", td: { padding: "2px 12px" } }}>
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
	);
}

export default function DemoVendite() {
	return (
		<Provider store={store}>
			<h1>Demo vendite</h1>
			<nav css={{ display: "flex", gap: 16, "a.active": { fontWeight: 700 } }}>
				<NavLink to="." end>Riepilogo</NavLink>
				<NavLink to="ordini">Tutti gli ordini</NavLink>
			</nav>
			<Routes>
				<Route index element={<Riepilogo />} />
				<Route path="ordini" element={<Ordini />} />
			</Routes>
		</Provider>
	);
}
